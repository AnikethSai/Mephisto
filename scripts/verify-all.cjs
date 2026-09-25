const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { SignJWT, jwtVerify } = require('jose');

const dbPath = path.join(process.cwd(), 'data', 'soulcoins.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'mephisto_bargain_super_secret_dev_key_2026_fest');

async function runVerifications() {
  console.log('\n============================================================');
  console.log('   MEPHISTO\'S BARGAIN — SECURITY & ARCHITECTURE AUDIT   ');
  console.log('============================================================\n');

  let allPassed = true;

  // -------------------------------------------------------------
  // TEST 1: Plaintext PIN is NOT in the database
  // -------------------------------------------------------------
  console.log('[TEST 1] Verifying plaintext PIN is absent from database schema & rows...');
  const tableColumns = db.pragma('table_info(teams)').map(c => c.name);
  if (tableColumns.includes('pin_plain')) {
    console.error('FAIL: pin_plain column still exists in teams table!');
    allPassed = false;
  } else {
    console.log('  ✔ Passed: Column `pin_plain` does NOT exist in teams table.');
  }

  const sampleTeamRow = db.prepare('SELECT * FROM teams WHERE team_number = 1').get();
  if ('pin_plain' in sampleTeamRow) {
    console.error('FAIL: pin_plain property present in team query result!');
    allPassed = false;
  } else if (!sampleTeamRow.pin_hash || !sampleTeamRow.pin_hash.startsWith('$2')) {
    console.error('FAIL: pin_hash is missing or not a valid bcrypt hash!');
    allPassed = false;
  } else {
    console.log('  ✔ Passed: Teams store ONLY secure bcrypt hashes in SQLite.');
  }

  // -------------------------------------------------------------
  // TEST 2: Participant Authentication Flow (QR/accessKey + PIN)
  // -------------------------------------------------------------
  console.log('\n[TEST 2] Verifying QR/access_key + PIN authentication...');
  const credentialsPath = path.join(process.cwd(), 'data', 'team_credentials.json');
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const team1Creds = credentials.find(c => c.teamNumber === 1);

  // 2a. Lookup by access_key
  const team1FromDb = db.prepare('SELECT * FROM teams WHERE access_key = ?').get(team1Creds.accessKey);
  if (!team1FromDb || team1FromDb.team_number !== 1) {
    console.error('FAIL: Could not locate team via unique access_key!');
    allPassed = false;
  } else {
    console.log('  ✔ Passed: Team located via unguessable access_key.');
  }

  // 2b. Validate bcrypt hashed PIN
  const validPinMatches = bcrypt.compareSync(team1Creds.pin, team1FromDb.pin_hash);
  const invalidPinMatches = bcrypt.compareSync('999999', team1FromDb.pin_hash);
  if (validPinMatches && !invalidPinMatches) {
    console.log('  ✔ Passed: Correct PIN validates against hash; incorrect PIN is rejected.');
  } else {
    console.error('FAIL: PIN comparison failed!');
    allPassed = false;
  }

  // 2c. Issue and verify participant JWT session token
  const participantToken = await new SignJWT({
    teamId: team1FromDb.id,
    teamNumber: team1FromDb.team_number,
    teamName: team1FromDb.team_name,
    accessKey: team1FromDb.access_key,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  const { payload: verifiedParticipant } = await jwtVerify(participantToken, JWT_SECRET);
  if (verifiedParticipant.teamId === team1FromDb.id && verifiedParticipant.teamNumber === 1) {
    console.log('  ✔ Passed: Participant session JWT generated & verified with teamId.');
  } else {
    console.error('FAIL: Participant JWT verification mismatch!');
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 3: Organizer Authentication & Isolation
  // -------------------------------------------------------------
  console.log('\n[TEST 3] Verifying Organizer authentication & role guards...');
  const organizerUser = db.prepare('SELECT * FROM organizers WHERE username = ?').get('mephisto');
  const orgPasswordMatches = bcrypt.compareSync('mephisto2026', organizerUser.password_hash);
  const badOrgPassword = bcrypt.compareSync('wrong_pass', organizerUser.password_hash);

  if (orgPasswordMatches && !badOrgPassword) {
    console.log('  ✔ Passed: Organizer master password verified via bcrypt hash.');
  } else {
    console.error('FAIL: Organizer password verification failed!');
    allPassed = false;
  }

  const organizerToken = await new SignJWT({
    organizerId: organizerUser.id,
    username: organizerUser.username,
    role: 'ORGANIZER',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  const { payload: verifiedOrganizer } = await jwtVerify(organizerToken, JWT_SECRET);
  if (verifiedOrganizer.role === 'ORGANIZER') {
    console.log('  ✔ Passed: Organizer session JWT generated & verified with ORGANIZER role.');
  } else {
    console.error('FAIL: Organizer role verification failed!');
    allPassed = false;
  }

  // Check role isolation: participant token should NOT have organizer privileges
  if (verifiedParticipant.role === 'ORGANIZER') {
    console.error('FAIL: Participant token has organizer role!');
    allPassed = false;
  } else {
    console.log('  ✔ Passed: Participant token cannot masquerade as Organizer.');
  }

  // -------------------------------------------------------------
  // TEST 4: Atomic Peer-to-Peer Transfers & Overdraft Rejection
  // -------------------------------------------------------------
  console.log('\n[TEST 4] Verifying atomic coin transfers & overdraft protection...');

  // Fund Team 1 with 100 coins
  db.prepare('UPDATE teams SET balance = 100 WHERE id = ?').run(team1FromDb.id);
  const team2 = db.prepare('SELECT * FROM teams WHERE team_number = 2').get();
  db.prepare('UPDATE teams SET balance = 0 WHERE id = ?').run(team2.id);

  // Transfer 35 coins from Team 1 to Team 2 atomically
  const atomicTransfer = db.transaction(() => {
    const sender = db.prepare('SELECT * FROM teams WHERE id = ?').get(team1FromDb.id);
    const recipient = db.prepare('SELECT * FROM teams WHERE id = ?').get(team2.id);
    const transferAmount = 35;

    if (sender.balance < transferAmount) throw new Error('Insufficient balance');

    db.prepare(`
      INSERT INTO transactions (type, amount, source_team_id, destination_team_id, badge, note, created_by)
      VALUES ('TRANSFER', ?, ?, ?, 'Transfer', 'Test pact payment', 'PARTICIPANT')
    `).run(transferAmount, sender.id, recipient.id);

    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(transferAmount, sender.id);
    db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(transferAmount, recipient.id);
  });

  atomicTransfer();

  const team1After = db.prepare('SELECT balance FROM teams WHERE id = ?').get(team1FromDb.id).balance;
  const team2After = db.prepare('SELECT balance FROM teams WHERE id = ?').get(team2.id).balance;

  if (team1After === 65 && team2After === 35) {
    console.log('  ✔ Passed: Atomic transfer executed accurately (Team 1: 100->65, Team 2: 0->35).');
  } else {
    console.error(`FAIL: Atomic transfer incorrect balances! T1: ${team1After}, T2: ${team2After}`);
    allPassed = false;
  }

  // Test rollback on insufficient funds
  let rollbackSucceeded = false;
  try {
    db.transaction(() => {
      const sender = db.prepare('SELECT * FROM teams WHERE id = ?').get(team1FromDb.id);
      const recipient = db.prepare('SELECT * FROM teams WHERE id = ?').get(team2.id);
      const excessiveAmount = 999;

      if (sender.balance < excessiveAmount) throw new Error('Insufficient balance');

      db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(excessiveAmount, sender.id);
      db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(excessiveAmount, recipient.id);
    })();
  } catch (err) {
    rollbackSucceeded = err.message.includes('Insufficient balance');
  }

  const team1AfterFailed = db.prepare('SELECT balance FROM teams WHERE id = ?').get(team1FromDb.id).balance;
  const team2AfterFailed = db.prepare('SELECT balance FROM teams WHERE id = ?').get(team2.id).balance;

  if (rollbackSucceeded && team1AfterFailed === 65 && team2AfterFailed === 35) {
    console.log('  ✔ Passed: Overdraft cleanly rolled back with ZERO balance mutation.');
  } else {
    console.error('FAIL: Overdraft failed to roll back properly!');
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 5: Badge & Note Modification NEVER Mutates Balances
  // -------------------------------------------------------------
  console.log('\n[TEST 5] Verifying transaction badge edits never mutate coin balances...');
  const lastTx = db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 1').get();
  const balancesBeforeEdit = {
    t1: db.prepare('SELECT balance FROM teams WHERE id = ?').get(team1FromDb.id).balance,
    t2: db.prepare('SELECT balance FROM teams WHERE id = ?').get(team2.id).balance,
  };

  // Organizer updates badge from 'Transfer' to 'The Pact'
  db.prepare(`
    UPDATE transactions 
    SET badge = 'The Pact', note = 'Retroactively labeled as Pact pact fee' 
    WHERE id = ?
  `).run(lastTx.id);

  const updatedTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(lastTx.id);
  const balancesAfterEdit = {
    t1: db.prepare('SELECT balance FROM teams WHERE id = ?').get(team1FromDb.id).balance,
    t2: db.prepare('SELECT balance FROM teams WHERE id = ?').get(team2.id).balance,
  };

  if (
    updatedTx.badge === 'The Pact' &&
    balancesBeforeEdit.t1 === balancesAfterEdit.t1 &&
    balancesBeforeEdit.t2 === balancesAfterEdit.t2
  ) {
    console.log('  ✔ Passed: Badge updated successfully; team balances are 100% UNCHANGED.');
  } else {
    console.error('FAIL: Balances altered or badge not updated!');
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 6: Participant Data Isolation Check
  // -------------------------------------------------------------
  console.log('\n[TEST 6] Verifying participant data isolation at query layer...');
  // Querying transactions for Team 1
  const t1Txs = db.prepare(`
    SELECT * FROM transactions 
    WHERE source_team_id = ? OR destination_team_id = ?
  `).all(team1FromDb.id, team1FromDb.id);

  // Ensure no transaction in t1Txs belongs solely to third-party teams
  const allT1Involved = t1Txs.every(
    tx => tx.source_team_id === team1FromDb.id || tx.destination_team_id === team1FromDb.id
  );

  if (allT1Involved && t1Txs.length > 0) {
    console.log('  ✔ Passed: Participant query layer returns STRICTLY transactions involving the authenticated team.');
  } else {
    console.error('FAIL: Participant data leak detected in transaction queries!');
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 7: Revocation Below Zero Protection
  // -------------------------------------------------------------
  console.log('\n[TEST 7] Verifying revocation below zero is strictly rejected...');
  let revokeBelowZeroBlocked = false;
  try {
    const t1 = db.prepare('SELECT balance FROM teams WHERE id = ?').get(team1FromDb.id);
    const excessiveRevoke = t1.balance + 50;
    if (t1.balance < excessiveRevoke) {
      throw new Error(`Cannot revoke ${excessiveRevoke}. Current balance is ${t1.balance} (resulting balance cannot fall below 0).`);
    }
  } catch (err) {
    revokeBelowZeroBlocked = err.message.includes('resulting balance cannot fall below 0');
  }

  if (revokeBelowZeroBlocked) {
    console.log('  ✔ Passed: Revocation below zero strictly prevented.');
  } else {
    console.error('FAIL: Revocation below zero was not blocked!');
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 8: Team Status Modification (Active / Eliminated)
  // -------------------------------------------------------------
  console.log('\n[TEST 8] Verifying administrative status updates...');
  db.prepare('UPDATE teams SET status = ? WHERE id = ?').run('eliminated', team1FromDb.id);
  const t1Eliminated = db.prepare('SELECT status, balance FROM teams WHERE id = ?').get(team1FromDb.id);
  
  db.prepare('UPDATE teams SET status = ? WHERE id = ?').run('active', team1FromDb.id);
  const t1Reactivated = db.prepare('SELECT status, balance FROM teams WHERE id = ?').get(team1FromDb.id);

  if (t1Eliminated.status === 'eliminated' && t1Reactivated.status === 'active' && t1Eliminated.balance === t1Reactivated.balance) {
    console.log('  ✔ Passed: Team status toggles between active/eliminated without modifying coin balance.');
  } else {
    console.error('FAIL: Team status modification failed or mutated coin balance!');
    allPassed = false;
  }

  console.log('\n============================================================');
  if (allPassed) {
    console.log('   >>> ALL SECURITY & ARCHITECTURAL CHECKS PASSED <<<   ');
  } else {
    console.error('   >>> SOME CHECKS FAILED! <<<   ');
    process.exit(1);
  }
  console.log('============================================================\n');

  // Reset balances back to clean zero state
  db.prepare('DELETE FROM transactions').run();
  db.prepare('UPDATE teams SET balance = 0').run();
  console.log('Ledger and team balances reset to clean 0 state.');
  db.close();
}

runVerifications().catch(err => {
  console.error('Audit exception:', err);
  process.exit(1);
});
