import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("MABDC@2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.adminLogin({ username, password });
      localStorage.setItem("mabdc_admin_token", result.token);
      onLogin(result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page-premium">
      <div className="admin-glass-card">
        <div className="admin-login-header">
          <Link className="back-home-pill" to="/">← Election Portals</Link>
          <div className="brand-logo-seal-wrap">
            <img
              src="/mabdc_logo.png"
              alt="MABDC Logo"
              className="admin-login-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'grid';
              }}
            />
            <div className="brand-logo-seal" style={{ display: 'none' }}>M.A</div>
          </div>
          <span className="executive-badge">OFFICIAL SYSTEM CONSOLE</span>
          <h1>Election Administration</h1>
          <p>Sign in to monitor real-time ballots, audit participation, and supervise SELG & SSLG elections.</p>
        </div>

        <form className="admin-premium-form" onSubmit={submit}>
          <label>
            <span>Administrator Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Security Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="admin-error-alert">{error}</div>}

          <button className="admin-submit-btn" disabled={busy}>
            {busy ? "Authenticating..." : "Access Control Center →"}
          </button>
        </form>

        <div className="admin-login-footer">
          <span>🔒 256-Bit Encrypted Session • M.A Brain Development Center</span>
        </div>
      </div>
    </main>
  );
}


function AnimatedNumber({ value, duration = 500 }) {
  const [displayValue, setDisplayValue] = useState(value || 0);

  useEffect(() => {
    let startVal = displayValue;
    let endVal = value || 0;
    if (startVal === endVal) return;

    let startTime = null;
    let animId;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startVal + (endVal - startVal) * ease));
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    }
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return <span className="morph-num-slot">{displayValue}</span>;
}

