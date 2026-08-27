const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  getBallot(code) {
    return request(`/elections/${code}/ballot`);
  },

  voterLogin(payload) {
    return request("/auth/voter", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  submitVote(token, payload) {
    return request("/votes/submit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  },

  adminLogin(payload) {
    return request("/admin/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  adminDashboard(token, electionCode) {
    return request(`/admin/dashboard?election=${encodeURIComponent(electionCode)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  getVoterBallotHistory(token, voterId, electionCode) {
    return request(`/admin/voter/${encodeURIComponent(voterId)}/ballot?election=${encodeURIComponent(electionCode)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

    resetVoterBallot(token, voterId, electionCode) {
    return request(`/admin/voter/${encodeURIComponent(voterId)}/reset?election=${encodeURIComponent(electionCode)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  getLiveResults(code) {
    return request(`/elections/${code}/live-results`);
  }
};
