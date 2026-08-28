import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, getBallot, dbPathForDisplay } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "development-only-change-me";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MABDC@2026";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Caddy terminates TLS and proxies to this server, so without this every
// request would carry the proxy's IP and the per-IP rate limits below would be
// shared by the whole school. One hop only: Caddy is the sole trusted proxy.
app.set("trust proxy", 1);

// Refuse to run a real election on forgeable tokens. With the fallback secret
// anyone can mint an admin JWT, so this is a hard stop rather than a warning.
if (IS_PRODUCTION && JWT_SECRET === "development-only-change-me") {
  console.error(
    "FATAL: JWT_SECRET is unset in production. Set a long random JWT_SECRET in .env before serving an election."
  );
  process.exit(1);
}

// The fallback admin password is published in this repository's .env.example,
// so running with it in production would leave the dashboard open to anyone who
// has read the source.
if (IS_PRODUCTION && ADMIN_PASSWORD === "MABDC@2026") {
  console.error(
    "FATAL: ADMIN_PASSWORD is still the documented default. Set a unique ADMIN_PASSWORD in .env before serving an election."
  );
  process.exit(1);
}

// Browsers only need to call this API from the pages this server itself serves,
// so same-origin requests (no Origin header) and an explicit allowlist are
// enough. A wide-open CORS policy would let any site drive an authenticated
// learner's session.
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // same-origin / curl / server-to-server
      if (!IS_PRODUCTION) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Origin not allowed by CORS policy."));
    }
  })
);
app.use(express.json({ limit: "1mb" }));

/**
 * Fixed-window rate limiter, in-process and dependency-free.
 *
 * Both login routes accept short credentials (learner passcodes especially), so
 * without a limit they are trivially brute-forceable over a school network.
 * Counters live in memory: a restart clears them, which is acceptable here
 * because the server is a single long-running process.
 */
function rateLimit({ windowMs, max, message, keyGenerator }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Drop expired counters periodically so the map cannot grow unbounded over a
  // long election day. unref() keeps the timer from holding the process open.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator ? keyGenerator(req) : req.ip || req.socket.remoteAddress || "unknown";
    const entry = hits.get(key);

    if (entry && now <= entry.resetAt && entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message, retryAfterSeconds: retryAfter });
    }

    // Only *failed* attempts count against the budget, and a success clears it.
    // Counting successes would punish normal use: a learner signing in, or an
    // administrator who mistyped once and then got it right.
    res.on("finish", () => {
      const succeeded = res.statusCode < 400;
      if (succeeded) {
        hits.delete(key);
        return;
      }
      const current = hits.get(key);
      if (!current || Date.now() > current.resetAt) {
        hits.set(key, { count: 1, resetAt: Date.now() + windowMs });
      } else {
        current.count += 1;
      }
    });

    next();
  };
}

// This runs a supervised, single-day school election, so the limits below are
// deliberately loose: they exist to stop an automated password grind, not to
// police people in the room. A learner or teacher who keeps mistyping should
// never be locked out. Tune without rebuilding via the env vars, or set
// RATE_LIMITS_ENABLED=false to switch them off entirely for election day.
const RATE_LIMITS_ENABLED = String(process.env.RATE_LIMITS_ENABLED || "true") !== "false";
const VOTER_LOGIN_MAX = Number(process.env.VOTER_LOGIN_MAX || 40);
const ADMIN_LOGIN_MAX = Number(process.env.ADMIN_LOGIN_MAX || 60);

const passThrough = (_req, _res, next) => next();

// Keyed on the learner account being targeted, NOT the client IP. Every learner
// on the school network shares one public IP, so an IP-keyed limit would lock
// out the whole school partway through election day. Per-account still stops
// someone grinding through passwords for a specific learner.
const voterLoginLimiter = RATE_LIMITS_ENABLED
  ? rateLimit({
      windowMs: 10 * 60 * 1000,
      max: VOTER_LOGIN_MAX,
      keyGenerator: (req) => {
        const voterId = String(req.body?.voterId || "").trim().toLowerCase();
        return voterId ? `voter:${voterId}` : `ip:${req.ip || "unknown"}`;
      },
      message: "Too many failed sign-in attempts for this Voter ID. Please see your teacher."
    })
  : passThrough;