function MetricCard({ title, value, subtext, icon, trendColor = "emerald", delay = 0 }) {
  return (
    <motion.div
      className={`metric-glass-card ${trendColor}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="metric-header-row">
        <span className="metric-label">{title}</span>
        <span className="metric-icon-wrap">{icon}</span>
      </div>
      <div className="metric-main-value">{value}</div>
      <div className="metric-subtext">{subtext}</div>
    </motion.div>
  );
}

function CandidateVersusAdminCard({ position, isExecutive = false, cardIndex = 0, onUploadPhoto }) {
  const [c1, c2] = position.candidates;
  if (!c1) return null;

  const total = position.totalVotes;
  const lead1 = total > 0 && c1.votes > (c2?.votes || 0);
  const lead2 = total > 0 && (c2?.votes || 0) > c1.votes;
  const isTied = total > 0 && c1.votes === (c2?.votes || 0);
  const percentA = total > 0 ? Number(((c1.votes / total) * 100).toFixed(1)) : 50;
  const percentB = total > 0 ? Number((((c2?.votes || 0) / total) * 100).toFixed(1)) : 50;

  return (
    <div className={`admin-versus-grid-card ${isExecutive ? "executive-hero-card" : ""}`}>
      <div className="admin-versus-header">
        <div className="pos-title-block">
          <span className={`pos-badge ${isExecutive ? "gold" : ""}`}>
            {isExecutive ? "★ EXECUTIVE" : "OFFICE"}
          </span>
          <h4>{position.title}</h4>
        </div>
        <div className="tallied-pill">
          <span><b>{total}</b> Votes Cast</span>
        </div>
      </div>

      <div className="admin-duel-fighters-grid">
        {/* Candidate 1 (Left) */}
        <div className={`admin-fighter-vertical left ${lead1 ? "is-winner" : ""}`}>
          <div className="admin-leader-badge-slot">
            {lead1 ? (
              <span className="admin-leader-pill">👑 LEADER</span>
            ) : (
              <span className="admin-leader-placeholder" />
            )}
          </div>
          <div className="admin-fighter-photo-wrap">
            <img
              src={c1.photo_url || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(c1.name)}`}
              alt={c1.name}
              className="admin-fighter-img"

              onError={(e) => {
                e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(c1.name)}`;
              }}
            />
            <label className="admin-photo-upload-overlay" title="Upload Photo">
              📸
              <input type="file" accept="image/jpeg,image/png" style={{display:'none'}} onChange={(e) => onUploadPhoto && onUploadPhoto(c1.id, e.target.files[0])} />
            </label>

          </div>
          <div className="admin-fighter-info">
            <strong className="admin-cand-name">{c1.name}</strong>
            <span className="admin-cand-party">{c1.party}</span>
          </div>
          <div className="admin-score-banner emerald">
            <b className="vote-num">{c1.votes}</b>
            <span className="vote-pct">({c1.percentage}%)</span>
          </div>
        </div>

        {/* Center VS Divider */}
        <div className="admin-vs-badge-wrap">
          <span className="vs-circle-tag">{isTied ? "TIED" : "VS"}</span>
        </div>

        {/* Candidate 2 (Right) */}
        {c2 && (
          <div className={`admin-fighter-vertical right ${lead2 ? "is-winner" : ""}`}>
            <div className="admin-leader-badge-slot">
              {lead2 ? (
                <span className="admin-leader-pill">👑 LEADER</span>
              ) : (
                <span className="admin-leader-placeholder" />
              )}
            </div>
            <div className="admin-fighter-photo-wrap">
              <img
                src={c2.photo_url || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(c2.name)}`}
                alt={c2.name}
                className="admin-fighter-img"
                onError={(e) => {
                  e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(c2.name)}`;
                }}
              />
              <label className="admin-photo-upload-overlay" title="Upload Photo">
                📸
                <input type="file" accept="image/jpeg,image/png" style={{display:'none'}} onChange={(e) => onUploadPhoto && onUploadPhoto(c2.id, e.target.files[0])} />
              </label>
            </div>
            <div className="admin-fighter-info">
              <strong className="admin-cand-name">{c2.name}</strong>
              <span className="admin-cand-party">{c2.party}</span>
            </div>
            <div className="admin-score-banner crimson">
              <b className="vote-num">{c2.votes}</b>
              <span className="vote-pct">({c2.percentage}%)</span>
            </div>
          </div>
        )}
      </div>

      {/* Duel Bar */}
      {c2 && (
        <div className="admin-duel-bar-track">
          <div
            className="bar-fill emerald"
            style={{ width: `${total === 0 ? 50 : percentA}%` }}
          />
          <div
            className="bar-fill crimson"
            style={{ width: `${total === 0 ? 50 : percentB}%` }}
          />
        </div>
      )}
    </div>
  );
}


function WinnersProclamationModule({ results, electionCode, stats }) {
  const winners = useMemo(() => {
    if (!results) return [];
    return results.map((pos) => {
      const candidates = [...pos.candidates].sort((a, b) => b.votes - a.votes);
      const winner = candidates[0];
      const runnerUp = candidates[1];
      const margin = winner && runnerUp ? winner.votes - runnerUp.votes : winner?.votes || 0;
      const isTied = winner && runnerUp && winner.votes === runnerUp.votes && winner.votes > 0;
      return {
        position: pos.title,
        isExecutive: pos.title.toLowerCase().includes("president"),
        totalVotes: pos.totalVotes,
        winner,
        runnerUp,
        margin,
        isTied
      };
    });
  }, [results]);

  function printProclamation() {
    window.print();
  }

  return (
    <section className="winners-proclamation-section" id="winners-roster">
      {/* On-Screen Luxury Banner */}
      <div className="proclamation-banner-card no-print">
        <div className="proclamation-info">
          <span className="modal-kicker">OFFICIAL BOARD OF CANVASSERS</span>
          <h3>🏆 Proclaimed Winning Candidates ({electionCode})</h3>
          <p>
            Official roster of candidates commanding majority votes in the {electionCode} Supreme Learner Government Election.
          </p>
        </div>
        <button className="print-certificate-btn" onClick={printProclamation}>
          🖨️ Print Proclamation Sheet (PDF)
        </button>
      </div>

      {/* On-Screen Winners Cards */}
      <div className="winners-cards-grid no-print">
        {winners.map((item, idx) => {
          if (!item.winner || item.winner.votes === 0) {
            return (
              <div className="winner-trophy-card" key={idx}>
                <span className="winner-pos-title">{item.position}</span>
                <p style={{ color: "#94a3b8", fontSize: "13px" }}>No votes cast yet for this position.</p>
              </div>
            );
          }

          return (
            <div
              className={`winner-trophy-card ${item.isExecutive ? "executive" : ""}`}
              key={idx}
            >
              <div className="winner-ribbon-tag">
                {item.isTied ? "🤝 TIED VOTE" : "🏆 ELECTED WINNER"}
              </div>

              <div className="winner-photo-glow-frame">
                <img
                  src={item.winner.photo_url || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(item.winner.name)}`}
                  alt={item.winner.name}
                  onError={(e) => {
                    e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(item.winner.name)}`;
                  }}
                />
                {!item.isTied && <span className="winner-gold-crown">👑</span>}
              </div>

              <div className="winner-details-block">
                <span className="winner-pos-title">{item.position}</span>
                <h4 className="winner-name">{item.winner.name}</h4>
                <span className="winner-party">{item.winner.party}</span>
              </div>

              <div className="winner-single-score-badge">
                <span className="winner-score-count">{item.winner.votes} VOTES</span>
                <span className="winner-score-share">• {item.winner.percentage}% SHARE</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DEDICATED OFFICIAL PRINTABLE PROCLAMATION SHEET (PDF / PRINT VIEW) */}
      <div className="official-proclamation-print-doc">
        <div className="proclamation-doc-inner">
          {/* Header */}
          <div className="proc-doc-header">
            <div className="proc-logo-side">
              <img
                src="/mabdc_logo.png"
                alt="MABDC Logo"
                className="proc-print-logo"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div className="proc-header-content">
              <h1 className="proc-school-main-title">M.A BRAIN DEVELOPMENT CENTER</h1>
              <p className="proc-school-sub">Supreme Learner Government • Official Proclamation</p>
            </div>
            <div className="proc-seal-side">
              <div className="proc-seal-circle">
                <small>OFFICIAL SEAL</small>
                <b>2026</b>
              </div>
            </div>
          </div>

          <div className="proc-gold-divider" />

          {/* Title Block */}
          <div className="proc-title-area">
            <h1>CERTIFICATE OF CANVASS AND PROCLAMATION</h1>
            <h3>OF THE DULY ELECTED OFFICERS FOR S.Y. 2026–2027</h3>
            <p className="proc-div-tag">
              {electionCode === "SELG"
                ? "SUPREME ELEMENTARY LEARNER GOVERNMENT (SELG) • GRADES 4 TO 6"
                : "SUPREME SECONDARY LEARNER GOVERNMENT (SSLG) • GRADES 7 TO 12"}
            </p>
          </div>

          {/* Winners Only Table */}
          <table className="proc-table">
            <thead>
              <tr>
                <th style={{ width: "6%" }}>NO.</th>
                <th style={{ width: "22%" }}>OFFICIAL POSITION</th>
                <th style={{ width: "14%" }}>PORTRAIT</th>
                <th style={{ width: "30%" }}>PROCLAIMED WINNER</th>
                <th style={{ width: "16%" }}>PARTY AFFILIATION</th>
                <th style={{ width: "12%" }}>VOTES WON</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((item, idx) => (
                <tr key={idx} className={item.isExecutive ? "proc-exec-row" : ""}>
                  <td className="center">{idx + 1}</td>
                  <td className="proc-pos-title"><b>{item.position}</b></td>
                  <td className="center">
                    <img
                      src={item.winner?.photo_url || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(item.winner?.name || "Winner")}`}
                      alt={item.winner?.name}
                      className="proc-table-avatar"
                      onError={(e) => {
                        e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(item.winner?.name || "Winner")}`;
                      }}
                    />
                  </td>
                  <td className="proc-winner-name">
                    <strong>{item.winner?.name || "NO CANDIDATE"}</strong>
                    {item.isExecutive && <span className="exec-badge">Executive</span>}
                  </td>
                  <td className="proc-winner-party">{item.winner?.party || "—"}</td>
                  <td className="center proc-votes-col">
                    <b>{item.winner?.votes || 0}</b>
                    <small>({item.winner?.percentage || 0}%)</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Turnout Statistics Bar */}
          {stats && (
            <div className="proc-turnout-strip">
              <div><span>Total Registered Voters:</span> <b>{stats.totalEligible}</b></div>
              <div><span>Official Ballots Cast:</span> <b>{stats.votesCast}</b></div>
              <div><span>Voter Turnout Rate:</span> <b>{stats.turnout}%</b></div>
              <div><span>Date of Proclamation:</span> <b>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</b></div>
            </div>
          )}

          {/* Proclamation Statement */}
          <p className="proc-canvass-statement">
            WE, THE UNDERSIGNED SCHOOL OFFICIALS AND ELECTORAL COMMITTEE, hereby certify under oath that the official canvass of votes for the {electionCode} Election was faithfully executed. The winning candidates having obtained the highest plurality of votes are hereby PROCLAIMED and declared as the duly elected officers for School Year 2026–2027.
          </p>

          {/* Official Signatures (Teacher Adviser & Principal Only) */}
          <div className="proc-signatures-row two-col">
            <div className="proc-sig-block">
              <div className="sig-line" />
              <b>SELG / SSLG Teacher Adviser</b>
              <small>Electoral Committee Attestation</small>
            </div>
            <div className="proc-sig-block">
              <div className="sig-line" />
              <b>School Principal / Administrator</b>
              <small>M.A Brain Development Center</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function UnvotedLearnersModule({ learners = [], electionCode, onRefresh, onViewPassword }) {
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");

  const gradeOptions = useMemo(() => {
    const set = new Set();
    learners.forEach((l) => {
      const match = l.level.match(/Grade\s*\d+/i);
      if (match) set.add(match[0]);
      else set.add(l.level);
    });
    return Array.from(set).sort();
  }, [learners]);

  const filtered = useMemo(() => {
    return learners.filter((l) => {
      const matchesSearch =
        search === "" ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.voter_id.toLowerCase().includes(search.toLowerCase());

      const matchesGrade =
        filterLevel === "ALL" ||
        l.level.toLowerCase().startsWith(filterLevel.toLowerCase());

      return matchesSearch && matchesGrade;
    });
  }, [learners, search, filterLevel]);

  function exportUnvotedCSV() {
    if (!learners.length) return;
    const headers = ["No.", "Voter ID (LRN)", "Full Name", "Grade & Section", "Division", "Status"];
    const rows = learners.map((l, idx) => [
      idx + 1,
      `"${l.voter_id}"`,
      `"${l.name}"`,
      `"${l.level}"`,
      l.division,
      "PENDING VOTE"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MABDC_${electionCode}_Pending_Unvoted_Learners_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="admin-content-section" id="unvoted-learners">
      <div className="section-title-bar">
        <div className="title-left">
          <span className="section-kicker">PARTICIPATION FOLLOW-UP • {electionCode}</span>
          <h3>Learners Pending Vote ({learners.length} remaining)</h3>
        </div>
        <div className="section-tools-right">
          <button className="export-csv-btn" onClick={exportUnvotedCSV} disabled={!learners.length}>
            📥 Export Unvoted CSV
          </button>
        </div>
      </div>

      <div className="admin-table-filters-bar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by student name or Voter ID (LRN)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className="grade-filter-wrap">
          <label>Grade Level:</label>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
            <option value="ALL">All Grades ({learners.length})</option>
            {gradeOptions.map((gr) => (
              <option key={gr} value={gr}>{gr}</option>
            ))}
          </select>
        </div>
      </div>

      {learners.length === 0 ? (
        <div className="unvoted-empty-celebration">
          <div className="celebration-icon">🎉</div>
          <h4>100% Voter Turnout Achieved!</h4>
          <p>All eligible learners in the {electionCode} division have successfully cast their ballots.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty-table-state">
          No pending voters matched your search filter "{search}".
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-audit-table">
            <thead>
              <tr>
                <th style={{ width: "5%" }}>#</th>
                <th style={{ width: "10%" }}>Photo</th>
                <th style={{ width: "32%" }}>Learner Name</th>
                <th style={{ width: "20%" }}>Voter ID (LRN)</th>
                <th style={{ width: "18%" }}>Grade & Section</th>
                <th style={{ width: "15%" }} className="center-text">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((learner, idx) => (
                <tr key={learner.voter_id} className="unvoted-row">
                  <td className="row-num">{idx + 1}</td>
                  <td className="row-photo-cell">
                    <img
                      src={`/api/photos/election_photo.php?id=${learner.original_id || learner.voter_id}`}
                      alt={learner.name}
                      className="audit-learner-thumb"
                      onError={(e) => {
                        e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(learner.name)}`;
                      }}
                    />
                  </td>
                  <td className="learner-name-cell">
                    <b>{learner.name}</b>
                  </td>
                  <td className="voter-id-cell">
                    <span className="clean-pill id">{learner.voter_id}</span>
                  </td>
                  <td className="grade-cell">
                    <span className="clean-pill grade">{learner.level}</span>
                  </td>
                  <td className="center-text">
                    <div className="table-action-btn-group">
                      <span className="unvoted-pending-tag">⏳ PENDING</span>
                      <button
                        type="button"
                        className="row-pass-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onViewPassword) onViewPassword(learner);
                        }}
                        title="View voter password"
                      >
                        🔑 Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


