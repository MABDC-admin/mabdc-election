const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  // headers must be pulled out before spreading options: spreading options last
  // would overwrite the merged headers with the caller's own, dropping
  // Content-Type. Without that header express.json() silently skips parsing and
  // the server receives an empty body — which is how ballots were arriving with
  // no selections at all.
  const { headers, ...rest } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {})
    }
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
  },

  uploadCandidatePhoto(token, candidateId, photoB64) {
    return request(`/admin/candidates/${encodeURIComponent(candidateId)}/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photo_b64: photoB64 })
    });
  },

  deleteCandidatePhoto(token, candidateId) {
    return request(`/admin/candidates/${encodeURIComponent(candidateId)}/photo`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  uploadLearnerPhoto(token, voterId, photoB64) {
    return request(`/admin/learners/${encodeURIComponent(voterId)}/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photo_b64: photoB64 })
    });
  },

  deleteLearnerPhoto(token, voterId) {
    return request(`/admin/learners/${encodeURIComponent(voterId)}/photo`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};

/**
 * Downscales a chosen image in the browser and returns it as a JPEG data URI.
 *
 * ID photos come off a camera at 300-450KB each; the admin grid pulls hundreds
 * at once. Resizing here rather than on the server keeps the upload small and
 * avoids a native image dependency on a box that is already tight on memory.
 */
export function resizeImageToDataUri(file, maxDimension = 600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file selected."));
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      return reject(new Error("Choose a JPEG, PNG or WebP image."));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a readable image."));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        // White backdrop: a transparent PNG would otherwise flatten to black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
