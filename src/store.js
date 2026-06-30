const fs = require("fs");
const path = require("path");

// ─── File-based store ────────────────────────────────────────────────────
// Persists { boxes, skus } to a JSON file on disk so data survives restarts.
// Swap this module out for a real DB later if needed.

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");

function ensureDbFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ boxes: [], skus: [] }, null, 2));
  }
}

function load() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      boxes: Array.isArray(data.boxes) ? data.boxes : [],
      skus: Array.isArray(data.skus) ? data.skus : [],
    };
  } catch (err) {
    console.error(`Failed to read store file at ${DB_FILE}, starting empty:`, err.message);
    return { boxes: [], skus: [] };
  }
}

function save(data) {
  ensureDbFile();
  fs.writeFileSync(DB_FILE, JSON.stringify({ boxes: data.boxes, skus: data.skus }, null, 2));
}

// In-memory cache, kept in sync with disk on every mutation.
const store = load();

function persist() {
  save(store);
}

module.exports = { store, persist, DB_FILE };
