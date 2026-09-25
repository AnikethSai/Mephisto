const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const dbPath = process.env.DATABASE_PATH || './data/soulcoins.db';
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
const dir = path.dirname(resolvedPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure tables exist
const schemaPath = path.join(__dirname, '../src/lib/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

console.log('[SEED] Seeding database for Mephisto\'s Bargain...');

// 1. Organizer setup
const organizerPassword = process.env.ORGANIZER_PASSWORD || 'mephisto2026';
const orgSalt = bcrypt.genSaltSync(10);
const orgHash = bcrypt.hashSync(organizerPassword, orgSalt);

const upsertOrg = db.prepare(`
  INSERT INTO organizers (username, password_hash)
  VALUES ('mephisto', ?)
  ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash
`);
upsertOrg.run(orgHash);
console.log(`[SEED] Organizer account 'mephisto' configured (Password: ${organizerPassword})`);

// 2. 27 Teams setup
const existingCount = db.prepare('SELECT COUNT(*) as count FROM teams').get().count;

if (existingCount === 0) {
  console.log('[SEED] Creating 27 teams...');
  const insertTeam = db.prepare(`
    INSERT INTO teams (team_number, team_name, access_key, pin_hash, balance, status)
    VALUES (?, ?, ?, ?, 0, 'active')
  `);

  const teamsExport = [];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const seedTransaction = db.transaction(() => {
    for (let i = 1; i <= 27; i++) {
      const teamNumber = i;
      const paddedNum = String(i).padStart(2, '0');
      const teamName = `Team ${paddedNum}`;
      
      const accessKey = crypto.randomBytes(16).toString('hex');
      const pinPlain = String(1000 + Math.floor(Math.random() * 9000));
      const pinSalt = bcrypt.genSaltSync(10);
      const pinHash = bcrypt.hashSync(pinPlain, pinSalt);

      insertTeam.run(teamNumber, teamName, accessKey, pinHash);

      teamsExport.push({
        teamNumber,
        teamName,
        accessKey,
        pin: pinPlain,
        accessUrl: `${baseUrl}/t/${accessKey}`,
      });
    }
  });

  seedTransaction();

  const exportPath = path.join(dir, 'team_credentials.json');
  fs.writeFileSync(exportPath, JSON.stringify(teamsExport, null, 2), 'utf8');
  console.log(`[SEED] 27 teams created successfully!`);
  console.log(`[SEED] Credentials exported to: ${exportPath}`);
} else {
  console.log(`[SEED] Teams already exist (${existingCount} teams found). Skipping team recreation.`);
}

console.log('[SEED] Finished database seeding.');
db.close();
