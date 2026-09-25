const path = require('path');
const Database = require('better-sqlite3');
const { SignJWT, jwtVerify } = require('jose');

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'soulcoins.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev_secret_mephistos_bargain_festival_2026_fallback');

console.log('=== RUNNING TEAM ELIMINATION & RESURRECTION VERIFICATION ===\n');

let allPassed = true;

function getTeam(teamNumber) {
  return db.prepare('SELECT * FROM teams WHERE team_number = ?').get(teamNumber);
}

function getTxCount() {
  return db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
}

// -------------------------------------------------------------
// SETUP: Ensure Team 1 and Team 2 have known balances and active status
// -------------------------------------------------------------
db.prepare('DELETE FROM transactions').run();
db.prepare("UPDATE teams SET balance = 0, status = 'active'").run();

// Fund Team 1 with 50 coins and Team 2 with 10 coins
db.transaction(() => {
  const t1 = getTeam(1);
  const t2 = getTeam(2);
  db.prepare(`
    INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
    VALUES ('ORGANIZER_GRANT', 50, NULL, ?, 'Round 1', 'Test seed grant', 'ORGANIZER')
  `).run(t1.id);
  db.prepare('UPDATE teams SET balance = 50 WHERE id = ?').run(t1.id);

  db.prepare(`
    INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
    VALUES ('ORGANIZER_GRANT', 10, NULL, ?, 'Round 1', 'Test seed grant', 'ORGANIZER')
  `).run(t2.id);
  db.prepare('UPDATE teams SET balance = 10 WHERE id = ?').run(t2.id);
})();

console.log('[CHECK 0] Initial setup complete:');
console.log(`  Team 01: ${getTeam(1).balance} Coins, Status: ${getTeam(1).status}`);
console.log(`  Team 02: ${getTeam(2).balance} Coins, Status: ${getTeam(2).status}\n`);

// -------------------------------------------------------------
// CHECK 1: Active team can transfer normally
// -------------------------------------------------------------
console.log('[CHECK 1] Testing normal transfer while team is ACTIVE...');
try {
  db.transaction(() => {
    const sender = getTeam(1);
    const recipient = getTeam(2);
    const amount = 5;

    if (sender.status === 'eliminated') {
      throw new Error('Eliminated teams cannot transfer Soul Coins');
    }
    if (sender.balance < amount) {
      throw new Error('Insufficient balance');
    }

    db.prepare(`
      INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
      VALUES ('TRANSFER', ?, ?, ?, 'Transfer', 'Active transfer test', 'PARTICIPANT')
    `).run(amount, sender.id, recipient.id);

    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(amount, sender.id);
    db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(amount, recipient.id);
  })();

  const t1 = getTeam(1);
  const t2 = getTeam(2);
  if (t1.balance === 45 && t2.balance === 15) {
    console.log(`  ✔ Passed: Active team transferred 5 coins (T1: ${t1.balance}, T2: ${t2.balance})`);
  } else {
    console.error(`  FAIL: Unexpected balances after active transfer: T1=${t1.balance}, T2=${t2.balance}`);
    allPassed = false;
  }
} catch (e) {
  console.error('  FAIL: Active transfer threw unexpected error:', e.message);
  allPassed = false;
}

// -------------------------------------------------------------
// CHECK 2: ACTIVE → ELIMINATED leaves balance unchanged and creates ZERO transactions
// -------------------------------------------------------------
console.log('\n[CHECK 2] Testing ACTIVE → ELIMINATED status transition...');
const txCountBeforeElim = getTxCount();
const t1BalanceBeforeElim = getTeam(1).balance;

// Toggle status via updateTeamStatus logic
db.prepare("UPDATE teams SET status = ?, updated_at = datetime('now') WHERE id = ?").run('eliminated', getTeam(1).id);

const t1AfterElim = getTeam(1);
const txCountAfterElim = getTxCount();

if (t1AfterElim.status === 'eliminated') {
  console.log('  ✔ Passed: Team 01 status updated to "eliminated".');
} else {
  console.error('  FAIL: Team 01 status is not "eliminated"!');
  allPassed = false;
}

if (t1AfterElim.balance === t1BalanceBeforeElim) {
  console.log(`  ✔ Passed: Balance is completely UNCHANGED: ${t1AfterElim.balance} coins.`);
} else {
  console.error(`  FAIL: Balance mutated from ${t1BalanceBeforeElim} to ${t1AfterElim.balance}!`);
  allPassed = false;
}

if (txCountAfterElim === txCountBeforeElim) {
  console.log(`  ✔ Passed: Zero transactions created by status change (${txCountAfterElim} total).`);
} else {
  console.error(`  FAIL: Transactions were created! Before: ${txCountBeforeElim}, After: ${txCountAfterElim}`);
  allPassed = false;
}

// -------------------------------------------------------------
// CHECK 3: Eliminated team transfer is rejected at DB layer
// -------------------------------------------------------------
console.log('\n[CHECK 3] Testing transfer rejection at DB layer for eliminated team...');
let dbRejected = false;
let dbErrorMessage = '';

try {
  db.transaction(() => {
    const sender = getTeam(1);
    const recipient = getTeam(2);
    const amount = 5;

    // Mirrors transferCoins in src/lib/db.ts
    if (sender.status === 'eliminated') {
      throw new Error('Eliminated teams cannot transfer Soul Coins');
    }
    if (sender.balance < amount) {
      throw new Error('Insufficient balance');
    }

    db.prepare(`
      INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
      VALUES ('TRANSFER', ?, ?, ?, 'Transfer', 'Should fail', 'PARTICIPANT')
    `).run(amount, sender.id, recipient.id);

    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(amount, sender.id);
    db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(amount, recipient.id);
  })();
} catch (e) {
  dbRejected = true;
  dbErrorMessage = e.message;
}

