import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function CandidateCard({ candidate, selected, onSelect }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      layout
      className={`candidate-card-luxury ${selected ? "selected" : ""}`}
      onClick={onSelect}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="candidate-card-top">
        <div className="candidate-photo-frame">
          <img
            src={candidate.photo_url || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(candidate.name)}`}
            alt={candidate.name}
            className="candidate-large-img"
            onError={(e) => {
              e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(candidate.name)}`;
            }}
          />
          {selected && <div className="photo-selection-badge">✓ SELECTED</div>}
        </div>

        <div className="candidate-primary-info">
          <div className="candidate-name-party-hero">
            <div className="candidate-hero-top">
              <span className="candidate-party-badge-huge">{candidate.party}</span>
              <div className={`candidate-selection-circle ${selected ? "active" : ""}`}>
                {selected ? "✓" : ""}
              </div>
            </div>
            <h2 className="candidate-name-text-huge">{candidate.name}</h2>
          </div>

          <div className="candidate-action-cta-wrap">
            <button
              type="button"
              className={`candidate-select-cta ${selected ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              {selected ? "✓ Candidate Selected" : "Select Candidate →"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PortalLogin({ electionCode, onLogin }) {
  const [voterId, setVoterId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api.voterLogin({ voterId, pin, electionCode });
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="portal-login-page">
      <div className="portal-login-shell">
        <section className="portal-login-board">
          <Link to="/" className="back-home">← All election portals</Link>
          <span className="chalk-kicker">{electionCode} ONLINE ELECTION</span>
          <h1>
            {electionCode === "SELG"
              ? "Elementary Learner Voting Booth"
              : "Secondary Learner Voting Booth"}
          </h1>
          <p>
            One learner. One ballot. At most one choice per position — you may
            leave a position blank. Review all selections before final submission.
          </p>

          <div className="chalk-rules">
            <span>✓ Select exactly one candidate per position</span>
            <span>✓ One candidate is required for every position</span>
            <span>✓ Final receipt is recorded in the admin dashboard</span>
          </div>
        </section>

        <form className="portal-login-form" onSubmit={submit}>
          <div className="brand-logo-container">
            <img
              src="/mabdc_logo.png"
              alt="MABDC"
              className="brand-logo-img large"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'grid';
              }}
            />
            <div className="school-mark dark" style={{ display: 'none' }}>M.A</div>
          </div>
          <p className="eyebrow">M.A Brain Development Center</p>
          <h2>Enter {electionCode} Portal</h2>
          <p className="form-copy">Use your assigned learner voting credentials.</p>

          <label>
            Learner Voter ID (12-Digit LRN or TEMP-XXXX)
            <input
              value={voterId}
              onChange={(e) => setVoterId(e.target.value.trim().toUpperCase())}
              placeholder=""
              autoComplete="username"
              autoFocus
            />
          </label>

          <label>
            Voter Password (6 Letters Capital)
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value.trim().toUpperCase())}
              placeholder=""
              maxLength={6}
              style={{ letterSpacing: "0.2em", fontWeight: "900", textTransform: "uppercase" }}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button className="primary-button full-width" disabled={busy}>
            {busy ? "Checking credentials..." : `Enter ${electionCode} Voting Booth →`}
          </button>

          <p className="demo-hint">
            💡 Enter your 12-digit Learner Reference Number (LRN) or assigned TEMP-XXXX ID and your official 6-letter capital password.
          </p>
        </form>
      </div>
    </main>
  );
}

function ReceiptView({ electionCode, learner, receipt, onReset }) {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onReset();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onReset]);

  return (
    <main className="receipt-page">
      <section className="receipt-paper">
        <div className="receipt-check">✓</div>
        <p className="eyebrow">{electionCode} ELECTION</p>
        <h1>Vote successfully submitted</h1>
        <p>
          Your participation receipt has been saved to the administrator dashboard.
          For ballot privacy, the receipt does not display your candidate choices.
        </p>

        {/* Voter Photo Card */}
        <div className="receipt-voter-card">
          <div className="receipt-voter-photo-frame">
            <img
              src={learner.photoUrl || `/api/photos/election_photo.php?id=${learner.originalId || learner.voterId}`}
              alt={learner.name}
              className="receipt-voter-photo"
              onError={(e) => {
                e.target.src = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(learner.name)}`;
              }}
            />
          </div>
          <div className="receipt-voter-badge-pill">
            <span>OFFICIAL VOTER VERIFIED</span>
          </div>
        </div>

        <div className="receipt-code-card">
          <small>Receipt Code</small>
          <strong>{receipt.receiptCode}</strong>
        </div>

        <div className="receipt-details">
          <div><span>Learner</span><b>{learner.name}</b></div>
          <div><span>Voter ID</span><b>{learner.voterId}</b></div>
          <div><span>Level</span><b>{learner.level}</b></div>
          <div><span>Submitted</span><b>{new Date(receipt.submittedAt).toLocaleString()}</b></div>
        </div>

        {/* 10-Second Countdown Auto-Reset Banner */}
        <div className="receipt-countdown-box">
          <div className="countdown-pulse-ring">
            <span className="countdown-number">{secondsLeft}</span>
          </div>
          <div className="countdown-text-side">
            <b>Returning to voter login in {secondsLeft}s...</b>
            <small>Ready for the next learner in line</small>
          </div>
          <button type="button" className="receipt-exit-now-btn" onClick={onReset}>
            Next Voter Now →
          </button>
        </div>
      </section>
    </main>
  );
}

