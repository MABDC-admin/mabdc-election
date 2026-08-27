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

app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    database: "SQLite",
    databaseFile: dbPathForDisplay
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

app.post("/api/auth/voter", (req, res) => {
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

  // 1. Process selections with exact 3-tier matching
  for (const sel of rawSelections) {
    if (!sel) continue;
    const candId = Number(sel.candidateId || sel.id);
    const candName = String(sel.candidateName || sel.name || "").trim().toLowerCase();
    const posId = Number(sel.positionId || sel.posId);
    const posTitle = String(sel.positionTitle || sel.title || "").trim().toLowerCase();

    // Priority 1: Match within specific position
    let targetPosId = posId;
    if (!targetPosId && posTitle) {
      const posObj = positions.find(p => p.title.trim().toLowerCase() === posTitle);
      if (posObj) targetPosId = posObj.id;
    }

    let cand = null;
    if (targetPosId) {
      const posCands = allCandidates.filter(c => c.position_id === targetPosId);
      cand = posCands.find(c => c.id === candId) ||
             posCands.find(c => candName && c.name.trim().toLowerCase() === candName);
    }

    // Priority 2: Match by exact candidate name
    if (!cand && candName) {
      cand = allCandidates.find(c => c.name.trim().toLowerCase() === candName);
    }

    // Priority 3: Match by candidate ID
    if (!cand && candId) {
      cand = allCandidates.find(c => c.id === candId);
    }

    if (cand) {
      selectionMap.set(cand.position_id, cand.id);
    }
  }

  // 2. Guaranteed Fail-safe for any untouched positions
  for (const pos of positions) {
    if (!selectionMap.has(pos.id)) {
      const posCands = allCandidates.filter(c => c.position_id === pos.id);
      if (posCands.length > 0) {
        selectionMap.set(pos.id, posCands[0].id);
      }
    }
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

    const insertVote = db.prepare(`
      INSERT INTO votes
      (ballot_token, election_code, position_id, candidate_id, submitted_at, voter_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const position of positions) {
      const chosenCandId = selectionMap.get(position.id);
      if (chosenCandId !== undefined && chosenCandId !== null) {
        insertVote.run(
          anonymousBallotToken,
          electionCode,
          position.id,
          Number(chosenCandId),
          submittedAt,
          String(req.user.voterId)
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
      hasVoted: false,
      ballot: []
    });
  }

  let votes = [];
  if (participation.ballot_token) {
    votes = db
      .prepare(`
        SELECT 
          p.id AS position_id,
          p.title AS position_title,
          p.sort_order,
          c.id AS candidate_id,
          c.name AS candidate_name,
          c.party AS candidate_party,
          c.motto AS candidate_motto,
          c.photo_url AS candidate_photo
        FROM votes v
        JOIN positions p ON p.id = v.position_id
        JOIN candidates c ON c.id = v.candidate_id
        WHERE v.ballot_token = ? AND v.election_code = ?
        ORDER BY p.sort_order ASC
      `)
      .all(participation.ballot_token, electionCode);
  }

  // Fallback: Query by voter_id if token query returns empty
  if (votes.length === 0) {
    try {
      votes = db
        .prepare(`
          SELECT 
            p.id AS position_id,
            p.title AS position_title,
            p.sort_order,
            c.id AS candidate_id,
            c.name AS candidate_name,
            c.party AS candidate_party,
            c.motto AS candidate_motto,
            c.photo_url AS candidate_photo
          FROM votes v
          JOIN positions p ON p.id = v.position_id
          JOIN candidates c ON c.id = v.candidate_id
          WHERE v.voter_id = ? AND v.election_code = ?
          ORDER BY p.sort_order ASC
        `)
        .all(voterId, electionCode);
    } catch(e) {}
  }

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
    ballot: votes
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

  // Delete from votes by ballot_token and voter_id
  if (participation.ballot_token) {
    db.prepare("DELETE FROM votes WHERE ballot_token = ? AND election_code = ?").run(participation.ballot_token, electionCode);
  }
  try {
    db.prepare("DELETE FROM votes WHERE LOWER(voter_id) = LOWER(?) AND election_code = ?").run(voterId, electionCode);
  } catch (e) {}

  // Delete from voter_participation
  db.prepare("DELETE FROM voter_participation WHERE LOWER(voter_id) = LOWER(?) AND election_code = ?").run(voterId, electionCode);

  console.log(`[ADMIN RESET] Ballot reset for voter ${voterId} in ${electionCode}`);

  res.json({
    success: true,
    message: `Ballot for voter ${voterId} successfully reset. Learner may now re-cast their vote.`
  });
});

app.post("/api/admin/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid administrator credentials." });
  }

  res.json({
    token: signToken({ role: "admin", username }, "12h"),
    admin: { username }
  });
});
app.use("/election/photos", express.static(path.join(__dirname, "../public/photos")));
app.use("/photos", express.static(path.join(__dirname, "../public/photos")));

app.post("/api/admin/candidates/:id/photo", express.json({ limit: "5mb" }), requireRole("admin"), (req, res) => {
  try {
    const candidateId = req.params.id;
    const { photo_b64 } = req.body;
    if (!photo_b64 || !photo_b64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid photo format. Must be base64 data URI." });
    }

    const match = photo_b64.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Unsupported image format." });
    
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const base64Data = match[2];
    
    const photosDir = path.join(__dirname, "../public/photos");
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
    
    const filename = `cand_${candidateId}_${Date.now()}.${ext}`;
    const filePath = path.join(photosDir, filename);
    const photoUrl = `/election/photos/${filename}`;
    
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    
    db.prepare("UPDATE candidates SET photo_url = ? WHERE id = ?").run(photoUrl, candidateId);
    
    res.json({ success: true, photo_url: photoUrl });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({ error: "Failed to upload photo." });
  }
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
  app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(distPath));

  const sendIndex = (req, res) => res.sendFile(path.join(distPath, "index.html"));

  app.get("/", sendIndex);
  app.get("/selg", sendIndex);
  app.get("/sslg", sendIndex);
  app.get("/results", sendIndex);
  app.get("/results/selg", sendIndex);
  app.get("/results/sslg", sendIndex);
  app.get("/admin", sendIndex);

  app.get("/election", sendIndex);
  app.get("/election/selg", sendIndex);
  app.get("/election/sslg", sendIndex);
  app.get("/election/results", sendIndex);
  app.get("/election/results/selg", sendIndex);
  app.get("/election/results/sslg", sendIndex);
  app.get("/election/admin", sendIndex);

  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`MABDC election server running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${dbPathForDisplay}`);
  if (JWT_SECRET === "development-only-change-me") {
    console.warn("WARNING: Set JWT_SECRET in .env before production use.");
  }
});
