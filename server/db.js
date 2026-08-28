import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "election.db");
export const dbPathForDisplay = dbPath;
export const db = new Database(dbPath);

try {
  db.exec("ALTER TABLE voter_participation ADD COLUMN ballot_token TEXT;");
} catch (e) {}

try {
  db.exec("ALTER TABLE learners ADD COLUMN password_plain TEXT;");
} catch (e) {}

// Ballot secrecy migration.
//
// Earlier builds stamped votes.voter_id on every row, which defeated the
// anonymous ballot_token design and let the admin dashboard reconstruct any
// learner's ballot. Anonymise existing rows first, then remove the column so
// nothing can repopulate it. NULL-ing runs first because it still protects the
// data if DROP COLUMN is unavailable on an older SQLite.
const votesHasVoterId = db
  .prepare("SELECT COUNT(*) AS n FROM pragma_table_info('votes') WHERE name = 'voter_id'")
  .get().n > 0;

if (votesHasVoterId) {
  const orphaned = db.prepare("SELECT COUNT(*) AS n FROM votes WHERE voter_id IS NOT NULL").get().n;
  db.exec("UPDATE votes SET voter_id = NULL;");
  try {
    db.exec("ALTER TABLE votes DROP COLUMN voter_id;");
    console.log(`[MIGRATION] Ballot secrecy: anonymised ${orphaned} vote(s), dropped votes.voter_id.`);
  } catch (e) {
    console.warn(
      `[MIGRATION] Ballot secrecy: anonymised ${orphaned} vote(s); could not drop votes.voter_id (${e.message}). Column retained but left NULL.`
    );
  }
}

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS elections (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    division TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_code TEXT NOT NULL,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (election_code) REFERENCES elections(code) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_code TEXT NOT NULL,
    position_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    party TEXT NOT NULL,
    motto TEXT NOT NULL,
    photo_url TEXT,
    FOREIGN KEY (election_code) REFERENCES elections(code) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS learners (
    voter_id TEXT PRIMARY KEY,
    original_id TEXT,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    division TEXT NOT NULL CHECK (division IN ('SELG', 'SSLG')),
    pin_hash TEXT NOT NULL,
    password_plain TEXT
  );

  CREATE TABLE IF NOT EXISTS voter_participation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id TEXT NOT NULL,
    election_code TEXT NOT NULL,
    receipt_code TEXT NOT NULL UNIQUE,
    submitted_at TEXT NOT NULL,
    ballot_token TEXT,
    UNIQUE (voter_id, election_code),
    FOREIGN KEY (voter_id) REFERENCES learners(voter_id),
    FOREIGN KEY (election_code) REFERENCES elections(code)
  );

  -- No voter_id here, deliberately. A vote row must never be traceable to a
  -- learner; the only link is the random ballot_token, which is not exposed.
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ballot_token TEXT NOT NULL,
    election_code TEXT NOT NULL,
    position_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY (election_code) REFERENCES elections(code),
    FOREIGN KEY (position_id) REFERENCES positions(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
  );

  CREATE INDEX IF NOT EXISTS idx_votes_election ON votes(election_code);
  CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_participation_election ON voter_participation(election_code);
`);

const electionSeeds = [
  ["SELG", "Supreme Elementary Learner Government", "Elementary"],
  ["SSLG", "Supreme Secondary Learner Government", "Secondary"]
];

const seed = db.transaction(() => {
  const electionInsert = db.prepare(
    "INSERT OR IGNORE INTO elections (code, name, division, active) VALUES (?, ?, ?, 1)"
  );
  for (const row of electionSeeds) electionInsert.run(...row);
});

seed();

export function getBallot(electionCode) {
  const election = db
    .prepare("SELECT code, name, division, active FROM elections WHERE code = ?")
    .get(electionCode);

  if (!election) return null;

  const positions = db
    .prepare(`
      SELECT id, title, sort_order
      FROM positions
      WHERE election_code = ?
      ORDER BY sort_order
    `)
    .all(electionCode);

  const candidateStmt = db.prepare(`
    SELECT id, name, party, motto, photo_url
    FROM candidates
    WHERE election_code = ? AND position_id = ?
    ORDER BY id
  `);

  return {
    election,
    positions: positions.map((position) => ({
      ...position,
      candidates: candidateStmt.all(electionCode, position.id)
    }))
  };
}
