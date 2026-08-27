import { Link, Navigate, Route, Routes } from "react-router-dom";
import VotingPortal from "./pages/VotingPortal.jsx";
import AdminPortal from "./pages/AdminPortal.jsx";
import LiveResults from "./pages/LiveResults.jsx";

function Home() {
  return (
    <main className="landing-page">
      <div className="landing-board">
        <div className="landing-logo-container">
          <img
            src="/mabdc_logo.png"
            alt="MABDC Logo"
            className="landing-logo-img"
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'grid';
            }}
          />
          <div className="school-mark" style={{ display: 'none' }}>M.A</div>
        </div>
        <p className="eyebrow light">Academic Year 2026–2027</p>
        <h1>Learner Government<br />Online Election</h1>
        <p className="landing-copy">
          Welcome to the official MABDC election portal. Cast your ballot or view live tally results.
        </p>

        <div className="portal-grid">
          <Link className="portal-card" to="/selg">
            <span className="portal-number">01</span>
            <div>
              <small>Elementary Division (Gr 4-6)</small>
              <h2>SELG Voting Booth</h2>
              <p>Supreme Elementary Learner Government</p>
            </div>
            <span className="portal-arrow">→</span>
          </Link>

          <Link className="portal-card" to="/sslg">
            <span className="portal-number">02</span>
            <div>
              <small>Secondary Division (Gr 7-12)</small>
              <h2>SSLG Voting Booth</h2>
              <p>Supreme Secondary Learner Government</p>
            </div>
            <span className="portal-arrow">→</span>
          </Link>
        </div>

        {/* Prominent Live Results Center Button */}
        <Link className="results-cta-card" to="/results">
          <div className="results-cta-icon">📊</div>
          <div className="results-cta-body">
            <span className="pulse-tag">● LIVE REAL-TIME SCOREBOARD</span>
            <h3>Watch Live Election Results & Turnout</h3>
            <p>Official interactive leaderboard with animated head-to-head vote tracking</p>
          </div>
          <div className="results-cta-arrow">View Results →</div>
        </Link>

        <div className="landing-footer-links">
          <Link className="admin-link" to="/admin">
            Administrator Dashboard ↗
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/selg" element={<VotingPortal electionCode="SELG" />} />
      <Route path="/sslg" element={<VotingPortal electionCode="SSLG" />} />
      <Route path="/results" element={<LiveResults />} />
      <Route path="/results/selg" element={<LiveResults />} />
      <Route path="/results/sslg" element={<LiveResults />} />
      <Route path="/admin" element={<AdminPortal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
