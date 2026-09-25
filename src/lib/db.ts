import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Team, Transaction, RoundBadge, TeamStatus, TeamWithLastTx, TransactionWithBalance } from './types';

// Ensure data directory exists
const dbPath = process.env.DATABASE_PATH || 'soulcoins.db';
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), 'data', path.basename(dbPath));
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Global database instance for Next.js hot-reloading development
declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function initDb(): Database.Database {
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema if not present
  const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  return db;
}

export const db: Database.Database = global.__db || initDb();
if (process.env.NODE_ENV !== 'production') {
  global.__db = db;
}

// -------------------------------------------------------------
// Team Queries
// -------------------------------------------------------------

export function getAllTeams(): Team[] {
  const stmt = db.prepare(`
    SELECT * FROM teams 
    ORDER BY team_number ASC
  `);
  return stmt.all() as Team[];
}

export function getAllTeamsWithLastTx(): TeamWithLastTx[] {
  const teams = getAllTeams();
  const latestTxStmt = db.prepare(`
    SELECT t.*, 
      st.team_number as source_team_number,
      dt.team_number as destination_team_number
    FROM transactions t
    LEFT JOIN teams st ON t.source_team_id = st.id
    LEFT JOIN teams dt ON t.destination_team_id = dt.id
    WHERE t.source_team_id = ? OR t.destination_team_id = ?
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 1
  `);

  return teams.map(team => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = latestTxStmt.get(team.id, team.id) as any;
    let lastTransaction = null;
    if (tx) {
      const isIncoming = tx.destination_team_id === team.id;
      lastTransaction = {
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        badge: tx.badge,
        note: tx.note,
        createdAt: tx.created_at,
        direction: isIncoming ? ('INCOMING' as const) : ('OUTGOING' as const),
        counterpartyNumber: tx.type === 'TRANSFER'
          ? (isIncoming ? tx.source_team_number : tx.destination_team_number)
          : null,
      };
    }
    return {
      ...team,
      lastTransaction,
    };
  });
}

export function updateTeamStatus(teamId: number, status: TeamStatus): Team {
  if (status !== 'active' && status !== 'eliminated') {
    throw new Error('Invalid status. Supported statuses: active, eliminated');
  }
  const stmt = db.prepare(`
    UPDATE teams 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(status, teamId);
  if (result.changes === 0) {
    throw new Error(`Team with ID ${teamId} not found`);
  }
  const updated = getTeamById(teamId);
  if (!updated) throw new Error('Team not found');
  return updated;
}

export function getTeamHistoryWithRunningBalance(teamId: number): TransactionWithBalance[] {
  const stmt = db.prepare(`
    SELECT 
      t.*,
      st.team_number as source_team_number,
      st.team_name as source_team_name,
      dt.team_number as destination_team_number,
      dt.team_name as destination_team_name
    FROM transactions t
    LEFT JOIN teams st ON t.source_team_id = st.id
    LEFT JOIN teams dt ON t.destination_team_id = dt.id
    WHERE t.source_team_id = ? OR t.destination_team_id = ?
    ORDER BY t.created_at ASC, t.id ASC
  `);
  const rows = stmt.all(teamId, teamId) as Transaction[];

  let runningBalance = 0;
  const result: TransactionWithBalance[] = [];

  for (const tx of rows) {
    const isIncoming = tx.destination_team_id === teamId;
    if (isIncoming) {
      runningBalance += tx.amount;
    } else {
      runningBalance -= tx.amount;
    }

    result.push({
      ...tx,
      balanceAfter: runningBalance,
      direction: isIncoming ? 'INCOMING' : 'OUTGOING',
    });
  }

  return result.reverse();
}

export function getTeamById(id: number): Team | undefined {
  const stmt = db.prepare('SELECT * FROM teams WHERE id = ?');
  return stmt.get(id) as Team | undefined;
}

export function getTeamByNumber(teamNumber: number): Team | undefined {
  const stmt = db.prepare('SELECT * FROM teams WHERE team_number = ?');
  return stmt.get(teamNumber) as Team | undefined;
}

export function getTeamByAccessKey(accessKey: string): Team | undefined {
  const stmt = db.prepare('SELECT * FROM teams WHERE access_key = ?');
  return stmt.get(accessKey) as Team | undefined;
}

export function createTeam(params: {
  teamNumber: number;
  teamName: string;
  accessKey: string;
  pinHash: string;
  initialBalance?: number;
}): Team {
  const stmt = db.prepare(`
    INSERT INTO teams (team_number, team_name, access_key, pin_hash, balance)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    params.teamNumber,
    params.teamName,
    params.accessKey,
    params.pinHash,
    params.initialBalance || 0
  );
  return getTeamById(Number(result.lastInsertRowid))!;
}

