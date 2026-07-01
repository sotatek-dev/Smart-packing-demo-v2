const fs = require("fs");
const path = require("path");

// ─── File-based store ────────────────────────────────────────────────────
// Persists { boxes, skus } to a JSON file on disk so data survives restarts.
// On first run (no db.json yet) the store is seeded with DEFAULT_DATA.
// Swap this module out for a real DB later if needed.

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "db.json");

const DEFAULT_DATA = {
  boxes: [
    { id: "C02P", name: "2 Pack POD Self Locking",  type: "C02P", width:  8.9, length: 14.2, height: 11,   weight: 0.28, loadLimit: 15, active: true },
    { id: "C04P", name: "4 Pack POD Self Locking",  type: "C04P", width: 14.2, length: 17.3, height: 11,   weight: 0.54, loadLimit: 15, active: true },
    { id: "C06P", name: "6 Pack POD Self Locking",  type: "C06P", width: 16.4, length: 22.8, height: 11,   weight: 0.82, loadLimit: 15, active: true },
    { id: "C10P", name: "10 Pack POD Self Locking", type: "C10P", width: 16.4, length: 34.5, height: 11,   weight: 1.24, loadLimit: 15, active: true },
    { id: "C15P", name: "15 Pack POD Self Locking", type: "C15P", width: 23.9, length: 36.3, height: 11,   weight: 1.91, loadLimit: 15, active: true },
    { id: "C25R", name: "25 Pack POD RSC",          type: "C25R", width: 33.4, length: 38.9, height: 11,   weight: 2.86, loadLimit: 15, active: true },
    { id: "C50R", name: "50 Pack POD RSC",          type: "C50R", width: 33.4, length: 38.9, height: 19.3, weight: 5.02, loadLimit: 15, active: true },
    { id: "C40R", name: "40 Pack POD RSC",          type: "C40R", width: 27,   length: 38.9, height: 19.3, weight: 4.05, loadLimit: 15, active: true },
  ],
  skus: [
    { id: "T2N651",      sku_id: "T2N651",      name: "T2N651",      width:  7.62, length:  9.65, height: 7.62, weight: 0.045, color: "#3B82F6", active: true },
    { id: "TW2R42500",   sku_id: "TW2R42500",   name: "TW2R42500",   width:  7.49, length:  8.61, height: 6.4,  weight: 0.054, color: "#10B981", active: true },
    { id: "TW2W99600VQ", sku_id: "TW2W99600VQ", name: "TW2W99600VQ", width: 10.39, length: 10.59, height: 7.8,  weight: 0.22,  color: "#F59E0B", active: true },
    { id: "TW2R63100",   sku_id: "TW2R63100",   name: "TW2R63100",   width: 10.01, length:  3.99, height: 6,    weight: 0.045, color: "#EF4444", active: true },
    { id: "T2P370",      sku_id: "T2P370",      name: "T2P370",      width:  3.1,  length: 19.1,  height: 0.79, weight: 0.318, color: "#8B5CF6", active: true },
  ],
};

function ensureDbFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    // First run — seed with default data
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    console.log(`Store initialised with default data at ${DB_FILE}`);
  }
}

function load() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const data = JSON.parse(raw);
    const boxes = Array.isArray(data.boxes) ? data.boxes : [];
    const skus = Array.isArray(data.skus) ? data.skus : [];

    // Seed default data if the store is empty (first meaningful init)
    if (boxes.length === 0 && skus.length === 0) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
      console.log(`Store is empty — seeded with default data at ${DB_FILE}`);
      return { boxes: [...DEFAULT_DATA.boxes], skus: [...DEFAULT_DATA.skus] };
    }

    return { boxes, skus };
  } catch (err) {
    console.error(`Failed to read store file at ${DB_FILE}, falling back to default data:`, err.message);
    return { boxes: [...DEFAULT_DATA.boxes], skus: [...DEFAULT_DATA.skus] };
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

module.exports = { store, persist, DB_FILE, DEFAULT_DATA };