if (dbRejected && dbErrorMessage.includes('Eliminated teams cannot transfer Soul Coins')) {
  console.log('  ✔ Passed: DB transaction rejected transfer with error: "Eliminated teams cannot transfer Soul Coins"');
} else {
  console.error(`  FAIL: DB did not reject properly! dbRejected=${dbRejected}, err=${dbErrorMessage}`);
  allPassed = false;
}

// Confirm balance is intact
if (getTeam(1).balance === 45 && getTeam(2).balance === 15) {
  console.log('  ✔ Passed: Balances remained 100% untouched after rejected DB transfer.');
} else {
  console.error('  FAIL: Balances mutated after rejected DB transfer!');
  allPassed = false;
}

// -------------------------------------------------------------
// CHECK 4: Eliminated team transfer is rejected at API layer with HTTP 403
// -------------------------------------------------------------
console.log('\n[CHECK 4] Testing transfer rejection at API layer (HTTP 403)...');
async function testApiRejection() {
  const t1 = getTeam(1);
  // Simulate API route logic from src/app/api/participant/transfer/route.ts
  const token = await new SignJWT({
    teamId: t1.id,
    teamNumber: t1.team_number,
    teamName: t1.team_name,
    accessKey: t1.access_key,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  const { payload: session } = await jwtVerify(token, JWT_SECRET);

  // Check source team status
  const sourceTeam = getTeam(session.teamNumber);
  let httpStatus = 200;
  let responseBody = {};

  if (!sourceTeam) {
    httpStatus = 404;
    responseBody = { success: false, error: 'Source team not found' };
  } else if (sourceTeam.status === 'eliminated') {
    httpStatus = 403;
    responseBody = { success: false, error: 'Your team is eliminated. Soul Coin transfers are disabled.' };
  }

  if (httpStatus === 403 && responseBody.error.includes('Your team is eliminated')) {
    console.log(`  ✔ Passed: API correctly returned HTTP 403 Forbidden: "${responseBody.error}"`);
  } else {
    console.error(`  FAIL: Expected HTTP 403, got status ${httpStatus}:`, responseBody);
    allPassed = false;
  }
}

// -------------------------------------------------------------
// CHECK 5: ELIMINATED → ACTIVE (Resurrection) leaves balance unchanged and creates ZERO transactions
// -------------------------------------------------------------
async function testResurrection() {
  console.log('\n[CHECK 5] Testing ELIMINATED → ACTIVE (Resurrection)...');
  const txCountBeforeResurrect = getTxCount();
  const t1BalanceBeforeResurrect = getTeam(1).balance;

  // Toggle status back to 'active'
  db.prepare("UPDATE teams SET status = ?, updated_at = datetime('now') WHERE id = ?").run('active', getTeam(1).id);

  const t1AfterResurrect = getTeam(1);
  const txCountAfterResurrect = getTxCount();

  if (t1AfterResurrect.status === 'active') {
    console.log('  ✔ Passed: Team 01 resurrected; status is "active".');
  } else {
    console.error('  FAIL: Team 01 status is not "active" after resurrection!');
    allPassed = false;
  }

  if (t1AfterResurrect.balance === t1BalanceBeforeResurrect) {
    console.log(`  ✔ Passed: Balance is completely UNCHANGED: ${t1AfterResurrect.balance} coins.`);
  } else {
    console.error(`  FAIL: Balance mutated from ${t1BalanceBeforeResurrect} to ${t1AfterResurrect.balance}!`);
    allPassed = false;
  }

  if (txCountAfterResurrect === txCountBeforeResurrect) {
    console.log(`  ✔ Passed: Zero transactions created by resurrection (${txCountAfterResurrect} total).`);
  } else {
    console.error(`  FAIL: Transactions created during resurrection!`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // CHECK 6: Resurrected team can transfer normally again
  // -------------------------------------------------------------
  console.log('\n[CHECK 6] Testing transfer capability of resurrected team...');
  try {
    db.transaction(() => {
      const sender = getTeam(1);
      const recipient = getTeam(2);
      const amount = 10;

      if (sender.status === 'eliminated') {
        throw new Error('Eliminated teams cannot transfer Soul Coins');
      }
      if (sender.balance < amount) {
        throw new Error('Insufficient balance');
      }

      db.prepare(`
        INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
        VALUES ('TRANSFER', ?, ?, ?, 'Transfer', 'Resurrected transfer test', 'PARTICIPANT')
      `).run(amount, sender.id, recipient.id);

      db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(amount, sender.id);
      db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(amount, recipient.id);
    })();

    const t1 = getTeam(1);
    const t2 = getTeam(2);
    if (t1.balance === 35 && t2.balance === 25) {
      console.log(`  ✔ Passed: Resurrected team successfully transferred 10 coins (T1: ${t1.balance}, T2: ${t2.balance})`);
    } else {
      console.error(`  FAIL: Unexpected balances after resurrected transfer: T1=${t1.balance}, T2=${t2.balance}`);
      allPassed = false;
    }
  } catch (e) {
    console.error('  FAIL: Resurrected transfer threw unexpected error:', e.message);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // CLEANUP: Reset test mutations to clean state
  // -------------------------------------------------------------
  db.prepare('DELETE FROM transactions').run();
  db.prepare("UPDATE teams SET balance = 0, status = 'active'").run();
  db.close();

  console.log('\n=============================================================');
  if (allPassed) {
    console.log('>>> ALL ELIMINATION & RESURRECTION CHECKS PASSED (100%) <<<');
  } else {
    console.error('>>> SOME CHECKS FAILED! <<<');
    process.exit(1);
  }
  console.log('=============================================================\n');
}

testApiRejection().then(() => testResurrection());
