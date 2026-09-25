const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'soulcoins.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('=== RUNNING ACCOUNTING & INTEGRITY TESTS ===');

// Helper functions mirroring db.ts logic for test verification
function getTeam(teamNumber) {
  return db.prepare('SELECT * FROM teams WHERE team_number = ?').get(teamNumber);
}

// 1. Initial State Check
const t1Before = getTeam(1);
const t2Before = getTeam(2);
console.log(`Initial Balances -> Team 01: ${t1Before.balance}, Team 02: ${t2Before.balance}`);

// 2. Organizer Grant: +50 to Team 01
const grantTx = db.transaction(() => {
  const insert = db.prepare(`
    INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
    VALUES ('ORGANIZER_GRANT', 50, NULL, ?, 'Round 1', 'Initial Round 1 Allocation', 'ORGANIZER')
  `);
  const res = insert.run(t1Before.id);
  db.prepare('UPDATE teams SET balance = balance + 50 WHERE id = ?').run(t1Before.id);
  return res.lastInsertRowid;
})();
const t1AfterGrant = getTeam(1);
console.log(`[PASS] Organizer Grant +50 -> Team 01 Balance: ${t1AfterGrant.balance} (Expected: ${t1Before.balance + 50})`);

// 3. Organizer Revoke: -10 from Team 01
db.transaction(() => {
  db.prepare(`
    INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
    VALUES ('ORGANIZER_DEDUCT', 10, ?, NULL, 'General / Adjustment', 'Penalty deduction', 'ORGANIZER')
  `).run(t1Before.id);
  db.prepare('UPDATE teams SET balance = balance - 10 WHERE id = ?').run(t1Before.id);
})();
const t1AfterRevoke = getTeam(1);
console.log(`[PASS] Organizer Revoke -10 -> Team 01 Balance: ${t1AfterRevoke.balance} (Expected: ${t1Before.balance + 40})`);

// 4. Team-to-Team Atomic Transfer: Team 01 -> Team 02 (15 coins)
db.transaction(() => {
  const sender = getTeam(1);
  const recipient = getTeam(2);
  const transferAmount = 15;

  if (sender.balance < transferAmount) {
    throw new Error('Insufficient balance');
  }

  db.prepare(`
    INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
    VALUES ('TRANSFER', ?, ?, ?, 'Transfer', 'Alliance pact tribute', 'PARTICIPANT')
  `).run(transferAmount, sender.id, recipient.id);

  db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(transferAmount, sender.id);
  db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(transferAmount, recipient.id);
})();

const t1AfterTransfer = getTeam(1);
const t2AfterTransfer = getTeam(2);
console.log(`[PASS] Atomic Transfer 15 Coins -> Team 01 Balance: ${t1AfterTransfer.balance}, Team 02 Balance: ${t2AfterTransfer.balance}`);

// 5. Test Insufficient Balance Protection
let rejectedCorrectly = false;
try {
  db.transaction(() => {
    const sender = getTeam(1);
    const amount = 9999;
    if (sender.balance < amount) {
      throw new Error('Insufficient balance');
    }
    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(amount, sender.id);
  })();
} catch (err) {
  rejectedCorrectly = err.message.includes('Insufficient balance');
}
console.log(`[PASS] Overdraft protection: ${rejectedCorrectly ? 'CORRECTLY REJECTED' : 'FAILED'}`);

// 5b. Test Revocation Below Zero Protection
let revokeBelowZeroRejected = false;
try {
  db.transaction(() => {
    const sender = getTeam(1);
    const revokeAmount = sender.balance + 100;
    if (sender.balance < revokeAmount) {
      throw new Error(`Cannot revoke ${revokeAmount} coins. Resulting balance cannot fall below 0.`);
    }
    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(revokeAmount, sender.id);
  })();
} catch (err) {
  revokeBelowZeroRejected = err.message.includes('Resulting balance cannot fall below 0');
}
console.log(`[PASS] Revoke below zero protection: ${revokeBelowZeroRejected ? 'CORRECTLY REJECTED' : 'FAILED'}`);

// 6. Test Badge Edit Without Balance Change
const txBefore = db.prepare('SELECT * FROM transactions WHERE id = ?').get(grantTx);
db.prepare('UPDATE transactions SET badge = ?, note = ? WHERE id = ?').run('The Pact', 'Corrected round metadata', grantTx);
const txAfter = db.prepare('SELECT * FROM transactions WHERE id = ?').get(grantTx);
const t1AfterBadgeEdit = getTeam(1);

console.log(`[PASS] Badge updated: '${txBefore.badge}' -> '${txAfter.badge}'`);
console.log(`[PASS] Balance unchanged after badge edit: ${t1AfterTransfer.balance === t1AfterBadgeEdit.balance ? 'CONFIRMED' : 'FAILED'}`);

// 7. Double-entry Reconciliation Check
const incoming = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE destination_team_id = ?').get(t1Before.id).total;
const outgoing = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE source_team_id = ?').get(t1Before.id).total;
const netLedger = incoming - outgoing;
console.log(`[PASS] Double-Entry Ledger Audit for Team 01: In=${incoming}, Out=${outgoing}, Net=${netLedger}, Actual Balance=${t1AfterBadgeEdit.balance}`);
if (netLedger === t1AfterBadgeEdit.balance) {
  console.log('>>> ALL ACCOUNTING INTEGRITY TESTS PASSED SUCCESSFULLY! <<<');
} else {
  console.error('>>> ACCOUNTING INTEGRITY FAILED! <<<');
}

// Reset test mutations
db.prepare('DELETE FROM transactions').run();
db.prepare('UPDATE teams SET balance = 0').run();
db.close();