function ViewPasswordModal({ voter, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyPass() {
    navigator.clipboard.writeText(voter.password || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="voter-modal-overlay" onClick={onClose}>
      <div className="voter-modal-shell pin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="voter-modal-header">
          <div className="modal-header-left">
            <span className="modal-kicker">OFFICIAL VOTER CREDENTIALS</span>
            <h3>Learner Password</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="password-display-card">
          <p className="voter-cred-name"><strong>{voter.name}</strong></p>
          <span className="clean-pill grade">{voter.level}</span>
          <div className="voter-cred-id-line">
            <span>Voter ID:</span> <code>{voter.voter_id}</code>
          </div>

          <div className="password-box-highlight">
            <small>OFFICIAL PASSWORD PIN</small>
            <b className="huge-password-text">{voter.password || "TEMPORARY"}</b>
          </div>

          <button className="primary-button" onClick={copyPass} style={{ marginTop: "12px", width: "100%" }}>
            {copied ? "✓ Copied to Clipboard!" : "📋 Copy Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetConfirmModal({ voter, onConfirm, onCancel, busy }) {
  return (
    <div className="voter-modal-overlay" onClick={onCancel}>
      <div className="voter-modal-shell pin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="voter-modal-header">
          <div className="modal-header-left">
            <span className="modal-kicker text-danger">⚠️ AUTHORIZED RESET</span>
            <h3>Reset Learner Ballot?</h3>
          </div>
          <button className="modal-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="reset-modal-body">
          <p>
            Are you sure you want to reset the ballot for <strong>{voter.name}</strong> (<code>{voter.voter_id}</code>)?
          </p>
          <div className="reset-warning-alert">
            🚨 <b>Warning:</b> This will permanently remove their currently cast vote from all tally tallies and allow the student to log in and re-cast their vote.
          </div>

          <div className="pin-action-row" style={{ marginTop: "16px" }}>
            <button className="sub-tab-btn" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button className="danger-action-btn" onClick={onConfirm} disabled={busy}>
              {busy ? "Resetting..." : "🔄 Confirm & Reset Ballot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoterBallotHistoryModal({ token, voterId, electionCode, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .getVoterBallotHistory(token, voterId, electionCode)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load voter ballot history.");
        setLoading(false);
      });
  }, [token, voterId, electionCode]);

  return (
    <div className="voter-modal-overlay" onClick={onClose}>
      <div className="voter-modal-shell" onClick={(e) => e.stopPropagation()}>
        {/* Streamlined Modal Header */}
        <div className="voter-modal-header">
          <div className="modal-header-left">
            <span className="modal-kicker">OFFICIAL VOTER RECORD</span>
            <h3>{data ? data.learner.name : "Voter Ballot Audit"}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="modal-loading-body">
            <div className="admin-spinner" />
            <span>Loading voter ballot choices…</span>
          </div>
        ) : error ? (
          <div className="modal-error-body">{error}</div>
        ) : !data ? (
          <div className="modal-empty-body">No ballot records found.</div>
        ) : (
          <div className="voter-modal-content">
            {/* Clean Single Profile Row */}
            <div className="modal-voter-hero-compact">
              <div className="modal-avatar-frame">
                <img
                  src={data.learner.photoUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(data.learner.name)}`}
                  alt={data.learner.name}
                  className="modal-voter-img"
                  onError={(e) => {
                    e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(data.learner.name)}`;
                  }}
                />
              </div>

              <div className="modal-voter-info-clean">
                <div className="voter-id-badge-row">
                  <span className="clean-pill grade">{data.learner.level}</span>
                  <span className="clean-pill division">{electionCode}</span>
                  <span className="clean-pill id">ID: {data.learner.voter_id}</span>
                </div>
                {data.receipt && (
                  <div className="voter-receipt-row">
                    <small>Receipt:</small>
                    <code>{data.receipt.receipt_code}</code>
                    <small className="time">• {new Date(data.receipt.submitted_at).toLocaleTimeString()}</small>
                  </div>
                )}
              </div>
            </div>

            {/* Ballot Choices (Clean 2-Column Grid) */}
            <div className="modal-ballot-section">
              <div className="modal-ballot-clean-grid">
                {data.ballot?.map((item, idx) => (
                  <div className="modal-clean-choice-card" key={idx}>
                    <span className="clean-choice-pos">{item.position_title}</span>
                    <div className="clean-choice-candidate">
                      <img
                        src={item.candidate_photo || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(item.candidate_name)}`}
                        alt={item.candidate_name}
                        className="clean-candidate-thumb"
                        onError={(e) => {
                          e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(item.candidate_name)}`;
                        }}
                      />
                      <div className="clean-candidate-meta">
                        <strong>{item.candidate_name}</strong>
                        <small>{item.candidate_party}</small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="voter-modal-footer-clean">
          <button className="modal-close-action-btn" onClick={onClose}>Close Window</button>
        </div>
      </div>
    </div>
  );
}




/* ==========================================================================
   OFFICIAL PRINT / PDF REPORT SUITE (4 COMPREHENSIVE PDF DOCUMENTS)
   ========================================================================== */