// There is only one administrator account, so IP keying is right here: it is the
// attacker's address we want to slow down.
const adminLoginLimiter = RATE_LIMITS_ENABLED
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: ADMIN_LOGIN_MAX,
      message: "Too many failed administrator sign-in attempts. Please wait before trying again."
    })
  : passThrough;

/** Constant-time string comparison so credentials cannot be recovered by timing. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signToken(payload, expiresIn = "8h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function readBearer(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function requireRole(role) {
  return (req, res, next) => {
    const token = readBearer(req);
    if (!token) return res.status(401).json({ error: "Authentication required." });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role !== role) {
        return res.status(403).json({ error: "You do not have permission for this action." });
      }
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
  };
}

function normalizeElection(value) {
  const code = String(value || "").toUpperCase();
  return code === "SELG" || code === "SSLG" ? code : null;
}

function makeReceiptCode(electionCode) {
  const now = new Date();
  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `MABDC-${electionCode}-${date}-${random}`;
}


// --- PHOTO SERVING ROUTES ---
const photosDir = fs.existsSync("/app/photos") 
  ? "/app/photos" 
  : (fs.existsSync("/home/ubuntu/php-vanilla-mabdc/photos") 
     ? "/home/ubuntu/php-vanilla-mabdc/photos" 
     : path.join(__dirname, "../public/photos"));

console.log("[PHOTO SERVICE] Serving photos from:", photosDir);

app.get("/api/photos/election_photo.php", (req, res) => {
  const voterId = String(req.query.voterId || req.query.id || "").trim();
  if (voterId && fs.existsSync(photosDir)) {
    try {
      const files = fs.readdirSync(photosDir);
      const matched = files.find(f => (f.startsWith(voterId) || f.includes(voterId)) && (f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".webp")));
      if (matched) {
        return res.sendFile(path.join(photosDir, matched));
      }
    } catch(e) {
      console.error("[PHOTO PROXY ERROR]", e);
    }
  }
  const seed = encodeURIComponent(voterId || "voter");
  res.redirect(`https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=dae8df,e9dcbf,c8d8e8`);
});

app.use("/api/photos", express.static(photosDir));
app.use("/photos", express.static(photosDir));
app.use("/election/photos", express.static(photosDir));

// A photo_url pointing at a file that is no longer on disk would otherwise fall
// through to a 404 and render as a broken image on the ballot. Serve a generated
// avatar instead, seeded from the requested filename so it stays stable.
const photoFallback = (req, res) => {
  const seed = encodeURIComponent(path.basename(req.path).replace(/\.(jpg|jpeg|png|webp)$/i, "") || "photo");
  res.redirect(
    `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=dae8df,e9dcbf,c8d8e8`
  );
};

app.get("/api/photos/*splat", photoFallback);
app.get("/photos/*splat", photoFallback);
app.get("/election/photos/*splat", photoFallback);

// --- Admin photo upload helpers ---------------------------------------------

const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Confirms the decoded bytes really are the image type they claim to be.
 * Checking only the "data:image/..." prefix would let any payload through
 * under an image's name.
 */
function sniffImageType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return "png";
  return null;
}

/**
 * Writes an uploaded data URI to the photos directory under a caller-built
 * basename. The basename is never taken from request input directly - callers
 * derive it from an already-validated id - and the resolved path is checked to
 * be inside photosDir so a crafted name cannot escape it.
 */
function savePhoto(dataUri, basename) {
  const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUri || ""));
  if (!match) return { error: "Unsupported image format. Send a PNG or JPEG data URI." };

  let buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return { error: "Photo data could not be decoded." };
  }

  if (!buffer.length) return { error: "Photo is empty." };
  if (buffer.length > PHOTO_MAX_BYTES) {
    return { error: `Photo is too large (${Math.round(buffer.length / 1024)}KB). Maximum is 4MB.` };
  }

  const kind = sniffImageType(buffer);
  if (!kind) return { error: "That file is not a valid PNG or JPEG image." };

  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

  const filename = `${basename}.${kind}`;
  const target = path.resolve(photosDir, filename);
  if (path.dirname(target) !== path.resolve(photosDir)) {
    return { error: "Invalid photo target." };
  }

  // Remove the other extension so a learner cannot end up with both a .jpg and
  // a .png, where the lookup would pick whichever readdir happens to return.
  for (const ext of ["jpg", "png"]) {
    if (ext === kind) continue;
    const stale = path.resolve(photosDir, `${basename}.${ext}`);
    if (path.dirname(stale) === path.resolve(photosDir) && fs.existsSync(stale)) fs.unlinkSync(stale);
  }

  fs.writeFileSync(target, buffer);
  return { filename, bytes: buffer.length };
}