export default function VotingPortal({ electionCode }) {
  const [ballotData, setBallotData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [session, setSession] = useState(null);
  const [selections, setSelections] = useState({}); // { [positionTitle]: { candidateId, candidateName } }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setBallotData(null);
    setLoadError("");
    api
      .getBallot(electionCode)
      .then(setBallotData)
      .catch((err) => setLoadError(err.message));
  }, [electionCode]);

  const positions = ballotData?.positions || [];

  // Count completed positions
  const completed = useMemo(() => {
    return positions.filter((p) => {
      const chosen = selections[p.title] || selections[p.id];
      return Boolean(chosen);
    }).length;
  }, [positions, selections]);

  const progress = positions.length ? Math.round((completed / positions.length) * 100) : 0;

  function resetBooth() {
    setReceipt(null);
    setSession(null);
    setSelections({});
    setCurrentIndex(0);
    setReviewMode(false);
    setSubmitError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (receipt && session) {
    return (
      <ReceiptView
        electionCode={electionCode}
        learner={session.learner}
        receipt={receipt}
        onReset={resetBooth}
      />
    );
  }

  if (!session) {
    return <PortalLogin electionCode={electionCode} onLogin={setSession} />;
  }

  if (!ballotData && !loadError) {
    return <div className="center-message">Loading {electionCode} ballot…</div>;
  }

  if (loadError) {
    return <div className="center-message error-box">{loadError}</div>;
  }

  const currentPosition = positions[currentIndex] || positions[0];
  const currentChoice = selections[currentPosition?.title] || selections[currentPosition?.id];
  const selectedCandidateId = typeof currentChoice === "object" ? currentChoice?.candidateId : currentChoice;

  function selectCandidate(candidate) {
    if (!currentPosition) return;
    const choiceObj = {
      positionId: currentPosition.id,
      positionTitle: currentPosition.title,
      candidateId: candidate.id,
      candidateName: candidate.name,
      party: candidate.party
    };
    setSelections((current) => ({
      ...current,
      [currentPosition.id]: choiceObj,
      [currentPosition.title]: choiceObj
    }));
  }

  function next() {
    if (!selectedCandidateId) return;
    if (currentIndex < positions.length - 1) {
      setCurrentIndex((value) => value + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setReviewMode(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function editPosition(index) {
    setCurrentIndex(index);
    setReviewMode(false);
  }

    async function submitVote() {
    if (!session) {
      setSubmitError("Please sign in first.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    let currentPositions = positions;
    if (!currentPositions || currentPositions.length === 0) {
      try {
        const fresh = await api.getBallot(electionCode);
        currentPositions = fresh?.positions || [];
      } catch(e) {}
    }

    // Only positions the learner actually chose are sent. Skipped positions are
    // omitted entirely so the ballot records an abstention rather than a vote
    // the learner never cast.
    const payloadSelections = (currentPositions || [])
      .map((position) => {
        const chosen = selections[position.id] || selections[position.title];
        if (!chosen) return null;

        const chosenId = typeof chosen === "object" ? chosen?.candidateId : chosen;
        const chosenName = typeof chosen === "object" ? chosen?.candidateName : "";
        const cand = position.candidates?.find(
          (c) => c.id === Number(chosenId) || (chosenName && c.name === chosenName)
        );
        if (!cand) return null;

        return {
          positionId: position.id,
          positionTitle: position.title,
          candidateId: cand.id,
          candidateName: cand.name
        };
      })
      .filter(Boolean);

    if (payloadSelections.length === 0) {
      setSubmitError("Choose at least one candidate before submitting your ballot.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await api.submitVote(session.token, {
        electionCode,
        selections: payloadSelections
      });
      setReceipt(result.receipt);
    } catch (err) {
      setSubmitError(err.message || "Failed to submit ballot.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="voting-layout">
      <aside className="voting-sidebar">
        <Link to="/" className="sidebar-brand">
          <span className="school-mark small">M.A</span>
          <span>
            <b>MABDC</b>
            <small>{electionCode} Election Portal</small>
          </span>
        </Link>

        <div className="learner-card">
          <img src={session.learner.photoUrl} alt={session.learner.name} />
          <div>
            <strong>{session.learner.name}</strong>
            <span>{session.learner.level}</span>
          </div>
        </div>

        <div className="position-nav">
          {positions.map((position, index) => {
            const hasChosen = Boolean(selections[position.title] || selections[position.id]);
            return (
              <button
                key={position.id}
                className={`${index === currentIndex && !reviewMode ? "active" : ""} ${
                  hasChosen ? "done" : ""
                }`}
                onClick={() => editPosition(index)}
              >
                <span>{hasChosen ? "✓" : index + 1}</span>
                <div>
                  <b>{position.title}</b>
                  <small>{hasChosen ? "Selected" : "Pending"}</small>
                </div>
              </button>
            );
          })}
        </div>

        <div className="privacy-note">
          <b>Ballot privacy</b>
          <span>
            The admin receipt confirms participation but does not reveal the learner's selections.
          </span>
        </div>
      </aside>

      <main className="voting-main">
        <header className="voting-topbar">
          <div>
            <p className="eyebrow">{ballotData.election.name}</p>
            <h1>{reviewMode ? "Review your ballot" : currentPosition?.title}</h1>
          </div>

          <div className="progress-widget">
            <div>
              <span>Ballot Progress</span>
              <b>{completed}/{positions.length}</b>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        {!reviewMode && currentPosition ? (
          <>
            <section className="classroom-banner">
              <div>
                <span className="chalk-kicker dark-kicker">YOUR VOICE • YOUR CHOICE</span>
                <h2>Choose one candidate for {currentPosition.title}.</h2>
                <p>
                  Read each candidate's name, party, and platform before making your selection.
                </p>
              </div>
              <div className="ballot-illustration">
                <div className="paper-slip">✓</div>
                <div className="ballot-box-mini" />
              </div>
            </section>

            <section className="candidate-section">
              <div className="section-heading">
                <div>
                  <h2>Candidates</h2>
                  <p>Exactly one selection is required.</p>
                </div>
                <span className="required-badge">Required</span>
              </div>

              <div className="candidate-grid">
                {currentPosition.candidates.map((candidate) => {
                  const isSelected =
                    selectedCandidateId === candidate.id ||
                    (typeof currentChoice === "object" && currentChoice?.candidateName === candidate.name);

                  return (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      selected={isSelected}
                      onSelect={() => selectCandidate(candidate)}
                    />
                  );
                })}
              </div>

              <div className="ballot-navigation">
                <button
                  className="secondary-button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((value) => value - 1)}
                >
                  ← Previous
                </button>
                <button
                  className="primary-button"
                  disabled={!selectedCandidateId}
                  onClick={next}
                >
                  {currentIndex === positions.length - 1
                    ? "Review Ballot →"
                    : "Next Position →"}
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="review-panel">
            <div className="review-intro">
              <span className="chalk-kicker dark-kicker">FINAL REVIEW</span>
              <h2>Check every position before submitting.</h2>
              <p>
                Once submitted, this learner account cannot cast another ballot for the same election.
              </p>
            </div>

            <div className="review-list">
              {positions.map((position, index) => {
                const chosen = selections[position.title] || selections[position.id];
                const chosenId = typeof chosen === "object" ? chosen.candidateId : chosen;
                const chosenName = typeof chosen === "object" ? chosen.candidateName : "";
                const candidate = position.candidates.find(
                  (c) => c.id === chosenId || (chosenName && c.name === chosenName)
                );
                const isMissing = !candidate;

                return (
                  <div className={`review-row ${isMissing ? "missing-choice" : ""}`} key={position.id}>
                    <div className="review-number">{index + 1}</div>
                    <div className="review-position">
                      <small>{position.title}</small>
                      {isMissing ? (
                        <b style={{ color: "#ef4444" }}>⚠️ No candidate selected yet</b>
                      ) : (
                        <>
                          <b>{candidate.name}</b>
                          <span>{candidate.party}</span>
                        </>
                      )}
                    </div>
                    <button onClick={() => editPosition(index)}>
                      {isMissing ? "Select →" : "Change"}
                    </button>
                  </div>
                );
              })}
            </div>

            {submitError && <div className="error-box">{submitError}</div>}

            <div className="ballot-navigation">
              <button
                className="secondary-button"
                onClick={() => setReviewMode(false)}
              >
                ← Back to Ballot
              </button>
              <button
                className="primary-button"
                disabled={submitting}
                onClick={submitVote}
              >
                {submitting ? "Saving ballot..." : "Submit Final Vote ✓"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