function AllPdfReportsContainer({ dashboard, electionCode, printMode }) {
  if (!dashboard) return null;
  const stats = dashboard.stats || { totalEligible: 0, votesCast: 0, turnout: 0, remaining: 0 };
  const results = dashboard.results || [];
  const receipts = dashboard.receipts || [];
  const unvoted = dashboard.unvotedLearners || [];

  // Group candidates by partylist
  const partylistSummary = {};
  let totalPartyVotes = 0;

  results.forEach((pos) => {
    const sorted = [...pos.candidates].sort((a, b) => b.votes - a.votes);
    const topCand = sorted[0];
    const hasWinner = topCand && topCand.votes > 0;

    pos.candidates.forEach((cand) => {
      const party = cand.party?.split(" • ")[0] || cand.party || "Independent";
      if (!partylistSummary[party]) {
        partylistSummary[party] = { name: party, candidates: [], votes: 0, seatsWon: 0 };
      }
      partylistSummary[party].candidates.push({ ...cand, position: pos.title });
      partylistSummary[party].votes += cand.votes;
      totalPartyVotes += cand.votes;

      if (hasWinner && cand.id === topCand.id) {
        partylistSummary[party].seatsWon += 1;
      }
    });
  });

  return (
    <div className={`all-pdf-reports-wrap mode-${printMode}`}>
      {/* 1. MASTER COMPREHENSIVE ELECTION REPORT (7 SECTIONS) */}
      {(printMode === "master" || !printMode) && (
        <div className="printable-pdf-document master-report-doc" id="pdf-master-report">
          <div className="report-print-header">
            <div className="report-header-seal-left">
              <img src="/mabdc_logo.png" alt="MABDC Logo" className="report-seal-img" />
            </div>
            <div className="report-header-titles">
              <p className="deped-rep">Republic of the Philippines • Region VII • Division of Cebu Province</p>
              <h2>M.A. BRAIN DEVELOPMENT CENTER</h2>
              <h4>SUPREME LEARNER GOVERNMENT COMMISSION ON ELECTIONS</h4>
              <p className="report-acad-year">Official Comprehensive Master Election Report • S.Y. 2026–2027</p>
              <span className="report-division-badge">
                {electionCode === "SELG"
                  ? "SUPREME ELEMENTARY LEARNER GOVERNMENT (SELG) • GRADES 4 TO 6"
                  : "SUPREME SECONDARY LEARNER GOVERNMENT (SSLG) • GRADES 7 TO 12"}
              </span>
            </div>
            <div className="report-header-seal-right">
              <div className="report-round-stamp">
                <small>CANVASS</small>
                <b>AUDITED</b>
                <span>2026</span>
              </div>
            </div>
          </div>

          <div className="report-gold-strip" />

          {/* Section I: Executive Turnout Summary */}
          <div className="report-section-block">
            <h3 className="report-section-heading">SECTION I: EXECUTIVE TURNOUT & CANVASS SUMMARY</h3>
            <table className="report-summary-table">
              <tbody>
                <tr>
                  <td><strong>Total Registered Eligible Voters:</strong></td>
                  <td><b>{stats.totalEligible} Learners</b></td>
                  <td><strong>Official Ballots Cast:</strong></td>
                  <td><b className="emerald-val">{stats.votesCast} Ballots</b></td>
                </tr>
                <tr>
                  <td><strong>Pending / Unvoted Learners:</strong></td>
                  <td><b>{stats.remaining} Learners</b></td>
                  <td><strong>Official Voter Turnout Rate:</strong></td>
                  <td><b className="gold-val">{stats.turnout}%</b></td>
                </tr>
                <tr>
                  <td><strong>Date & Time of Official Canvass:</strong></td>
                  <td>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at {new Date().toLocaleTimeString()}</td>
                  <td><strong>Canvass Audit Status:</strong></td>
                  <td><span className="status-pill-official">✓ 100% OFFICIALLY AUDITED</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section II: Proclaimed Official Winners */}
          <div className="report-section-block">
            <h3 className="report-section-heading">SECTION II: ROSTER OF DULY ELECTED & PROCLAIMED OFFICERS</h3>
            <table className="report-data-table winners-table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ width: "25%" }}>OFFICIAL POSITION</th>
                  <th style={{ width: "30%" }}>PROCLAIMED WINNER</th>
                  <th style={{ width: "20%" }}>PARTYLIST AFFILIATION</th>
                  <th style={{ width: "10%" }}>VOTES WON</th>
                  <th style={{ width: "10%" }}>SHARE %</th>
                </tr>
              </thead>
              <tbody>
                {results.map((pos, idx) => {
                  const sorted = [...pos.candidates].sort((a, b) => b.votes - a.votes);
                  const winner = sorted[0];
                  const isExec = pos.title.toLowerCase().includes("president");
                  return (
                    <tr key={pos.id} className={isExec ? "exec-winner-row" : ""}>
                      <td className="center">{idx + 1}</td>
                      <td><strong>{pos.title}</strong></td>
                      <td>
                        <span className="winner-fullname">{winner?.votes > 0 ? winner.name : "NO VOTES RECORDED"}</span>
                        {isExec && <span className="report-exec-tag">EXECUTIVE</span>}
                      </td>
                      <td>{winner?.party || "—"}</td>
                      <td className="center bold-votes">{winner?.votes || 0}</td>
                      <td className="center bold-pct">{winner?.percentage || 0}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section III: Complete Candidate Canvass */}
          <div className="report-section-block">
            <h3 className="report-section-heading">SECTION III: COMPLETE CANDIDATE CANVASS & PARTYLIST VOTE BREAKDOWN</h3>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>POSITION</th>
                  <th style={{ width: "30%" }}>CANDIDATE NAME</th>
                  <th style={{ width: "22%" }}>POLITICAL PARTYLIST</th>
                  <th style={{ width: "12%" }}>VOTES GARNERED</th>
                  <th style={{ width: "12%" }}>OUTCOME</th>
                </tr>
              </thead>
              <tbody>
                {results.map((pos) => {
                  const sorted = [...pos.candidates].sort((a, b) => b.votes - a.votes);
                  const topVotes = sorted[0]?.votes || 0;
                  return pos.candidates.map((cand, cIdx) => {
                    const isWinner = topVotes > 0 && cand.votes === topVotes;
                    return (
                      <tr key={cand.id} className={isWinner ? "row-won" : ""}>
                        {cIdx === 0 ? (
                          <td rowSpan={pos.candidates.length} className="pos-col-span">
                            <b>{pos.title}</b>
                            <small className="tally-count">{pos.totalVotes} total votes</small>
                          </td>
                        ) : null}
                        <td><strong>{cand.name}</strong></td>
                        <td>{cand.party}</td>
                        <td className="center">
                          <b>{cand.votes}</b> <small>({cand.percentage}%)</small>
                        </td>
                        <td className="center">
                          {isWinner ? (
                            <span className="outcome-pill won">🏆 ELECTED</span>
                          ) : (
                            <span className="outcome-pill runner">CONTENDER</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* Section IV: Partylist Performance */}
          <div className="report-section-block">
            <h3 className="report-section-heading">SECTION IV: PARTYLIST PERFORMANCE & SEAT ALLOCATION SUMMARY</h3>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>POLITICAL PARTYLIST</th>
                  <th style={{ width: "15%" }}>CANDIDATES FIELDED</th>
                  <th style={{ width: "15%" }}>SEATS WON</th>
                  <th style={{ width: "18%" }}>TOTAL PARTY VOTES</th>
                  <th style={{ width: "17%" }}>POPULAR VOTE SHARE</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(partylistSummary).map((party, idx) => {
                  const share = totalPartyVotes > 0 ? ((party.votes / totalPartyVotes) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={idx}>
                      <td><strong>{party.name}</strong></td>
                      <td className="center">{party.candidates.length}</td>
                      <td className="center"><b className="seats-won-num">{party.seatsWon}</b></td>
                      <td className="center bold-votes">{party.votes}</td>
                      <td className="center bold-pct">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section V: Verified Voter Participation Audit Ledger */}
          <div className="report-section-block">
            <h3 className="report-section-heading">SECTION V: VERIFIED VOTER PARTICIPATION AUDIT LEDGER ({receipts.length} BALLOTS CAST)</h3>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ width: "20%" }}>RECEIPT CODE</th>
                  <th style={{ width: "35%" }}>LEARNER NAME</th>
                  <th style={{ width: "15%" }}>VOTER ID (LRN)</th>
                  <th style={{ width: "15%" }}>GRADE & SECTION</th>
                  <th style={{ width: "10%" }}>TIME CAST</th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="center" style={{ padding: "12px", color: "#64748b" }}>
                      No verified ballots cast yet in this election.
                    </td>
                  </tr>
                ) : (
                  receipts.map((r, idx) => (
                    <tr key={r.id || idx}>
                      <td className="center">{idx + 1}</td>
                      <td><code className="receipt-code-print">{r.receipt_code}</code></td>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.voter_id}</td>
                      <td>{r.level}</td>
                      <td className="center">{r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Section VI: Pending / Unvoted Learners Roll */}
          <div className="report-section-block">
            <h3 className="report-section-heading">SECTION VI: PENDING / UNVOTED LEARNERS OFFICIAL ROLL ({unvoted.length} LEARNERS)</h3>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ width: "40%" }}>LEARNER NAME</th>
                  <th style={{ width: "25%" }}>VOTER ID (LRN)</th>
                  <th style={{ width: "20%" }}>GRADE LEVEL & SECTION</th>
                  <th style={{ width: "10%" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {unvoted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="center" style={{ padding: "12px", color: "#166534" }}>
                      100% Voter Participation Achieved! All registered learners have voted.
                    </td>
                  </tr>
                ) : (
                  unvoted.map((u, idx) => (
                    <tr key={u.id || idx}>
                      <td className="center">{idx + 1}</td>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.voter_id}</td>
                      <td>{u.level}</td>
                      <td className="center"><span className="status-pending-tag">PENDING</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Section VII: Attestation & Signatures */}
          <div className="report-section-block sig-section">
            <h3 className="report-section-heading">SECTION VII: OFFICIAL LEGAL ATTESTATION & CERTIFICATION</h3>
            <p className="report-cert-statement">
              WE, THE UNDERSIGNED MEMBERS OF THE ELECTION COMMITTEE AND SCHOOL ADMINISTRATION, hereby attest under oath that the foregoing Comprehensive Election Report represents the true, faithful, and official canvass of votes for Academic Year 2026–2027.
            </p>

            <div className="report-signatures-grid">
              <div className="sig-item">
                <div className="sig-line-dark" />
                <strong>Electoral Board Chairperson</strong>
                <small>Commission on Elections (COMELEC)</small>
              </div>
              <div className="sig-item">
                <div className="sig-line-dark" />
                <strong>SELG / SSLG Teacher Adviser</strong>
                <small>Student Leadership Coordinator</small>
              </div>
              <div className="sig-item">
                <div className="sig-line-dark" />
                <strong>School Principal / Administrator</strong>
                <small>M.A. Brain Development Center</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VERIFIED VOTER PARTICIPATION LEDGER (STANDALONE PDF) */}
      {(printMode === "voter_ledger") && (
        <div className="printable-pdf-document voter-ledger-doc" id="pdf-voter-ledger">
          <div className="report-print-header">
            <div className="report-header-seal-left">
              <img src="/mabdc_logo.png" alt="MABDC Logo" className="report-seal-img" />
            </div>
            <div className="report-header-titles">
              <p className="deped-rep">Republic of the Philippines • Region VII • Division of Cebu Province</p>
              <h2>M.A. BRAIN DEVELOPMENT CENTER</h2>
              <h4>VERIFIED VOTER PARTICIPATION AUDIT LEDGER</h4>
              <p className="report-acad-year">Official Audited Ballots Cast • S.Y. 2026–2027</p>
              <span className="report-division-badge">
                {electionCode === "SELG"
                  ? "SUPREME ELEMENTARY LEARNER GOVERNMENT (SELG) • GRADES 4 TO 6"
                  : "SUPREME SECONDARY LEARNER GOVERNMENT (SSLG) • GRADES 7 TO 12"}
              </span>
            </div>
            <div className="report-header-seal-right">
              <div className="report-round-stamp">
                <small>AUDITED</small>
                <b>LEDGER</b>
                <span>2026</span>
              </div>
            </div>
          </div>

          <div className="report-gold-strip" />

          {/* Turnout Strip */}
          <div className="report-section-block">
            <table className="report-summary-table">
              <tbody>
                <tr>
                  <td><strong>Total Registered Voters:</strong> <b>{stats.totalEligible}</b></td>
                  <td><strong>Official Ballots Cast:</strong> <b className="emerald-val">{stats.votesCast}</b></td>
                  <td><strong>Voter Turnout Rate:</strong> <b className="gold-val">{stats.turnout}%</b></td>
                  <td><strong>Date of Audit:</strong> {new Date().toLocaleDateString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Full Voter Roll Table */}
          <div className="report-section-block">
            <h3 className="report-section-heading">COMPLETE RECORD OF VERIFIED BALLOTS CAST ({receipts.length} VOTERS)</h3>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ width: "22%" }}>RECEIPT CODE</th>
                  <th style={{ width: "35%" }}>LEARNER FULL NAME</th>
                  <th style={{ width: "16%" }}>VOTER ID (LRN)</th>
                  <th style={{ width: "12%" }}>GRADE LEVEL</th>
                  <th style={{ width: "10%" }}>TIME CAST</th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="center" style={{ padding: "20px", color: "#64748b" }}>
                      No verified votes have been recorded yet in this election.
                    </td>
                  </tr>
                ) : (
                  receipts.map((r, idx) => (
                    <tr key={r.id || idx}>
                      <td className="center">{idx + 1}</td>
                      <td><code className="receipt-code-print">{r.receipt_code}</code></td>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.voter_id}</td>
                      <td>{r.level}</td>
                      <td className="center">{r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="report-section-block sig-section">
            <p className="report-cert-statement">
              I hereby certify that the above list reflects all officially cast and cryptographically verified ballots recorded in the election database.
            </p>
            <div className="report-signatures-grid">
              <div className="sig-item">
                <div className="sig-line-dark" />
                <strong>Electoral Board Chairperson</strong>
                <small>Commission on Elections (COMELEC)</small>
              </div>
              <div className="sig-item">
                <div className="sig-line-dark" />
                <strong>SELG / SSLG Teacher Adviser</strong>
                <small>Student Leadership Coordinator</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. PENDING / UNVOTED LEARNERS ROLL (STANDALONE PDF) */}
      {(printMode === "unvoted_roll") && (
        <div className="printable-pdf-document unvoted-roll-doc" id="pdf-unvoted-roll">
          <div className="report-print-header">
            <div className="report-header-seal-left">
              <img src="/mabdc_logo.png" alt="MABDC Logo" className="report-seal-img" />
            </div>
            <div className="report-header-titles">
              <p className="deped-rep">Republic of the Philippines • Region VII • Division of Cebu Province</p>
              <h2>M.A. BRAIN DEVELOPMENT CENTER</h2>
              <h4>PENDING & UNVOTED LEARNERS OFFICIAL ROLL</h4>
              <p className="report-acad-year">Voter Attendance & Participation Follow-up • S.Y. 2026–2027</p>
              <span className="report-division-badge">
                {electionCode === "SELG"
                  ? "SUPREME ELEMENTARY LEARNER GOVERNMENT (SELG) • GRADES 4 TO 6"
                  : "SUPREME SECONDARY LEARNER GOVERNMENT (SSLG) • GRADES 7 TO 12"}
              </span>
            </div>
            <div className="report-header-seal-right">
              <div className="report-round-stamp">
                <small>PENDING</small>
                <b>FOLLOW-UP</b>
                <span>2026</span>
              </div>
            </div>
          </div>

          <div className="report-gold-strip" />

          {/* Stats */}
          <div className="report-section-block">
            <table className="report-summary-table">
              <tbody>
                <tr>
                  <td><strong>Total Eligible Registered:</strong> <b>{stats.totalEligible} Learners</b></td>
                  <td><strong>Total Unvoted / Pending:</strong> <b className="gold-val">{stats.remaining} Learners</b></td>
                  <td><strong>Current Participation Rate:</strong> <b className="emerald-val">{stats.turnout}%</b></td>
                  <td><strong>Date of Roll:</strong> {new Date().toLocaleDateString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Unvoted Roll Table */}
          <div className="report-section-block">
            <h3 className="report-section-heading">ROSTER OF REGISTERED LEARNERS WHO HAVE NOT YET CAST BALLOTS ({unvoted.length} LEARNERS)</h3>
            <table className="report-data-table">
              <thead>
                <tr>
                  <th style={{ width: "6%" }}>#</th>
                  <th style={{ width: "44%" }}>LEARNER FULL NAME</th>
                  <th style={{ width: "25%" }}>VOTER ID (LRN)</th>
                  <th style={{ width: "15%" }}>GRADE LEVEL</th>
                  <th style={{ width: "10%" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {unvoted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="center" style={{ padding: "20px", color: "#166534" }}>
                      🎉 Excellent! All registered learners have completed their voting!
                    </td>
                  </tr>
                ) : (
                  unvoted.map((u, idx) => (
                    <tr key={u.id || idx}>
                      <td className="center">{idx + 1}</td>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.voter_id}</td>
                      <td>{u.level}</td>
                      <td className="center"><span className="status-pending-tag">PENDING</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="report-section-block sig-section">
            <div className="report-signatures-grid">
              <div className="sig-item">
                <div className="sig-line-dark" />
                <strong>SELG / SSLG Teacher Adviser</strong>
                <small>Electoral Committee</small>
              </div>
              <div className="sig-item">
                <div className="sig-line-dark" />
                <strong>School Principal / Administrator</strong>
                <small>M.A. Brain Development Center</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportReportModal({ dashboard, electionCode, onClose, onPrintPdf }) {
  function handlePdfExport(mode) {
    onPrintPdf(mode);
  }

  function downloadMasterCSV() {
    if (!dashboard) return;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString();

    const lines = [];
    const addLine = (arr) => lines.push(arr.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(","));
    const addBlank = () => lines.push("");

    addLine(["M.A BRAIN DEVELOPMENT CENTER"]);
    addLine(["OFFICIAL SUPREME LEARNER GOVERNMENT COMPREHENSIVE ELECTION REPORT"]);
    addLine(["ACADEMIC YEAR 2026-2027"]);
    addLine(["Division:", electionCode === "SELG" ? "Supreme Elementary Learner Government (Grades 4-6)" : "Supreme Secondary Learner Government (Grades 7-12)"]);
    addLine(["Report Generated At:", `${dateStr} ${timeStr}`]);
    addBlank();

    addLine(["=== SECTION I: EXECUTIVE TURNOUT SUMMARY ==="]);
    addLine(["Metric Description", "Official Value"]);
    addLine(["Total Eligible Registered Learners", dashboard.stats.totalEligible]);
    addLine(["Official Verified Ballots Cast", dashboard.stats.votesCast]);
    addLine(["Pending / Unvoted Learners", dashboard.stats.remaining]);
    addLine(["Voter Turnout Rate", `${dashboard.stats.turnout}%`]);
    addBlank();

    addLine(["=== SECTION II: PROCLAIMED OFFICIAL WINNERS ==="]);
    addLine(["#", "Official Position", "Proclaimed Winner Name", "Party List Affiliation", "Votes Won", "Vote Share %", "Margin Over Opponent", "Status"]);

    const winnersList = (dashboard.results || []).map((pos, idx) => {
      const sorted = [...pos.candidates].sort((a, b) => b.votes - a.votes);
      const winner = sorted[0];
      const runnerUp = sorted[1];
      const margin = winner && runnerUp ? winner.votes - runnerUp.votes : (winner?.votes || 0);
      return {
        rank: idx + 1,
        position: pos.title,
        name: winner?.votes > 0 ? winner.name : "NO VOTES RECORDED",
        party: winner?.party || "—",
        votes: winner?.votes || 0,
        percentage: `${winner?.percentage || 0}%`,
        margin: winner?.votes > 0 ? `${margin} votes` : "0",
        status: winner?.votes > 0 ? "PROCLAIMED ELECTED" : "PENDING CANVASS"
      };
    });

    winnersList.forEach(w => {
      addLine([w.rank, w.position, w.name, w.party, w.votes, w.percentage, w.margin, w.status]);
    });
    addBlank();

    addLine(["=== SECTION III: COMPLETE CANDIDATE TALLY & PARTYLIST CANVASS ==="]);
    addLine(["Position Title", "Candidate Full Name", "Political Party List", "Total Votes", "Percentage Share", "Is Winner?"]);

    (dashboard.results || []).forEach(pos => {
      const sorted = [...pos.candidates].sort((a, b) => b.votes - a.votes);
      const topVotes = sorted[0]?.votes || 0;
      pos.candidates.forEach(cand => {
        const isWin = topVotes > 0 && cand.votes === topVotes;
        addLine([pos.title, cand.name, cand.party, cand.votes, `${cand.percentage}%`, isWin ? "WINNER (PROCLAIMED)" : "CONTENDER"]);
      });
    });
    addBlank();

    addLine(["=== SECTION IV: PARTYLIST PERFORMANCE & SEAT BREAKDOWN ==="]);
    addLine(["Political Party List", "Candidates Fielded", "Seats Won", "Total Party Votes", "Party Vote Share %"]);

    const partyStats = {};
    let grandTotalVotes = 0;
    (dashboard.results || []).forEach(pos => {
      const sorted = [...pos.candidates].sort((a, b) => b.votes - a.votes);
      const winnerName = sorted[0]?.votes > 0 ? sorted[0].name : null;
      pos.candidates.forEach(cand => {
        const partyKey = cand.party.split(" • ")[0] || cand.party;
        if (!partyStats[partyKey]) {
          partyStats[partyKey] = { name: partyKey, fielded: 0, seatsWon: 0, totalVotes: 0 };
        }
        partyStats[partyKey].fielded += 1;
        partyStats[partyKey].totalVotes += cand.votes;
        grandTotalVotes += cand.votes;
        if (winnerName && cand.name === winnerName) {
          partyStats[partyKey].seatsWon += 1;
        }
      });
    });

    Object.values(partyStats).forEach(ps => {
      const share = grandTotalVotes > 0 ? ((ps.totalVotes / grandTotalVotes) * 100).toFixed(1) : "0.0";
      addLine([ps.name, ps.fielded, ps.seatsWon, ps.totalVotes, `${share}%`]);
    });
    addBlank();

    addLine(["=== SECTION V: VERIFIED VOTER PARTICIPATION AUDIT LEDGER ==="]);
    addLine(["#", "Official Receipt Code", "Learner Full Name", "Voter ID (LRN)", "Grade Level & Section", "Date & Time Cast", "Division"]);

    (dashboard.receipts || []).forEach((r, idx) => {
      addLine([idx + 1, r.receipt_code, r.name, r.voter_id, r.level, r.submitted_at, electionCode]);
    });
    addBlank();

    addLine(["=== SECTION VI: PENDING / UNVOTED LEARNERS ROLL ==="]);
    addLine(["#", "Learner Full Name", "Voter ID (LRN)", "Grade & Section", "Division", "Status"]);

    (dashboard.unvotedLearners || []).forEach((u, idx) => {
      addLine([idx + 1, u.name, u.voter_id, u.level, electionCode, "PENDING / NOT YET VOTED"]);
    });
    addBlank();

    addLine(["=== SECTION VII: OFFICIAL ATTESTATION & CERTIFICATION ==="]);
    addLine(["We, the undersigned members of the Electoral Board and School Administration, hereby certify that this report represents the true and accurate canvass of votes."]);
    addLine(["Prepared by:", "SELG / SSLG Teacher Adviser", "Attested by:", "School Principal / Administrator"]);

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MABDC_Comprehensive_Election_Report_${electionCode}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="voter-modal-overlay" onClick={onClose}>
      <div className="voter-modal-shell report-export-modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="voter-modal-header">
          <div className="modal-header-left">
            <span className="modal-kicker gold">OFFICIAL ELECTORAL ARCHIVE • PDF & DATA EXPORT</span>
            <h3>Download Official Election Reports ({electionCode})</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="report-modal-body">
          <p className="report-modal-subtitle">
            Generate and download official DepEd & School Board-compliant PDF reports and auditable data logs for election records.
          </p>

          <div className="report-options-grid">
            {/* 1. MASTER COMPREHENSIVE PDF REPORT */}
            <div className="report-option-card featured">
              <div className="report-card-badge">⭐ ALL-IN-ONE MASTER PDF</div>
              <div className="report-card-icon">📑</div>
              <div className="report-card-info">
                <h4>Comprehensive Master Election Report (.PDF)</h4>
                <p>Complete 7-section audited document: Executive Turnout, Proclaimed Winners Roster, Candidate Canvass by Position, Partylist Seat Shares, Voter Ledger, and Unvoted Roll.</p>
              </div>
              <div className="report-btn-group">
                <button type="button" className="primary-button full-width download-btn-gold" onClick={() => handlePdfExport("master")}>
                  🖨️ Download Master Report PDF
                </button>
                <button type="button" className="sub-tab-btn full-width" onClick={downloadMasterCSV} style={{ marginTop: '6px', fontSize: '11.5px' }}>
                  📊 Also Download as Master .CSV
                </button>
              </div>
            </div>

            {/* 2. OFFICIAL WINNERS PROCLAMATION CERTIFICATE (PDF) */}
            <div className="report-option-card">
              <div className="report-card-icon">🏆</div>
              <div className="report-card-info">
                <h4>Official Winners & Proclamation Certificate (.PDF)</h4>
                <p>Official proclamation certificate featuring the school gold seal, verified winner rankings with portraits, and signature blocks for school leadership.</p>
              </div>
              <button type="button" className="secondary-button full-width download-btn-emerald" onClick={() => handlePdfExport("winners")}>
                🖨️ Download Proclamation PDF
              </button>
            </div>

            {/* 3. VERIFIED VOTER PARTICIPATION LEDGER (PDF) */}
            <div className="report-option-card">
              <div className="report-card-icon">📜</div>
              <div className="report-card-info">
                <h4>Verified Voter Participation Ledger (.PDF)</h4>
                <p>Audited PDF list of all {dashboard?.stats?.votesCast || 0} cast ballots with receipt codes, LRN identifiers, and submission timestamps.</p>
              </div>
              <button type="button" className="secondary-button full-width" onClick={() => handlePdfExport("voter_ledger")}>
                🖨️ Download Voter Ledger PDF
              </button>
            </div>

            {/* 4. PENDING / UNVOTED ROLL (PDF) */}
            <div className="report-option-card">
              <div className="report-card-icon">⏳</div>
              <div className="report-card-info">
                <h4>Pending / Unvoted Learners Roll (.PDF)</h4>
                <p>Official PDF attendance list of {dashboard?.stats?.remaining || 0} eligible learners who have not yet participated in the election.</p>
              </div>
              <button type="button" className="secondary-button full-width" onClick={() => handlePdfExport("unvoted_roll")}>
                🖨️ Download Unvoted Roll PDF
              </button>
            </div>
          </div>
        </div>

        <div className="voter-modal-footer-clean">
          <button type="button" className="modal-close-action-btn" onClick={onClose}>
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPortal() {
  const [token, setToken] = useState(() => localStorage.getItem("mabdc_admin_token"));
  const [electionCode, setElectionCode] = useState("SELG");
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [selectedVoterId, setSelectedVoterId] = useState(null);
  const [activeTab, setActiveTab] = useState("winners"); // 'winners' | 'grid' | 'audit'
  const [viewingPasswordVoter, setViewingPasswordVoter] = useState(null);
  const [resettingVoter, setResettingVoter] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [printMode, setPrintMode] = useState("master");

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }

  async function handleResetVoter() {
    if (!resettingVoter) return;
    setResetBusy(true);
    try {
      await api.resetVoterBallot(token, resettingVoter.voter_id, electionCode);
      showToast(`✓ Ballot for ${resettingVoter.name} has been reset. Learner can now vote again!`);
      setResettingVoter(null);
      await loadDashboard(false);
    } catch (err) {
      alert(err.message || "Failed to reset ballot.");
    } finally {
      setResetBusy(false);
    }
  }

  async function loadDashboard(showError = true) {
    if (!token) return;
    try {
      const data = await api.adminDashboard(token, electionCode);
      setDashboard(data);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem("mabdc_admin_token");
        setToken(null);
        return;
      }
      if (showError) setError(err.message);
    }
  }


  async function handleCandidatePhotoUpload(candidateId, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      try {
        const res = await fetch(`/api/admin/candidates/${candidateId}/photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ photo_b64: base64 })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        alert("✓ Photo uploaded successfully!");
        loadDashboard(false); // Refresh
      } catch (err) {
        alert("Upload failed: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    setDashboard(null);
    if (!token) return;

    loadDashboard();
    const timer = setInterval(() => {
      loadDashboard(false);
    }, 4000);

    return () => clearInterval(timer);
  }, [token, electionCode]);

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    if (!dashboard?.receipts) return [];
    return dashboard.receipts.filter((r) => {
      const matchesSearch =
        searchQuery === "" ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.voter_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.receipt_code.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLevel =
        filterLevel === "ALL" || (r.level && r.level.toLowerCase().includes(filterLevel.toLowerCase()));

      return matchesSearch && matchesLevel;
    });
  }, [dashboard, searchQuery, filterLevel]);

  // Unique grade levels for filter
  const uniqueLevels = useMemo(() => {
    if (!dashboard?.receipts) return [];
    const set = new Set();
    dashboard.receipts.forEach((r) => {
      if (r.level) set.add(r.level.split(" (")[0]);
    });
    return Array.from(set);
  }, [dashboard]);

  function exportCSV() {
    if (!dashboard?.receipts?.length) return;
    const rows = [
      ["Receipt Code", "Learner Name", "Voter ID", "Grade Level", "Submitted Timestamp", "Division"]
    ];
    dashboard.receipts.forEach((r) => {
      rows.push([
        r.receipt_code,
        `"${r.name}"`,
        r.voter_id,
        `"${r.level}"`,
        r.submitted_at,
        electionCode
      ]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MABDC_${electionCode}_Voter_Participation_Log.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Separate positions into Executive & Council
  const { execPositions, otherPositions } = useMemo(() => {
    if (!dashboard?.results) return { execPositions: [], otherPositions: [] };
    const exec = [];
    const other = [];
    dashboard.results.forEach((p) => {
      if (p.title.toLowerCase().includes("president")) {
        exec.push(p);
      } else {
        other.push(p);
      }
    });
    return { execPositions: exec, otherPositions: other };
  }, [dashboard]);

  if (!token) {
    return <AdminLogin onLogin={setToken} />;
  }

  return (
    <div className="admin-executive-layout">
      {/* Top Glass Executive Bar */}
      <header className="admin-executive-nav">
        <div className="nav-left-brand">
          <Link to="/" className="admin-logo-mark-wrap">
            <img
              src="/mabdc_logo.png"
              alt="MABDC Logo"
              className="admin-nav-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="admin-logo-mark" style={{ display: 'none' }}>M.A</div>
          </Link>
          <div className="admin-header-title-block">
            <div className="admin-live-pulse-tag">
              <span className="green-ping-dot" />
              <span>LIVE COMMAND CENTER</span>
            </div>
            <h2>Election Management Console</h2>
          </div>
        </div>

        {/* Division Selector */}
        <div className="admin-division-tabs">
          <button
            className={`admin-div-btn ${electionCode === "SELG" ? "active selg" : ""}`}
            onClick={() => setElectionCode("SELG")}
          >
            🟢 SELG (Grades 4–6)
          </button>
          <button
            className={`admin-div-btn ${electionCode === "SSLG" ? "active sslg" : ""}`}
            onClick={() => setElectionCode("SSLG")}
          >
            🔵 SSLG (Grades 7–12)
          </button>
        </div>

        {/* Right Tools & Profile */}
        <div className="nav-right-tools">
          <button className="nav-tool-btn report-cta-btn" onClick={() => setShowReportModal(true)} title="Download Comprehensive Election Report">
            📑 Export Report
          </button>
          <Link to="/election/results" target="_blank" className="nav-tool-btn gold">
            📊 Public Scoreboard ↗
          </Link>
          <button className="nav-tool-btn" onClick={() => loadDashboard()}>
            ↻ Sync (4s)
          </button>
          <button
            className="nav-tool-btn logout"
            onClick={() => {
              localStorage.removeItem("mabdc_admin_token");
              setToken(null);
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {error && <div className="admin-error-strip">{error}</div>}

      {!dashboard ? (
        <div className="admin-loading-screen">
          <div className="admin-spinner" />
          <span>Synchronizing election ledger…</span>
        </div>
      ) : (
        <main key={`${electionCode}-${activeTab}`} className="admin-dashboard-body">
          {/* Top Hero Stats */}
          <section className="admin-metrics-grid">
            <MetricCard
              delay={0.06}
              title="Eligible Registered Voters"
              value={dashboard.stats.totalEligible}
              subtext={`${electionCode} Registry (${electionCode === "SELG" ? "Grades 4–6" : "Grades 7–12"})`}
              icon="👥"
              trendColor="blue"
            />
            <MetricCard
              delay={0.14}
              title="Official Ballots Cast"
              value={dashboard.stats.votesCast}
              subtext="Audited & verified receipts"
              icon="🗳️"
              trendColor="emerald"
            />
            <MetricCard
              delay={0.22}
              title="Voter Turnout Rate"
              value={`${dashboard.stats.turnout}%`}
              subtext={`${dashboard.stats.votesCast} of ${dashboard.stats.totalEligible} participated`}
              icon="📈"
              trendColor="gold"
            />
            <MetricCard
              delay={0.30}
              title="Remaining Ballots"
              value={dashboard.stats.remaining}
              subtext="Learners pending participation"
              icon="⏳"
              trendColor="purple"
            />
          </section>

          {/* Module Switcher Tabs */}
          <nav className="admin-sub-nav-tabs">
            <button
              className={`sub-tab-btn ${activeTab === "winners" ? "active" : ""}`}
              onClick={() => setActiveTab("winners")}
            >
              🏆 Official Winners Module
            </button>
            <button
              className={`sub-tab-btn ${activeTab === "grid" ? "active emerald" : ""}`}
              onClick={() => setActiveTab("grid")}
            >
              📊 Live Duel Tally (Grid View)
            </button>
            <button
              className={`sub-tab-btn ${activeTab === "audit" ? "active" : ""}`}
              onClick={() => setActiveTab("audit")}
            >
              📜 Verified Voter Ledger ({filteredReceipts.length})
            </button>
            <button
              className={`sub-tab-btn ${activeTab === "unvoted" ? "active orange" : ""}`}
              onClick={() => setActiveTab("unvoted")}
            >
              ⏳ Pending / Unvoted Learners ({dashboard.unvotedLearners?.length ?? 0})
            </button>
          </nav>

          {/* 1. OFFICIAL WINNERS PROCLAMATION MODULE */}
          {activeTab === "winners" && (
            <WinnersProclamationModule
              results={dashboard.results}
              electionCode={electionCode}
              stats={dashboard.stats}
            />
          )}

          {/* 2. REAL-TIME ELECTION RESULTS (GRID VIEW) */}
          {activeTab === "grid" && (
          <section className="admin-content-section" id="results-grid">
            <div className="section-title-bar">
              <div className="title-left">
                <span className="section-kicker">REAL-TIME TALLY • GRID VIEW</span>
                <h3>{dashboard.election.name}</h3>
              </div>
              <div className="section-tools-right">
                <span className="sync-clock">Live sync: {lastUpdated?.toLocaleTimeString()}</span>
              </div>
            </div>

            {/* EXECUTIVE ROW (2 Columns) */}
            <div className="admin-grid-section-label">
              <span>TIER 01</span>
              <b>EXECUTIVE LEADERSHIP (PRESIDENT & VICE PRESIDENT)</b>
            </div>
            <div className="admin-positions-grid-view grid-2">
              {execPositions.map((pos, idx) => (
                <CandidateVersusAdminCard key={pos.id} position={pos} isExecutive={true} cardIndex={idx} onUploadPhoto={handleCandidatePhotoUpload} />
              ))}
            </div>

            {/* COUNCIL GRID (3 Columns) */}
            {otherPositions.length > 0 && (
              <>
                <div className="admin-grid-section-label margin-top">
                  <span>TIER 02 & 03</span>
                  <b>ADMINISTRATIVE & COUNCIL OFFICERS</b>
                </div>
                <div className="admin-positions-grid-view grid-3">
                  {otherPositions.map((pos, idx) => (
                    <CandidateVersusAdminCard key={pos.id} position={pos} isExecutive={false} cardIndex={execPositions.length + idx} onUploadPhoto={handleCandidatePhotoUpload} />
                  ))}
                </div>
              </>
            )}
          </section>
          )}

          {/* 3. VOTER PARTICIPATION AUDIT LOG */}
          {activeTab === "audit" && (
          <section className="admin-content-section" id="audit-log">
            <div className="section-title-bar">
              <div className="title-left">
                <span className="section-kicker">AUDIT TRAIL • CLICK TO VIEW BALLOT</span>
                <h3>Verified Voter Participation Ledger</h3>
              </div>
              <div className="section-tools-right">
                <button className="export-csv-btn" onClick={exportCSV}>
                  📥 Export CSV Log
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="admin-table-filters-bar">
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search learner name, voter ID, or receipt code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-level-select">
                <span>Grade:</span>
                <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
                  <option value="ALL">All Grades</option>
                  {uniqueLevels.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div className="total-filtered-tag">
                Showing <b>{filteredReceipts.length}</b> of {dashboard.receipts.length} receipts
              </div>
            </div>

            {/* Receipts Table */}
            <div className="admin-table-container">
              <table className="admin-audit-table">
                <thead>
                  <tr>
                    <th style={{ width: "4%" }}>#</th>
                    <th style={{ width: "8%" }}>Photo</th>
                    <th style={{ width: "26%" }}>Learner Name</th>
                    <th style={{ width: "16%" }}>Voter ID (LRN)</th>
                    <th style={{ width: "14%" }}>Grade & Section</th>
                    <th style={{ width: "16%" }}>Receipt Code</th>
                    <th style={{ width: "16%" }} className="center-text">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="table-empty-notice">
                        No voter receipts match your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((r, idx) => (
                      <tr
                        key={r.receipt_code}
                        className="clickable-voter-row"
                        onClick={() => setSelectedVoterId(r.voter_id)}
                      >
                        <td className="row-num">{idx + 1}</td>
                        <td className="row-photo-cell">
                          <img
                            src={`/api/photos/election_photo.php?id=${r.original_id || r.voter_id}`}
                            alt={r.name}
                            className="audit-learner-thumb"
                            onError={(e) => {
                              e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(r.name)}`;
                            }}
                          />
                        </td>
                        <td className="learner-name-cell">
                          <b>{r.name}</b>
                        </td>
                        <td className="voter-id-cell">
                          <span className="clean-pill id">{r.voter_id}</span>
                        </td>
                        <td className="grade-cell">
                          <span className="clean-pill grade">{r.level}</span>
                        </td>
                        <td className="receipt-code-cell">
                          <code>{r.receipt_code}</code>
                          <small className="time-sub">{new Date(r.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>
                        </td>
                        <td className="center-text">
                          <div className="table-action-btn-group" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="row-inspect-btn"
                              onClick={() => setSelectedVoterId(r.voter_id)}
                              title="Inspect learner's full cast ballot"
                            >
                              👁️ View Ballot
                            </button>
                            <button
                              type="button"
                              className="row-pass-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setViewingPasswordVoter(r);
                              }}
                              title="View learner voter password"
                            >
                              🔑 Password
                            </button>
                            <button
                              className="row-reset-btn"
                              onClick={() => setResettingVoter(r)}
                              title="Reset ballot so learner can re-cast"
                            >
                              🔄 Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="admin-privacy-disclaimer">
              💡 <b>Tip:</b> Click on any learner row or the <b>"👁️ View Ballot"</b> button to inspect their complete candidate voting choices in an audited popup window.
            </p>
          </section>
          )}

          {/* 4. UNVOTED / PENDING LEARNERS MODULE */}
          {activeTab === "unvoted" && (
            <UnvotedLearnersModule
              learners={dashboard.unvotedLearners || []}
              electionCode={electionCode}
              onRefresh={() => loadDashboard(false)}
              onViewPassword={setViewingPasswordVoter}
            />
          )}
        </main>
      )}

      {/* Pop-up Modal: Voter Ballot History */}
      {selectedVoterId && (
        <VoterBallotHistoryModal
          token={token}
          voterId={selectedVoterId}
          electionCode={electionCode}
          onClose={() => setSelectedVoterId(null)}
        />
      )}

      {/* Pop-up Modal: View Password */}
      {viewingPasswordVoter && (
        <ViewPasswordModal
          voter={viewingPasswordVoter}
          onClose={() => setViewingPasswordVoter(null)}
        />
      )}

      {/* Pop-up Modal: Reset Confirmation */}
      {resettingVoter && (
        <ResetConfirmModal
          voter={resettingVoter}
          onConfirm={handleResetVoter}
          onCancel={() => setResettingVoter(null)}
          busy={resetBusy}
        />
      )}

      {/* Pop-up Modal: Comprehensive Election Report Export */}
            {/* Hidden for screen, visible for official print / save as PDF */}
      {dashboard && (
        <AllPdfReportsContainer
          dashboard={dashboard}
          electionCode={electionCode}
          printMode={printMode}
        />
      )}

      {showReportModal && dashboard && (
        <ExportReportModal
          dashboard={dashboard}
          electionCode={electionCode}
          onClose={() => setShowReportModal(false)}
          onPrintPdf={(mode) => {
            setPrintMode(mode);
            setTimeout(() => {
              window.print();
            }, 150);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-floating-toast">
          {toastMessage}
        </div>
      )}

      {/* Admin Executive Footer */}
      <footer className="admin-executive-footer">
        <div>
          <b>M.A Brain Development Center</b> • Supreme Learner Government Election Management System
        </div>
        <div>
          <span>Database Engine: SQLite (High Performance)</span>
        </div>
      </footer>
    </div>
  );
}
