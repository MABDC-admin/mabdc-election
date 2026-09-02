import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

// Smooth animated number component
function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 400;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(start + (end - start) * progress);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
}

// Single Candidate Live Tally Card
function CandidateTallyCard({ candidate, isLeading, totalVotes, index }) {
  const votes = candidate.votes || 0;
  const percentage = totalVotes > 0 ? Number(((votes / totalVotes) * 100).toFixed(1)) : 0;

  return (
    <motion.div
      className={`tally-candidate-item ${isLeading ? "is-leading" : ""}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
    >
      <div className="tally-cand-main">
        {/* Photo with Leader Indicator */}
        <div className="tally-cand-photo-wrap">
          <div className="tally-cand-photo-frame">
            <img
              src={candidate.photo_url || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(candidate.name)}`}
              alt={candidate.name}
              className="tally-cand-img"
              onError={(e) => {
                e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(candidate.name)}`;
              }}
            />
          </div>
          {isLeading && (
            <span className="tally-lead-badge" title="Currently Leading">
              👑
            </span>
          )}
        </div>

        {/* Candidate Name & Party */}
        <div className="tally-cand-details">
          <div className="tally-cand-title-row">
            <h4 className="tally-cand-name">{candidate.name}</h4>
            {isLeading && <span className="tally-lead-pill">LEADING</span>}
          </div>
          <span className="tally-cand-party">{candidate.party}</span>
        </div>

        {/* Big Vote Counter */}
        <div className="tally-cand-metrics">
          <div className="tally-vote-block">
            <span className="tally-vote-count">
              <AnimatedNumber value={votes} />
            </span>
            <span className="tally-vote-label">{votes === 1 ? "vote" : "votes"}</span>
          </div>
          <span className={`tally-pct-tag ${isLeading ? "leading-pct" : ""}`}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* Vote Share Progress Bar */}
      <div className="tally-progress-track">
        <motion.div
          className={`tally-progress-fill ${isLeading ? "fill-leading" : "fill-contender"}`}
          initial={{ width: 0 }}
          animate={{ width: `${totalVotes > 0 ? percentage : 0}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}

// Position Race Box
function PositionRaceBox({ position, isExecutive = false, index = 0 }) {
  const candidates = position.candidates || [];
  if (candidates.length === 0) return null;

  const totalVotes = position.totalVotes || 0;
  const maxVotes = Math.max(...candidates.map((c) => c.votes || 0));

  return (
    <motion.div
      className={`position-race-box ${isExecutive ? "executive-race" : "standard-race"}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Race Card Header */}
      <div className="race-card-header">
        <div className="race-title-group">
          {isExecutive && <span className="race-tier-tag">★ EXECUTIVE SEAT</span>}
          <h3 className="race-pos-title">{position.title}</h3>
          <span className="race-cand-count">{candidates.length} Contenders</span>
        </div>

        <div className="race-tally-pill">
          <span className="tally-pulse-dot" />
          <b>{totalVotes.toLocaleString()}</b>
          <small>Tallied</small>
        </div>
      </div>

      {/* Candidates List */}
      <div className="race-candidates-list">
        {candidates.map((candidate, idx) => {
          const isLeading = totalVotes > 0 && candidate.votes === maxVotes && maxVotes > 0;
          return (
            <CandidateTallyCard
              key={candidate.id}
              candidate={candidate}
              isLeading={isLeading}
              totalVotes={totalVotes}
              index={idx}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

// Proclaimed Winners Component
function ProclaimedWinnersView({ positions, electionCode, stats }) {
  const winners = useMemo(() => {
    if (!positions) return [];
    return positions.map((p) => {
      const cands = p.candidates || [];
      if (cands.length === 0) return null;
      const sorted = [...cands].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      const top = sorted[0];
      const second = sorted[1];
      const isTie = second && top.votes === second.votes && top.votes > 0;
      return {
        positionId: p.id,
        positionTitle: p.title,
        totalVotes: p.totalVotes || 0,
        winner: top,
        isTie,
        margin: second ? top.votes - second.votes : top.votes
      };
    }).filter(Boolean);
  }, [positions]);

  return (
    <div className="proclamation-view-root">
      <div className="proclamation-hero-banner">
        <div className="proclamation-seal-icon">🏆</div>
        <div>
          <span className="gold-kicker">OFFICIAL ELECTION CANVASS</span>
          <h2>Proclaimed Winners & Leaders — {electionCode}</h2>
          <p>
            Official tally based on {stats?.votesCast ?? 0} verified ballots ({stats?.turnoutPercentage ?? 0}% voter turnout).
          </p>
        </div>
      </div>

      <div className="winners-cards-grid">
        {winners.map((item) => (
          <div key={item.positionId} className="winner-spotlight-card">
            <div className="winner-card-badge">
              <span>{item.positionTitle}</span>
            </div>

            <div className="winner-photo-glow-frame">
              <img
                src={item.winner.photo_url || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(item.winner.name)}`}
                alt={item.winner.name}
              />
              <span className="winner-crown-pill">👑 PROCLAIMED</span>
            </div>

            <h3 className="winner-name-text">{item.winner.name}</h3>
            <span className="winner-party-text">{item.winner.party}</span>

            <div className="winner-stats-bar">
              <div className="winner-stat-item">
                <small>Votes</small>
                <b>{item.winner.votes}</b>
              </div>
              <div className="winner-stat-item">
                <small>Share</small>
                <b>{item.totalVotes > 0 ? ((item.winner.votes / item.totalVotes) * 100).toFixed(1) : 0}%</b>
              </div>
              <div className="winner-stat-item">
                <small>Margin</small>
                <b>+{item.margin}</b>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// PIN Unlock Modal for Winners
function PinUnlockModal({ electionCode, onUnlock, onClose }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // The PIN is checked by the server, not compared here: a value embedded in
  // the bundle is readable by anyone who opens the page source.
  async function handleSubmit(e) {
    e.preventDefault();
    const entered = pin.trim();
    if (!entered) return;
    setBusy(true);
    setError("");
    try {
      await api.getLiveResults(electionCode, entered);
      try { sessionStorage.setItem("mabdc_results_pin", entered); } catch {}
      onUnlock(entered);
    } catch (err) {
      setError(err.status === 401 ? "Incorrect PIN. Please try again." : (err.message || "Could not verify the PIN."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop-blur">
      <div className="modal-card-glass">
        <div className="modal-icon-wrap">🔒</div>
        <h3>Enter Access PIN</h3>
        <p>Proclaimed winners summary requires administrator access.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoFocus
            maxLength={10}
            placeholder="Enter results PIN"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            className="pin-modal-input"
          />
          {error && <span className="pin-error-text">{error}</span>}
          <div className="pin-modal-actions">
            <button type="button" className="btn-cancel-modal" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-confirm-modal" disabled={busy}>
              {busy ? "Checking…" : "Unlock View →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LiveResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDivision = searchParams.get("division")?.toUpperCase() === "SSLG" ? "SSLG" : "SELG";

  const [electionCode, setElectionCode] = useState(initialDivision);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const [activeTab, setActiveTab] = useState("tally");
  const [isWinnersUnlocked, setIsWinnersUnlocked] = useState(() => {
    return sessionStorage.getItem("mabdc_winners_unlocked") === "true";
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [locked, setLocked] = useState(false);

  async function fetchResults(isSilent = false) {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.getLiveResults(electionCode);
      setData(res);
      setLastRefreshed(new Date());
      setError("");
    } catch (err) {
      // A locked feed is not an error to shout about - prompt for the PIN.
      if (err.status === 401 && err.data?.pinRequired) {
        setLocked(true);
        setShowPinModal(true);
        setError("");
      } else if (!isSilent) {
        setError(err.message || "Failed to load live results.");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }

  useEffect(() => {
    fetchResults();
    if (locked) return undefined; // no point polling a feed we cannot read
    const interval = setInterval(() => {
      fetchResults(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [electionCode, locked]);

  function switchDivision(code) {
    setElectionCode(code);
    setSearchParams({ division: code });
  }

  // Split positions into 3 tiers
  const { executivePositions, adminPositions, councilPositions } = useMemo(() => {
    if (!data?.positions) return { executivePositions: [], adminPositions: [], councilPositions: [] };

    const exec = [];
    const admin = [];
    const council = [];

    data.positions.forEach((p) => {
      const t = p.title.toLowerCase();
      if (t.includes("president")) {
        exec.push(p);
      } else if (t.includes("secretary") || t.includes("treasurer") || t.includes("auditor")) {
        admin.push(p);
      } else {
        council.push(p);
      }
    });

    return {
      executivePositions: exec,
      adminPositions: admin,
      councilPositions: council
    };
  }, [data]);

  // Locked feed: show the PIN prompt instead of an empty scoreboard.
  if (locked && !data) {
    return (
      <div className="live-scoreboard-root">
        <div className="center-message">
          <h2 style={{ marginBottom: 8 }}>🔒 Results are locked</h2>
          <p style={{ marginBottom: 18 }}>
            Live tallies are hidden while voting is open. Enter the results PIN to view them.
          </p>
          <button type="button" className="btn-confirm-modal" onClick={() => setShowPinModal(true)}>
            Enter results PIN
          </button>
        </div>
        {showPinModal && (
          <PinUnlockModal
            electionCode={electionCode}
            onUnlock={() => {
              setShowPinModal(false);
              setLocked(false);
              fetchResults();
            }}
            onClose={() => setShowPinModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="live-scoreboard-root">
      {/* Top Floating Command Bar */}
      <header className="scoreboard-header">
        <div className="header-brand-side">
          <Link to="/" className="brand-logo-link">
            <img
              src="/mabdc_logo.png"
              alt="MABDC"
              className="scoreboard-school-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="scoreboard-brand-texts">
              <span className="brand-sub-title">M.A BRAIN DEVELOPMENT CENTER</span>
              <h1 className="brand-main-title">Elections Results Center</h1>
            </div>
          </Link>
        </div>

        {/* Division Switcher */}
        <div className="division-toggle-group">
          <button
            className={`toggle-tab-btn ${electionCode === "SELG" ? "active-selg" : ""}`}
            onClick={() => switchDivision("SELG")}
          >
            🏫 SELG (Grades 1–6)
          </button>
          <button
            className={`toggle-tab-btn ${electionCode === "SSLG" ? "active-sslg" : ""}`}
            onClick={() => switchDivision("SSLG")}
          >
            🎓 SSLG (Grades 7–12)
          </button>
        </div>

        {/* Right KPI Stats & Quick Actions */}
        <div className="header-meta-metrics">
          <div className="metric-chip live-pill">
            <span className="live-pulse-dot" />
            <span>LIVE STREAM</span>
          </div>
          <div className="metric-chip">
            <span>Turnout:</span>
            <b className="highlight-green">{data?.stats?.turnoutPercentage ?? 0}%</b>
          </div>
          <div className="metric-chip">
            <span>Votes:</span>
            <b>{data?.stats?.votesCast ?? 0} / {data?.stats?.totalEligible ?? 0}</b>
          </div>
          <Link to={electionCode === "SELG" ? "/selg" : "/sslg"} className="booth-direct-btn">
            🗳️ Voting Booth →
          </Link>
        </div>
      </header>

      {error && <div className="scoreboard-error-banner">{error}</div>}

      {/* Main Results Board */}
      <main className="scoreboard-main-layout">
        {/* Tier 1: Executive Races (President & VP) */}
        <section className="results-tier-section">
          <div className="tier-header-wrap">
            <span className="tier-kicker-gold">★ TIER 01</span>
            <h2>Executive Government</h2>
          </div>
          <div className="grid-executive-races">
            {executivePositions.map((pos, idx) => (
              <PositionRaceBox key={pos.id} position={pos} isExecutive={true} index={idx} />
            ))}
          </div>
        </section>

        {/* Tier 2: Administrative Officers */}
        {adminPositions.length > 0 && (
          <section className="results-tier-section">
            <div className="tier-header-wrap">
              <span className="tier-kicker-blue">★ TIER 02</span>
              <h2>Administrative Officers</h2>
            </div>
            <div className="grid-standard-races">
              {adminPositions.map((pos, idx) => (
                <PositionRaceBox
                  key={pos.id}
                  position={pos}
                  isExecutive={false}
                  index={executivePositions.length + idx}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tier 3: Protocol, PIO & Grade Level Representatives */}
        {councilPositions.length > 0 && (
          <section className="results-tier-section">
            <div className="tier-header-wrap">
              <span className="tier-kicker-green">★ TIER 03</span>
              <h2>Protocol, Public Information & Grade Representatives</h2>
            </div>
            <div className="grid-standard-races">
              {councilPositions.map((pos, idx) => (
                <PositionRaceBox
                  key={pos.id}
                  position={pos}
                  isExecutive={false}
                  index={executivePositions.length + adminPositions.length + idx}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Footer */}
      <footer className="scoreboard-footer">
        <div>
          <b>M.A Brain Development Center</b> • Supreme Learner Government Official Canvass
        </div>
        <div className="footer-sync-time">
          Last Synced: {lastRefreshed.toLocaleTimeString()} • Auto-refresh every 3s
        </div>
      </footer>
    </div>
  );
}