/** Deletes every stored photo for a basename. Returns how many were removed. */
function deletePhoto(basename) {
  let removed = 0;
  for (const ext of ["jpg", "png"]) {
    const target = path.resolve(photosDir, `${basename}.${ext}`);
    if (path.dirname(target) !== path.resolve(photosDir)) continue;
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      removed += 1;
    }
  }
  return removed;
}

const photoBody = express.json({ limit: "6mb" });

// Public endpoint: reports liveness only. The database path is a filesystem
// detail and is not exposed here.
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    database: "SQLite"
  });
});

app.get("/api/elections/:code/live-results", (req, res) => {
  const electionCode = normalizeElection(req.params.code);
  if (!electionCode) {
    return res.status(400).json({ error: "Choose SELG or SSLG." });
  }

  const ballot = getBallot(electionCode);
  if (!ballot) {
    return res.status(404).json({ error: "Election not found." });
  }

  const totalEligible = db
    .prepare("SELECT COUNT(*) AS count FROM learners WHERE division = ?")
    .get(electionCode).count;

  const votesCast = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM voter_participation
      WHERE election_code = ?
    `)
    .get(electionCode).count;

  const countVotes = db.prepare(`
    SELECT COUNT(*) AS count
    FROM votes
    WHERE election_code = ? AND candidate_id = ?
  `);

  const results = ballot.positions.map((position) => {
    const candidates = position.candidates.map((candidate) => ({
      ...candidate,
      votes: countVotes.get(electionCode, candidate.id).count
    }));

    const totalPositionVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);

    return {
      id: position.id,
      title: position.title,
      sort_order: position.sort_order,
      totalVotes: totalPositionVotes,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        percentage:
          totalPositionVotes === 0
            ? 0
            : Number(((candidate.votes / totalPositionVotes) * 100).toFixed(1))
      }))
    };
  });

  res.json({
    election: ballot.election,
    stats: {
      totalEligible,
      votesCast,
      turnoutPercentage:
        totalEligible === 0
          ? 0
          : Number(((votesCast / totalEligible) * 100).toFixed(1)),
      lastUpdated: new Date().toISOString()
    },
    positions: results
  });
});

app.get("/api/elections/:code/ballot" , (req, res) => {
  const electionCode = normalizeElection(req.params.code);
  if (!electionCode) return res.status(400).json({ error: "Unknown election." });

  const ballot = getBallot(electionCode);
  if (!ballot) return res.status(404).json({ error: "Election not found." });

  res.json(ballot);
});

app.post("/api/auth/voter", voterLoginLimiter, (req, res) => {
  const body = req.body || {};
  const electionCode = normalizeElection(body.electionCode);
  const rawVoterId = String(body.voterId || "").trim();
  const pin = String(body.pin || body.password || "").trim().toUpperCase();

  if (!electionCode || !rawVoterId || !pin) {
    return res.status(400).json({ error: "Learner Voter ID (LRN) and 6-letter capital password are required." });
  }

  const learner = db
    .prepare(`
      SELECT voter_id, original_id, name, level, division, pin_hash
      FROM learners
      WHERE LOWER(voter_id) = LOWER(?)
    `)
    .get(rawVoterId);

  if (!learner || !bcrypt.compareSync(pin, learner.pin_hash)) {
    return res.status(401).json({ error: "Invalid voter ID or PIN." });
  }

  if (learner.division !== electionCode) {
    return res.status(403).json({
      error: `This learner is registered for the ${learner.division} portal, not ${electionCode}.`
    });
  }

  const participation = db
    .prepare(`
      SELECT receipt_code, submitted_at
      FROM voter_participation
      WHERE LOWER(voter_id) = LOWER(?) AND election_code = ?
    `)
    .get(learner.voter_id, electionCode);

  if (participation) {
    return res.status(409).json({
      error: "This learner has already submitted a ballot for this election.",
      receipt: participation
    });
  }

  const token = signToken({
    role: "voter",
    voterId: learner.voter_id,
    electionCode: learner.division,
    division: learner.division
  });

  res.json({
    token,
    learner: {
      voterId: learner.voter_id,
      name: learner.name,
      level: learner.level,
      division: learner.division,
      photoUrl: `/api/photos/election_photo.php?voterId=${encodeURIComponent(learner.voter_id)}&id=${encodeURIComponent(learner.original_id || '')}`
    }
  });
});

app.post("/api/votes/submit", requireRole("voter"), (req, res) => {
  // A request that carried bytes but produced no parsed body means the client
  // omitted Content-Type (or sent something express.json() ignored). Treating
  // that as "no selections" is how a client-side header bug turned into ballots
  // full of default choices, so reject it loudly instead.
  const declaredLength = Number(req.headers["content-length"] || 0);
  const parsedKeys = req.body && typeof req.body === "object" ? Object.keys(req.body).length : 0;
  if (declaredLength > 0 && parsedKeys === 0) {
    console.error(
      `[VOTE SUBMIT] unreadable body from ${req.user?.voterId} — content-type: ${req.headers["content-type"] || "(none)"}`
    );
    return res.status(400).json({
      error: "Your ballot could not be read by the server. Please refresh the page and try again."
    });
  }

  const body = req.body || {};
  const electionCode = normalizeElection(body.electionCode || req.user.electionCode || req.user.division);

  if (!electionCode) {
    return res.status(400).json({ error: "Invalid election division specified." });
  }

  let rawSelections = [];
  if (Array.isArray(body.selections)) {
    rawSelections = body.selections;
  } else if (Array.isArray(body.ballot)) {
    rawSelections = body.ballot;
  } else if (Array.isArray(body.choices)) {
    rawSelections = body.choices;
  } else if (Array.isArray(body.votes)) {
    rawSelections = body.votes;
  } else if (typeof body.selections === "object" && body.selections !== null) {
    rawSelections = Object.entries(body.selections).map(([k, v]) => ({
      positionId: isNaN(k) ? undefined : Number(k),
      positionTitle: isNaN(k) ? k : undefined,
      candidateId: typeof v === "object" ? v?.candidateId : Number(v),
      candidateName: typeof v === "object" ? v?.candidateName : undefined
    }));
  }

  console.log("[VOTE SUBMIT]", req.user?.voterId, electionCode, "Raw count:", rawSelections.length);

  const positions = db
    .prepare(`
      SELECT id, title, sort_order
      FROM positions
      WHERE election_code = ?
      ORDER BY sort_order ASC
    `)
    .all(electionCode);

  const allCandidates = db
    .prepare(`
      SELECT id, position_id, name, party
      FROM candidates
      WHERE election_code = ?
    `)
    .all(electionCode);

  const selectionMap = new Map(); // position_id -> candidate_id

  // Resolve each selection strictly within the position it names.
  //
  // A candidate is only ever accepted for the race it actually belongs to. The
  // previous build fell back to matching by name or id across the whole
  // election, which let a malformed payload cast a vote in a race the learner
  // never saw. Anything that does not resolve is dropped, not guessed.
  for (const sel of rawSelections) {
    if (!sel) continue;

    const candId = Number(sel.candidateId ?? sel.id);
    const candName = String(sel.candidateName || sel.name || "").trim().toLowerCase();
    const posId = Number(sel.positionId ?? sel.posId);
    const posTitle = String(sel.positionTitle || sel.title || "").trim().toLowerCase();

    let position = positions.find((p) => p.id === posId);
    if (!position && posTitle) {
      position = positions.find((p) => p.title.trim().toLowerCase() === posTitle);
    }
    if (!position) continue;

    const positionCandidates = allCandidates.filter((c) => c.position_id === position.id);
    const candidate =
      positionCandidates.find((c) => c.id === candId) ||
      (candName ? positionCandidates.find((c) => c.name.trim().toLowerCase() === candName) : null);

    if (candidate) {
      selectionMap.set(position.id, candidate.id);
    }
  }

  // Abstention is valid: a position the learner did not choose records no vote.
  // Nothing is auto-filled. A ballot with no choices at all is rejected so an
  // empty submission cannot silently consume the learner's one-ballot-per-
  // election allowance.
  if (selectionMap.size === 0) {
    return res.status(400).json({
      error: "Your ballot is empty. Choose at least one candidate before submitting."
    });
  }

  const submitBallot = db.transaction(() => {
    const alreadyVoted = db
      .prepare(`
        SELECT id FROM voter_participation
        WHERE LOWER(voter_id) = LOWER(?) AND election_code = ?
      `)
      .get(req.user.voterId, electionCode);

    if (alreadyVoted) {
      const duplicate = new Error("ALREADY_VOTED");
      duplicate.code = "ALREADY_VOTED";
      throw duplicate;
    }

    const submittedAt = new Date().toISOString();
    const receiptCode = makeReceiptCode(electionCode);
    const anonymousBallotToken = crypto.randomUUID();

    // voter_id is deliberately absent: the ballot is linked only to the random
    // anonymousBallotToken, so no stored row ties a learner to their choices.
    const insertVote = db.prepare(`
      INSERT INTO votes
      (ballot_token, election_code, position_id, candidate_id, submitted_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const position of positions) {
      const chosenCandId = selectionMap.get(position.id);
      if (chosenCandId !== undefined && chosenCandId !== null) {
        insertVote.run(
          anonymousBallotToken,
          electionCode,
          position.id,
          Number(chosenCandId),
          submittedAt
        );
      }
    }

    db.prepare(`
      INSERT INTO voter_participation
      (voter_id, election_code, receipt_code, submitted_at, ballot_token)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(req.user.voterId), electionCode, receiptCode, submittedAt, anonymousBallotToken);

    return { receiptCode, submittedAt };
  });

  try {
    const receipt = submitBallot();
    res.status(201).json({
      success: true,
      receipt: {
        ...receipt,
        electionCode,
        message: "Vote recorded successfully."
      }
    });
  } catch (error) {
    if (error.code === "ALREADY_VOTED" || String(error.message).includes("UNIQUE constraint")) {
      return res.status(409).json({
        error: "This learner has already submitted a ballot for this election."
      });
    }
    console.error("VOTE SUBMISSION ERROR:", error);
    res.status(500).json({ error: "Could not record the ballot: " + (error.message || "Unknown error") });
  }
});


app.get("/api/admin/voter/:voterId/ballot", requireRole("admin"), (req, res) => {
  const voterId = String(req.params.voterId || "");
  const electionCode = normalizeElection(req.query.election);

  if (!voterId || !electionCode) {
    return res.status(400).json({ error: "Missing voter ID or election code." });
  }

  const learner = db
    .prepare(`
      SELECT voter_id, original_id, name, level, division
      FROM learners
      WHERE LOWER(voter_id) = LOWER(?)
    `)
    .get(voterId);

  if (!learner) {
    return res.status(404).json({ error: "Learner not found." });
  }

  const participation = db
    .prepare(`
      SELECT receipt_code, submitted_at, ballot_token
      FROM voter_participation
      WHERE LOWER(voter_id) = LOWER(?) AND election_code = ?
    `)
    .get(voterId, electionCode);

  if (!participation) {
    return res.json({
      learner: {
        ...learner,
        photoUrl: `/api/photos/election_photo.php?id=${learner.original_id || learner.voter_id}`
      },
      hasVoted: false
    });
  }

  // Ballot secrecy: this endpoint confirms *that* a learner voted and returns
  // their participation receipt. It deliberately does not return which
  // candidates they chose. Reconstructing an individual ballot would turn the
  // receipt into proof of how somebody voted, which is exactly what the
  // anonymous ballot_token exists to prevent.
  res.json({
    learner: {
      ...learner,
      photoUrl: `/api/photos/election_photo.php?id=${learner.original_id || learner.voter_id}`
    },
    hasVoted: true,
    receipt: {
      receipt_code: participation.receipt_code,
      submitted_at: participation.submitted_at
    },
    secrecyNotice:
      "Individual candidate selections are not retrievable. Only aggregated results are available."
  });
});


app.post("/api/admin/voter/:voterId/reset", requireRole("admin"), (req, res) => {
  const voterId = String(req.params.voterId || "");
  const electionCode = normalizeElection(req.query.election);

  if (!voterId || !electionCode) {
    return res.status(400).json({ error: "Missing voter ID or election code." });
  }

  const participation = db
    .prepare("SELECT ballot_token, receipt_code FROM voter_participation WHERE LOWER(voter_id) = LOWER(?) AND election_code = ?")
    .get(voterId, electionCode);

  if (!participation) {
    return res.status(404).json({ error: "No participation record found for this learner." });
  }

  // The ballot_token is the only link from a participation record to its vote
  // rows, so it is the only way to withdraw the cast ballot.
  if (participation.ballot_token) {
    db.prepare("DELETE FROM votes WHERE ballot_token = ? AND election_code = ?").run(participation.ballot_token, electionCode);
  }

  // Delete from voter_participation
  db.prepare("DELETE FROM voter_participation WHERE LOWER(voter_id) = LOWER(?) AND election_code = ?").run(voterId, electionCode);

  console.log(`[ADMIN RESET] Ballot reset for voter ${voterId} in ${electionCode}`);

  res.json({
    success: true,
    message: `Ballot for voter ${voterId} successfully reset. Learner may now re-cast their vote.`
  });
});

app.post("/api/admin/login", adminLoginLimiter, (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");

  // Both comparisons always run so a wrong username and a wrong password take
  // the same time and neither can be probed independently.
  const usernameOk = safeEqual(username, ADMIN_USERNAME);
  const passwordOk = safeEqual(password, ADMIN_PASSWORD);

  if (!usernameOk || !passwordOk) {
    return res.status(401).json({ error: "Invalid administrator credentials." });
  }

  res.json({
    token: signToken({ role: "admin", username }, "12h"),
    admin: { username }
  });
});
app.post("/api/admin/candidates/:id/photo", photoBody, requireRole("admin"), (req, res) => {
  // Digits only: the id becomes part of a filename, so anything else is refused
  // rather than sanitised.
  const candidateId = String(req.params.id || "");
  if (!/^\d+$/.test(candidateId)) {
    return res.status(400).json({ error: "Invalid candidate id." });
  }

  const candidate = db.prepare("SELECT id FROM candidates WHERE id = ?").get(candidateId);
  if (!candidate) return res.status(404).json({ error: "Candidate not found." });

  const result = savePhoto(req.body?.photo_b64, `cand_${candidateId}`);
  if (result.error) return res.status(400).json({ error: result.error });

  const photoUrl = `/election/photos/${result.filename}`;
  db.prepare("UPDATE candidates SET photo_url = ? WHERE id = ?").run(photoUrl, candidateId);

  console.log(`[PHOTO] candidate ${candidateId} updated (${Math.round(result.bytes / 1024)}KB)`);
  res.json({ success: true, photo_url: photoUrl });
});

app.delete("/api/admin/candidates/:id/photo", requireRole("admin"), (req, res) => {
  const candidateId = String(req.params.id || "");
  if (!/^\d+$/.test(candidateId)) return res.status(400).json({ error: "Invalid candidate id." });

  const removed = deletePhoto(`cand_${candidateId}`);
  db.prepare("UPDATE candidates SET photo_url = NULL WHERE id = ?").run(candidateId);
  res.json({ success: true, removed });
});

app.post("/api/admin/learners/:voterId/photo", photoBody, requireRole("admin"), (req, res) => {
  const voterId = String(req.params.voterId || "");
  if (!/^\d+$/.test(voterId)) {
    return res.status(400).json({ error: "Invalid voter ID." });
  }

  const learner = db.prepare("SELECT voter_id, name FROM learners WHERE voter_id = ?").get(voterId);
  if (!learner) return res.status(404).json({ error: "Learner not found." });

  // Stored as <LRN>.jpg so the existing photo lookup finds it with no extra
  // wiring, exactly like the photos imported from the ID photo folders.
  const result = savePhoto(req.body?.photo_b64, voterId);
  if (result.error) return res.status(400).json({ error: result.error });

  console.log(`[PHOTO] learner ${voterId} updated (${Math.round(result.bytes / 1024)}KB)`);
  res.json({
    success: true,
    photo_url: `/api/photos/election_photo.php?voterId=${encodeURIComponent(voterId)}&v=${Date.now()}`
  });
});

app.delete("/api/admin/learners/:voterId/photo", requireRole("admin"), (req, res) => {
  const voterId = String(req.params.voterId || "");
  if (!/^\d+$/.test(voterId)) return res.status(400).json({ error: "Invalid voter ID." });

  const removed = deletePhoto(voterId);
  res.json({ success: true, removed });
});

app.get("/api/admin/dashboard", requireRole("admin"), (req, res) => {
  const electionCode = normalizeElection(req.query.election);
  if (!electionCode) return res.status(400).json({ error: "Choose SELG or SSLG." });

  const ballot = getBallot(electionCode);
  if (!ballot) return res.status(404).json({ error: "Election not found." });

  const totalEligible = db
    .prepare("SELECT COUNT(*) AS count FROM learners WHERE division = ?")
    .get(electionCode).count;

  const votesCast = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM voter_participation
      WHERE election_code = ?
    `)
    .get(electionCode).count;

  const countVotes = db.prepare(`
    SELECT COUNT(*) AS count
    FROM votes
    WHERE election_code = ? AND candidate_id = ?
  `);

  const results = ballot.positions.map((position) => {
    const candidates = position.candidates.map((candidate) => ({
      ...candidate,
      votes: countVotes.get(electionCode, candidate.id).count
    }));

    const totalPositionVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);

    return {
      id: position.id,
      title: position.title,
      sort_order: position.sort_order,
      totalVotes: totalPositionVotes,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        percentage:
          totalPositionVotes === 0
            ? 0
            : Number(((candidate.votes / totalPositionVotes) * 100).toFixed(1))
      }))
    };
  });

  const receipts = db
    .prepare(`
      SELECT
        vp.receipt_code,
        vp.submitted_at,
        l.voter_id,
        l.original_id,
        l.name,
        l.level,
        l.password_plain AS password
      FROM voter_participation vp
      JOIN learners l ON l.voter_id = vp.voter_id
      WHERE vp.election_code = ?
      ORDER BY vp.submitted_at DESC
      LIMIT 300
    `)
    .all(electionCode);

  const unvotedLearners = db
    .prepare(`
      SELECT
        l.voter_id,
        l.original_id,
        l.name,
        l.level,
        l.division,
        l.password_plain AS password
      FROM learners l
      LEFT JOIN voter_participation vp ON vp.voter_id = l.voter_id AND vp.election_code = ?
      WHERE l.division = ? AND vp.voter_id IS NULL
      ORDER BY l.level ASC, l.name ASC
    `)
    .all(electionCode, electionCode);

  res.json({
    election: ballot.election,
    stats: {
      totalEligible,
      votesCast,
      remaining: unvotedLearners.length,
      turnout:
        totalEligible === 0
          ? 0
          : Number(((votesCast / totalEligible) * 100).toFixed(1))
    },
    results,
    receipts,
    unvotedLearners
  });
});