// -------------------------------------------------------------
// Transaction & Balance Operations (ACID Atomic Transactions)
// -------------------------------------------------------------

export function adjustBalance(params: {
  teamId: number;
  amountDelta: number; // positive to grant, negative to revoke/deduct
  badge: RoundBadge;
  note?: string;
}): { team: Team; transaction: Transaction } {
  const { teamId, amountDelta, badge, note } = params;

  if (amountDelta === 0) {
    throw new Error('Adjustment amount cannot be zero');
  }

  const executeAdjustment = db.transaction(() => {
    const team = getTeamById(teamId);
    if (!team) {
      throw new Error(`Team with ID ${teamId} not found`);
    }

    const isGrant = amountDelta > 0;
    const absAmount = Math.abs(amountDelta);

    if (!isGrant && team.balance < absAmount) {
      throw new Error(
        `Cannot revoke ${absAmount} coins from Team ${team.team_number}. Current balance is ${team.balance} (resulting balance cannot fall below 0).`
      );
    }

    const type = isGrant ? 'ORGANIZER_GRANT' : 'ORGANIZER_DEDUCT';
    const sourceTeamId = isGrant ? null : teamId;
    const destTeamId = isGrant ? teamId : null;

    // 1. Insert Transaction record
    const insertStmt = db.prepare(`
      INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'ORGANIZER')
    `);
    const txResult = insertStmt.run(type, absAmount, sourceTeamId, destTeamId, badge, note || null);

    // 2. Update Team Balance
    const updateStmt = db.prepare(`
      UPDATE teams 
      SET balance = balance + ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    updateStmt.run(amountDelta, teamId);

    const updatedTeam = getTeamById(teamId)!;
    const createdTx = getTransactionById(Number(txResult.lastInsertRowid))!;

    return { team: updatedTeam, transaction: createdTx };
  });

  return executeAdjustment();
}

export function transferCoins(params: {
  sourceTeamId: number;
  destinationTeamNumber: number;
  amount: number;
  note?: string;
}): {
  sourceTeam: Team;
  destinationTeam: Team;
  transaction: Transaction;
} {
  const { sourceTeamId, destinationTeamNumber, amount, note } = params;

  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Transfer amount must be a positive whole integer');
  }

  const executeTransfer = db.transaction(() => {
    // 1. Fetch & lock source team
    const sourceTeam = getTeamById(sourceTeamId);
    if (!sourceTeam) {
      throw new Error('Source team not found');
    }

    if (sourceTeam.status === 'eliminated') {
      throw new Error('Eliminated teams cannot transfer Soul Coins');
    }

    if (sourceTeam.balance < amount) {
      throw new Error(`Insufficient Soul Coins. Current balance: ${sourceTeam.balance}, Requested: ${amount}`);
    }

    // 2. Fetch destination team
    const destTeam = getTeamByNumber(destinationTeamNumber);
    if (!destTeam) {
      throw new Error(`Destination Team ${destinationTeamNumber} does not exist`);
    }

    if (destTeam.id === sourceTeam.id) {
      throw new Error('Cannot transfer Soul Coins to your own team');
    }

    // 3. Insert Transfer Transaction
    const insertStmt = db.prepare(`
      INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
      VALUES ('TRANSFER', ?, ?, ?, 'Transfer', ?, 'PARTICIPANT')
    `);
    const txResult = insertStmt.run(amount, sourceTeam.id, destTeam.id, note || null);

    // 4. Update Balances
    const deductStmt = db.prepare(`
      UPDATE teams 
      SET balance = balance - ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    deductStmt.run(amount, sourceTeam.id);

    const creditStmt = db.prepare(`
      UPDATE teams 
      SET balance = balance + ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    creditStmt.run(amount, destTeam.id);

    const updatedSource = getTeamById(sourceTeam.id)!;
    const updatedDest = getTeamById(destTeam.id)!;
    const createdTx = getTransactionById(Number(txResult.lastInsertRowid))!;

    return {
      sourceTeam: updatedSource,
      destinationTeam: updatedDest,
      transaction: createdTx,
    };
  });

  return executeTransfer();
}

export function updateTransactionBadge(params: {
  transactionId: number;
  badge: RoundBadge;
  note?: string;
}): Transaction {
  const { transactionId, badge, note } = params;

  const stmt = db.prepare(`
    UPDATE transactions
    SET badge = ?, note = COALESCE(?, note)
    WHERE id = ?
  `);
  stmt.run(badge, note !== undefined ? note : null, transactionId);

  const updated = getTransactionById(transactionId);
  if (!updated) {
    throw new Error(`Transaction ${transactionId} not found`);
  }
  return updated;
}

export function getTransactionById(id: number): Transaction | undefined {
  const stmt = db.prepare(`
    SELECT 
      t.*,
      st.team_number as source_team_number,
      st.team_name as source_team_name,
      dt.team_number as destination_team_number,
      dt.team_name as destination_team_name
    FROM transactions t
    LEFT JOIN teams st ON t.source_team_id = st.id
    LEFT JOIN teams dt ON t.destination_team_id = dt.id
    WHERE t.id = ?
  `);
  return stmt.get(id) as Transaction | undefined;
}

export function getAllTransactions(limit = 200): Transaction[] {
  const stmt = db.prepare(`
    SELECT 
      t.*,
      st.team_number as source_team_number,
      st.team_name as source_team_name,
      dt.team_number as destination_team_number,
      dt.team_name as destination_team_name
    FROM transactions t
    LEFT JOIN teams st ON t.source_team_id = st.id
    LEFT JOIN teams dt ON t.destination_team_id = dt.id
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Transaction[];
}

export function getTeamTransactions(teamId: number, limit = 100): Transaction[] {
  const stmt = db.prepare(`
    SELECT 
      t.*,
      st.team_number as source_team_number,
      st.team_name as source_team_name,
      dt.team_number as destination_team_number,
      dt.team_name as destination_team_name
    FROM transactions t
    LEFT JOIN teams st ON t.source_team_id = st.id
    LEFT JOIN teams dt ON t.destination_team_id = dt.id
    WHERE t.source_team_id = ? OR t.destination_team_id = ?
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ?
  `);
  return stmt.all(teamId, teamId, limit) as Transaction[];
}

/**
 * Double-entry integrity check: verify team balance against sum of historical transactions
 */
export function auditTeamBalance(teamId: number): {
  recordedBalance: number;
  calculatedBalance: number;
  isConsistent: boolean;
} {
  const team = getTeamById(teamId);
  if (!team) throw new Error('Team not found');

  const incomingStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM transactions 
    WHERE destination_team_id = ?
  `);
  const incoming = (incomingStmt.get(teamId) as { total: number }).total;

  const outgoingStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM transactions 
    WHERE source_team_id = ?
  `);
  const outgoing = (outgoingStmt.get(teamId) as { total: number }).total;

  const calculatedBalance = incoming - outgoing;
  return {
    recordedBalance: team.balance,
    calculatedBalance,
    isConsistent: team.balance === calculatedBalance,
  };
}
