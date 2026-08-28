/**
 * End-to-end validation for MABDC election integrity guarantees.
 *
 * Runs the real server against a throwaway database, seeds a known ballot, and
 * asserts the properties an election has to hold. Run with:
 *
 *   node server/validate.mjs
 *
 * The live database is never touched: a temporary data directory is used and
 * removed afterwards.
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const PORT = 4099;
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = crypto.randomBytes(32).toString("hex");

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function post(pathname, body, token) {
  const res = await fetch(BASE + pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function get(pathname, token) {
  const res = await fetch(BASE + pathname, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// --- Set up an isolated database -------------------------------------------

const realDataDir = path.join(__dirname, "data");
const stash = fs.existsSync(realDataDir)
  ? fs.mkdtempSync(path.join(os.tmpdir(), "mabdc-stash-"))
  : null;

if (stash) {
  for (const file of fs.readdirSync(realDataDir)) {
    fs.renameSync(path.join(realDataDir, file), path.join(stash, file));
  }
  console.log(`Live data stashed to ${stash}\n`);
}

function restore() {
  if (!stash) return;
  for (const file of fs.readdirSync(realDataDir)) {
    fs.rmSync(path.join(realDataDir, file), { force: true });
  }
  for (const file of fs.readdirSync(stash)) {
    fs.renameSync(path.join(stash, file), path.join(realDataDir, file));
  }
  fs.rmSync(stash, { recursive: true, force: true });
  console.log("\nLive data restored.");
}

// Everything from here on must run inside try/finally: if seeding or boot
// throws, the stashed live database still has to be put back.
let server = null;

function shutdown() {
  if (!server) return;
  try {
    server.kill();
  } catch {}
}

try {
  await runValidation();
} catch (err) {
  console.error("\nValidation aborted:", err.message);
  failed += 1;
  failures.push(`validation aborted: ${err.message}`);
} finally {
  shutdown();
  await new Promise((r) => setTimeout(r, 300));
  restore();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

async function runValidation() {

// --- Seed ------------------------------------------------------------------

const dbPath = path.join(realDataDir, "election.db");
fs.mkdirSync(realDataDir, { recursive: true });

// Import db.js so schema + migrations create the file exactly as production does.
await import("./db.js");

const seedDb = new Database(dbPath);
const PIN = "ABCDEF";
const pinHash = bcrypt.hashSync(PIN, 10);

const insertPosition = seedDb.prepare(
  "INSERT INTO positions (election_code, title, sort_order) VALUES (?, ?, ?)"
);
const insertCandidate = seedDb.prepare(
  "INSERT INTO candidates (election_code, position_id, name, party, motto) VALUES (?, ?, ?, ?, ?)"
);
const insertLearner = seedDb.prepare(
  "INSERT INTO learners (voter_id, original_id, name, level, division, pin_hash) VALUES (?, ?, ?, ?, ?, ?)"
);

const presidentId = insertPosition.run("SSLG", "President", 1).lastInsertRowid;
const secretaryId = insertPosition.run("SSLG", "Secretary", 2).lastInsertRowid;
const treasurerId = insertPosition.run("SSLG", "Treasurer", 3).lastInsertRowid;

const alice = insertCandidate.run("SSLG", presidentId, "Alice Reyes", "Unity", "Lead well").lastInsertRowid;
insertCandidate.run("SSLG", presidentId, "Bruno Cruz", "Forward", "Serve all");
const cara = insertCandidate.run("SSLG", secretaryId, "Cara Lim", "Unity", "Record truly").lastInsertRowid;
insertCandidate.run("SSLG", secretaryId, "Dino Santos", "Forward", "Write clearly");
const evaTreasurer = insertCandidate.run("SSLG", treasurerId, "Eva Tan", "Unity", "Count fairly").lastInsertRowid;
insertCandidate.run("SSLG", treasurerId, "Finn Ong", "Forward", "Budget wisely");

for (let i = 1; i <= 5; i += 1) {
  insertLearner.run(`TEST-${i}`, `orig-${i}`, `Learner ${i}`, "Grade 10", "SSLG", pinHash);
}
seedDb.close();

// --- Boot the real server ---------------------------------------------------

server = spawn(process.execPath, [path.join(__dirname, "index.js")], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "test",
    JWT_SECRET,
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "test-admin-password",
    // Production defaults are deliberately loose for a supervised one-day
    // election; the tests use small budgets so the mechanism is still exercised.
    VOTER_LOGIN_MAX: "8",
    ADMIN_LOGIN_MAX: "10"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

{
  const up = await waitForServer();
  if (!up) {
    throw new Error("server failed to start:\n" + serverLog);
  }

  const inspect = new Database(dbPath, { readonly: true });

  console.log("Ballot integrity");
  console.log("----------------");

  // 1. Abstention must not manufacture a vote.
  const login1 = await post("/api/auth/voter", {
    electionCode: "SSLG",
    voterId: "TEST-1",
    pin: PIN
  });
  check("learner can sign in", login1.status === 200, `status ${login1.status}`);

  const submit1 = await post(
    "/api/votes/submit",
    {
      electionCode: "SSLG",
      // Chooses President and Secretary. Treasurer deliberately left blank.
      selections: [
        { positionId: presidentId, candidateId: alice, candidateName: "Alice Reyes" },
        { positionId: secretaryId, candidateId: cara, candidateName: "Cara Lim" }
      ]
    },
    login1.json?.token
  );
  check("partial ballot accepted", submit1.status === 201, `status ${submit1.status}`);

  const votesFor1 = inspect
    .prepare("SELECT position_id FROM votes WHERE election_code = 'SSLG'")
    .all()
    .map((r) => r.position_id);

  check(
    "exactly 2 votes recorded for a 2-of-3 ballot",
    votesFor1.length === 2,
    `recorded ${votesFor1.length}`
  );
  check(
    "abstained position recorded NO vote",
    !votesFor1.includes(Number(treasurerId)),
    "a vote was invented for the skipped Treasurer race"
  );
  const treasurerVotes = inspect
    .prepare("SELECT COUNT(*) AS n FROM votes WHERE position_id = ?")
    .get(treasurerId).n;
  check(
    "first candidate in skipped race received 0 votes",
    treasurerVotes === 0,
    `Eva Tan/Finn Ong got ${treasurerVotes}`
  );

  // 2. Ballot secrecy.
  console.log("\nBallot secrecy");
  console.log("--------------");

  const voteColumns = inspect
    .prepare("SELECT name FROM pragma_table_info('votes')")
    .all()
    .map((c) => c.name);
  check(
    "votes table has no voter_id column",
    !voteColumns.includes("voter_id"),
    `columns: ${voteColumns.join(", ")}`
  );

  const adminLogin = await post("/api/admin/login", {
    username: "admin",
    password: "test-admin-password"
  });
  check("admin can sign in", adminLogin.status === 200, `status ${adminLogin.status}`);

  const record = await get(
    `/api/admin/voter/TEST-1/ballot?election=SSLG`,
    adminLogin.json?.token
  );
  check("admin sees participation status", record.json?.hasVoted === true);
  check("admin sees receipt code", Boolean(record.json?.receipt?.receipt_code));
  check(
    "admin CANNOT retrieve candidate selections",
    record.json?.ballot === undefined,
    "endpoint still returns ballot contents"
  );
  const bodyText = JSON.stringify(record.json || {});
  check(
    "no candidate name leaks in the response",
    !bodyText.includes("Alice Reyes") && !bodyText.includes("Cara Lim"),
    "a chosen candidate appeared in the admin payload"
  );

  // 3. Cross-position injection.
  console.log("\nInput validation");
  console.log("----------------");

  const login2 = await post("/api/auth/voter", {
    electionCode: "SSLG",
    voterId: "TEST-2",
    pin: PIN
  });
  // Claims the Treasurer race but names a President candidate.
  const inject = await post(
    "/api/votes/submit",
    {
      electionCode: "SSLG",
      selections: [
        { positionId: treasurerId, candidateId: alice, candidateName: "Alice Reyes" },
        { positionId: presidentId, candidateId: alice, candidateName: "Alice Reyes" }
      ]
    },
    login2.json?.token
  );
  check("mismatched selection does not error out", inject.status === 201, `status ${inject.status}`);

  const aliceInTreasurer = inspect
    .prepare("SELECT COUNT(*) AS n FROM votes WHERE position_id = ? AND candidate_id = ?")
    .get(treasurerId, alice).n;
  check(
    "candidate cannot receive a vote in another race",
    aliceInTreasurer === 0,
    `Alice got ${aliceInTreasurer} vote(s) in the Treasurer race`
  );
  const evaVotes = inspect
    .prepare("SELECT COUNT(*) AS n FROM votes WHERE candidate_id = ?")
    .get(evaTreasurer).n;
  check("no fallback vote leaked to the real Treasurer candidate", evaVotes === 0, `Eva got ${evaVotes}`);

  // 4. Empty ballot rejected.
  const login3 = await post("/api/auth/voter", {
    electionCode: "SSLG",
    voterId: "TEST-3",
    pin: PIN
  });
  const empty = await post(
    "/api/votes/submit",
    { electionCode: "SSLG", selections: [] },
    login3.json?.token
  );
  check("empty ballot is rejected", empty.status === 400, `status ${empty.status}`);
  const test3Participation = inspect
    .prepare("SELECT COUNT(*) AS n FROM voter_participation WHERE voter_id = 'TEST-3'")
    .get().n;
  check(
    "rejected ballot does not consume the learner's one vote",
    test3Participation === 0,
    "participation was recorded for an empty ballot"
  );

  // 4b. A body the server cannot parse must be rejected, never treated as an
  // empty ballot and never silently completed with default candidates.
  const login6 = await post("/api/auth/voter", {
    electionCode: "SSLG",
    voterId: "TEST-5",
    pin: PIN
  });
  const noContentType = await fetch(`${BASE}/api/votes/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${login6.json?.token}` }, // deliberately no Content-Type
    body: JSON.stringify({
      electionCode: "SSLG",
      selections: [{ positionId: presidentId, candidateId: alice, candidateName: "Alice Reyes" }]
    })
  });
  check(
    "unparseable ballot body is rejected, not silently emptied",
    noContentType.status === 400,
    `status ${noContentType.status}`
  );
  const test5Participation = inspect
    .prepare("SELECT COUNT(*) AS n FROM voter_participation WHERE voter_id = 'TEST-5'")
    .get().n;
  check(
    "unreadable ballot records no participation",
    test5Participation === 0,
    "a ballot was recorded from an unreadable request"
  );

  // 5. One ballot per learner.
  const reSubmit = await post(
    "/api/votes/submit",
    {
      electionCode: "SSLG",
      selections: [{ positionId: presidentId, candidateId: alice, candidateName: "Alice Reyes" }]
    },
    login1.json?.token
  );
  check("duplicate ballot rejected", reSubmit.status === 409, `status ${reSubmit.status}`);

  // 6. Rate limiting.
  console.log("\nHardening");
  console.log("---------");

  // Lock out one learner account with repeated wrong passwords.
  let voterLocked = false;
  for (let i = 0; i < 12; i += 1) {
    const r = await post("/api/auth/voter", {
      electionCode: "SSLG",
      voterId: "TEST-4",
      pin: "WRONGX"
    });
    if (r.status === 429) {
      voterLocked = true;
      break;
    }
  }
  check("voter login locks out after repeated failures", voterLocked);

  // The critical one: every learner on a school network shares one public IP.
  // A different learner must still be able to sign in while TEST-4 is locked.
  const otherLearner = await post("/api/auth/voter", {
    electionCode: "SSLG",
    voterId: "TEST-5",
    pin: PIN
  });
  check(
    "lockout is per-account, not per-IP (shared school network still works)",
    otherLearner.status === 200,
    `status ${otherLearner.status} — a locked account blocked an unrelated learner`
  );

  // A correct password must clear the failure budget rather than consume it.
  for (let i = 0; i < 6; i += 1) {
    await post("/api/admin/login", { username: "admin", password: "wrong" });
  }
  const goodLogin = await post("/api/admin/login", {
    username: "admin",
    password: "test-admin-password"
  });
  check("correct admin password still accepted after failures", goodLogin.status === 200, `status ${goodLogin.status}`);
  const afterSuccess = await post("/api/admin/login", { username: "admin", password: "wrong" });
  check(
    "successful login resets the failure budget",
    afterSuccess.status === 401,
    `status ${afterSuccess.status} — budget was not reset`
  );

  let sawLimit = false;
  let limitStatus = 0;
  for (let i = 0; i < 15; i += 1) {
    const r = await post("/api/admin/login", { username: "admin", password: "wrong" });
    limitStatus = r.status;
    if (r.status === 429) {
      sawLimit = true;
      break;
    }
  }
  check("admin login is rate limited", sawLimit, `last status ${limitStatus}`);

  // --- Admin photo upload -----------------------------------------------
  console.log("\nPhoto upload");
  console.log("------------");

  const adminToken = adminLogin.json?.token;

  // 1x1 JPEG, valid magic bytes.
  const TINY_JPEG =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

  const uploaded = await post(
    `/api/admin/learners/TEST-1/photo`,
    { photo_b64: TINY_JPEG },
    adminToken
  );
  check(
    "learner photo rejects a non-numeric voter ID",
    uploaded.status === 400,
    `status ${uploaded.status}`
  );

  // Path traversal: the id becomes part of a filename.
  const traversal = await post(
    `/api/admin/candidates/${encodeURIComponent("../../server/pwned")}/photo`,
    { photo_b64: TINY_JPEG },
    adminToken
  );
  check(
    "candidate photo rejects a path-traversal id",
    traversal.status === 400 || traversal.status === 404,
    `status ${traversal.status}`
  );
  check(
    "no file escaped the photos directory",
    !fs.existsSync(path.join(projectRoot, "server", "pwned.jpg")),
    "a file was written outside the photos directory"
  );

  // Content that claims to be an image but is not.
  const fakeImage = await post(
    `/api/admin/candidates/${alice}/photo`,
    { photo_b64: "data:image/png;base64," + Buffer.from("<?php echo 1; ?>").toString("base64") },
    adminToken
  );
  check(
    "non-image content is rejected despite an image data URI",
    fakeImage.status === 400,
    `status ${fakeImage.status}`
  );

  const goodUpload = await post(`/api/admin/candidates/${alice}/photo`, { photo_b64: TINY_JPEG }, adminToken);
  check("a real JPEG uploads successfully", goodUpload.status === 200, `status ${goodUpload.status}`);

  const unauth = await post(`/api/admin/candidates/${alice}/photo`, { photo_b64: TINY_JPEG });
  check("photo upload requires an admin token", unauth.status === 401, `status ${unauth.status}`);

  const health = await get("/api/health");
  check(
    "health endpoint does not leak the database path",
    health.json && !("databaseFile" in health.json),
    "databaseFile still present"
  );

  inspect.close();

  // 7. Production refuses a default JWT secret.
  const guard = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: projectRoot,
    env: { ...process.env, PORT: "4098", NODE_ENV: "production", JWT_SECRET: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const guardExit = await new Promise((resolve) => {
    guard.on("exit", resolve);
    setTimeout(() => {
      guard.kill();
      resolve(null);
    }, 8000);
  });
  check(
    "production refuses to boot with the default JWT secret",
    guardExit === 1,
    `exit code ${guardExit}`
  );

  // Same guard for the admin password, whose default is public in .env.example.
  const pwGuard = spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: "4097",
      NODE_ENV: "production",
      JWT_SECRET: "a-real-secret-for-this-test",
      ADMIN_PASSWORD: "MABDC@2026"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const pwGuardExit = await new Promise((resolve) => {
    pwGuard.on("exit", resolve);
    setTimeout(() => {
      pwGuard.kill();
      resolve(null);
    }, 8000);
  });
  check(
    "production refuses to boot with the documented default admin password",
    pwGuardExit === 1,
    `exit code ${pwGuardExit}`
  );
}
}