const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use("/election/assets", express.static(path.join(distPath, "assets")));
  app.use("/assets", express.static(path.join(distPath, "assets")));
  app.use("/election", express.static(distPath));
  // index: false on the unprefixed mounts so express.static does not answer "/"
  // with a blank-rendering index.html before the redirect below can run. Hashed
  // asset files are still served from here.
  app.use(express.static(path.join(__dirname, "../public"), { index: false }));
  app.use(express.static(distPath, { index: false }));

  const sendIndex = (req, res) => res.sendFile(path.join(distPath, "index.html"));

  // The React router is mounted at basename "/election", so serving index.html
  // at an unprefixed path renders a blank page. Redirect instead of serving.
  const toElection = (req, res) => res.redirect(302, `/election${req.path === "/" ? "/" : req.path}`);

  app.get("/", toElection);
  app.get("/selg", toElection);
  app.get("/sslg", toElection);
  app.get("/results", toElection);
  app.get("/results/selg", toElection);
  app.get("/results/sslg", toElection);
  app.get("/admin", toElection);

  app.get("/election", sendIndex);
  app.get("/election/selg", sendIndex);
  app.get("/election/sslg", sendIndex);
  app.get("/election/results", sendIndex);
  app.get("/election/results/selg", sendIndex);
  app.get("/election/results/sslg", sendIndex);
  app.get("/election/admin", sendIndex);

  // Deep links inside the SPA are served index.html; anything else outside the
  // /election basename is redirected so it lands on a page that actually renders.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/election")) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    res.redirect(302, "/election/");
  });
}

// A rejected cross-origin request should be a clean JSON 403, not Express's
// default HTML 500 page.
app.use((err, req, res, next) => {
  if (err && /CORS policy/.test(err.message || "")) {
    return res.status(403).json({ error: "Request origin is not permitted." });
  }
  if (res.headersSent) return next(err);
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`MABDC election server running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${dbPathForDisplay}`);
  if (JWT_SECRET === "development-only-change-me") {
    console.warn("WARNING: Set JWT_SECRET in .env before production use.");
  }
});
