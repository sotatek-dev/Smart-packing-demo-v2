// ─── API CLIENT ─────────────────────────────────────────────────────────
// Talks to the Express backend (src/server.js) instead of localStorage.
// All packing math now runs server-side in src/packingEngine.js.

const API_BASE = "/api";

async function apiRequest(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

const Api = {
  getSettings: () => apiRequest("/settings"),
  putSettings: (data) => apiRequest("/settings", { method: "PUT", body: JSON.stringify(data) }),

  getBoxes: () => apiRequest("/boxes"),
  createBox: (box) => apiRequest("/boxes", { method: "POST", body: JSON.stringify(box) }),
  updateBox: (id, patch) => apiRequest(`/boxes/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteBox: (id) => apiRequest(`/boxes/${encodeURIComponent(id)}`, { method: "DELETE" }),

  getSkus: () => apiRequest("/skus"),
  createSku: (sku) => apiRequest("/skus", { method: "POST", body: JSON.stringify(sku) }),
  updateSku: (id, patch) => apiRequest(`/skus/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteSku: (id) => apiRequest(`/skus/${encodeURIComponent(id)}`, { method: "DELETE" }),

  optimize: (payload) => apiRequest("/optimize", { method: "POST", body: JSON.stringify(payload) }),
};

window.Api = Api;
