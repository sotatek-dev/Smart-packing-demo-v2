// ─── APP STATE ───────────────────────────────────────────────────────────
const DEFAULT_DATA = {
  boxes: [
    { id: "C02P", name: "2 Pack POD Self Locking", type: "C02P", width: 8.9, length: 14.2, height: 11, weight: 0.28, loadLimit: 15, active: true },
    { id: "C04P", name: "4 Pack POD Self Locking", type: "C04P", width: 14.2, length: 17.3, height: 11, weight: 0.54, loadLimit: 15, active: true },
    { id: "C06P", name: "6 Pack POD Self Locking", type: "C06P", width: 16.4, length: 22.8, height: 11, weight: 0.82, loadLimit: 15, active: true },
    { id: "C10P", name: "10 Pack POD Self Locking", type: "C10P", width: 16.4, length: 34.5, height: 11, weight: 1.24, loadLimit: 15, active: true },
    { id: "C15P", name: "15 Pack POD Self Locking", type: "C15P", width: 23.9, length: 36.3, height: 11, weight: 1.91, loadLimit: 15, active: true },
    { id: "C25R", name: "25 Pack POD RSC", type: "C25R", width: 33.4, length: 38.9, height: 11, weight: 2.86, loadLimit: 15, active: true },
    { id: "C50R", name: "50 Pack POD RSC", type: "C50R", width: 33.4, length: 38.9, height: 19.3, weight: 5.02, loadLimit: 15, active: true },
    { id: "C40R", name: "40 Pack POD RSC", type: "C40R", width: 27, length: 38.9, height: 19.3, weight: 4.05, loadLimit: 15, active: true },
  ],
  skus: [
    { sku_id: "T2N651", name: "T2N651", width: 7.62, length: 9.65, height: 7.62, weight: 0.045, color: "#3B82F6", active: true },
    { sku_id: "TW2R42500", name: "TW2R42500", width: 7.49, length: 8.61, height: 6.4, weight: 0.054, color: "#10B981", active: true },
    { sku_id: "TW2W99600VQ", name: "TW2W99600VQ", width: 10.39, length: 10.59, height: 7.8, weight: 0.22, color: "#F59E0B", active: true },
    { sku_id: "TW2R63100", name: "TW2R63100", width: 10.01, length: 3.99, height: 6, weight: 0.045, color: "#EF4444", active: true },
    { sku_id: "T2P370", name: "T2P370", width: 3.1, length: 19.1, height: 0.79, weight: 0.318, color: "#8B5CF6", active: true },
  ],
};

const FREIGHT_TARIFF_PER_KG = 8;

let settingsData = { boxes: [], skus: [] };
window.settingsData = settingsData;
let searchQueries = { boxes: "", skus: "" };

const SKU_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#F97316", "#06B6D4"];

let S = {
  boxId: null,
  qty: {},
  placedQty: {},
  layout: [],
  layerDefs: [],
  totalWeight: 0,
  optimized: false,
  isManual: false,
  boxesData: [],
  activeBoxIdx: 0,
  summary: null,
};
window.S = S;

const freightTariffEl = document.getElementById("rp-freight-tariff");
if (freightTariffEl) freightTariffEl.textContent = `Tariff: ${FREIGHT_TARIFF_PER_KG} $/kg`;

// ─── HELPERS ─────────────────────────────────────────────────────────────
function getEntityId(item) {
  return item.sku_id || item.id;
}

function getVolumetricWeight(box, divisor = 6000) {
  return (box.length * box.width * box.height) / divisor;
}

// ─── LOAD / SEED SETTINGS FROM THE SERVER ────────────────────────────────
async function fetchSettings() {
  try {
    let data = await Api.getSettings();
    if ((!data.boxes || !data.boxes.length) && (!data.skus || !data.skus.length)) {
      // Empty store — seed it with the demo catalog on first run.
      data = await Api.putSettings(DEFAULT_DATA);
    }
    settingsData.boxes = data.boxes || [];
    settingsData.skus = data.skus || [];
    window.settingsData = settingsData;
  } catch (err) {
    console.error("Failed to load settings from server:", err);
    showToast("Could not reach the server API", "error");
  }

  renderAll();
  initConfigPanel();
  initSkuList();
}

function renderAll() {
  renderBoxTemplates();
  renderSkus();
  renderBoxOptions();
}

// ─── TOAST NOTIFICATION ─────────────────────────────────────────────────
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "";
  if (type === "success")
    icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ed573" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  if (type === "error")
    icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

// ─── SETTINGS RENDER LOGIC ───────────────────────────────────────────────
function renderBoxTemplates() {
  const grid = document.querySelector("#tab-box-template .entity-grid");
  if (!grid) return;
  const q = searchQueries.boxes.toLowerCase();
  const filtered = settingsData.boxes.filter(
    (p) => (p.name || "").toLowerCase().includes(q) || (p.type || "").toLowerCase().includes(q),
  );

  if (filtered.length === 0 && q) {
    grid.innerHTML = '<div class="fcst-empty" style="grid-column: 1/-1">No boxes match your search.</div>';
    return;
  }
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="fcst-empty" style="grid-column: 1/-1">No boxes yet. Click "+ Add Box" to create one.</div>';
    return;
  }

  grid.innerHTML = filtered
    .map(
      (p) => `
      <div class="entity-card ${p._new ? "new-record-highlight" : ""}" data-id="${p.id}" ${p._new ? 'data-just-added="true"' : ""}>
        <div class="card-row">
          <div class="field-group full">
            <div class="field-label">Box Template Name</div>
            <input type="text" class="input-inline" value="${p.name}" onchange="updateEntity('boxes','${p.id}','name',this.value)">
          </div>
        </div>
        <div class="card-row">
          <div class="field-group">
            <div class="field-label">Type</div>
            <input type="text" class="input-inline" value="${p.type}" onchange="updateEntity('boxes','${p.id}','type',this.value)">
          </div>
          <div class="field-group">
            <div class="field-label">Width (cm)</div>
            <input type="number" class="input-inline" value="${p.width}" onchange="updateEntity('boxes','${p.id}','width',parseFloat(this.value)||0)">
          </div>
          <div class="field-group">
            <div class="field-label">Length (cm)</div>
            <input type="number" class="input-inline" value="${p.length}" onchange="updateEntity('boxes','${p.id}','length',parseFloat(this.value)||0)">
          </div>
          <div class="field-group">
            <div class="field-label">Max Height (cm)</div>
            <input type="number" class="input-inline" value="${p.height}" onchange="updateEntity('boxes','${p.id}','height',parseFloat(this.value)||0)">
          </div>
          <div class="field-group">
            <div class="field-label">Weight (kg)</div>
            <input type="number" class="input-inline" value="${p.weight}" onchange="updateEntity('boxes','${p.id}','weight',parseFloat(this.value)||0)">
          </div>
          <div class="field-group">
            <div class="field-label">Max Load (kg)</div>
            <input type="number" class="input-inline" value="${p.loadLimit}" onchange="updateEntity('boxes','${p.id}','loadLimit',parseFloat(this.value)||0)">
          </div>
        </div>
        <div class="card-footer">
          <div class="toggle-item">
            <span>Active Status</span>
            <label class="toggle-switch">
              <input type="checkbox" ${p.active ? "checked" : ""} onchange="updateEntity('boxes','${p.id}','active',this.checked)">
              <span class="slider"></span>
            </label>
          </div>
          <button class="btn-icon-sm" onclick="deleteEntity('boxes','${p.id}')" title="Delete Box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `,
    )
    .join("");

  const firstCard = grid.firstElementChild;
  if (firstCard && firstCard.dataset.justAdded === "true") {
    firstCard.classList.add("new-record-highlight");
    setTimeout(() => firstCard.querySelector("input")?.focus(), 100);
    setTimeout(() => {
      firstCard.removeAttribute("data-just-added");
      settingsData.boxes.forEach((p) => delete p._new);
    }, 2000);
  }
}

function renderSkus() {
  const grid = document.querySelector("#tab-sku .entity-grid");
  if (!grid) return;
  const q = searchQueries.skus.toLowerCase();
  const filtered = settingsData.skus.filter((b) => (b.name || "").toLowerCase().includes(q));

  if (filtered.length === 0 && q) {
    grid.innerHTML = '<div class="fcst-empty" style="grid-column: 1/-1">No SKUs match your search.</div>';
    return;
  }
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="fcst-empty" style="grid-column: 1/-1">No SKUs yet. Click "+ Add SKU" to create one.</div>';
    return;
  }

  grid.innerHTML = filtered
    .map((b) => {
      const bid = getEntityId(b);
      return `
        <div class="entity-card ${b._new ? "new-record-highlight" : ""}" data-id="${bid}" ${b._new ? 'data-just-added="true"' : ""}>
          <div class="card-row">
            <div class="field-group full">
              <div class="field-label">SKU Name</div>
              <input type="text" class="input-inline" value="${b.name}" onchange="updateEntity('skus','${bid}','name',this.value)">
            </div>
          </div>
          <div class="card-row">
            <div class="field-group">
              <div class="field-label">Width (cm)</div>
              <input type="number" class="input-inline" value="${b.width}" onchange="updateEntity('skus','${bid}','width',parseFloat(this.value)||0)">
            </div>
            <div class="field-group">
              <div class="field-label">Length (cm)</div>
              <input type="number" class="input-inline" value="${b.length}" onchange="updateEntity('skus','${bid}','length',parseFloat(this.value)||0)">
            </div>
            <div class="field-group">
              <div class="field-label">Height (cm)</div>
              <input type="number" class="input-inline" value="${b.height}" onchange="updateEntity('skus','${bid}','height',parseFloat(this.value)||0)">
            </div>
            <div class="field-group">
              <div class="field-label">Weight (kg)</div>
              <input type="number" class="input-inline" value="${b.weight}" onchange="updateEntity('skus','${bid}','weight',parseFloat(this.value)||0)">
            </div>
          </div>
          <div class="card-footer">
            <div class="toggles-group">
              <div class="toggle-item">
                <span>Active</span>
                <label class="toggle-switch">
                  <input type="checkbox" ${b.active ? "checked" : ""} onchange="updateEntity('skus','${bid}','active',this.checked)">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
            <div class="toggles-group">
              <div class="toggle-item">
                <span>Color</span>
                <input type="color" value="${b.color || "#3B82F6"}" onchange="updateEntity('skus','${bid}','color',this.value)" style="width:30px;height:24px;border:none;padding:0;cursor:pointer">
              </div>
            </div>
            <button class="btn-icon-sm" onclick="deleteEntity('skus','${bid}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  const firstCard = grid.firstElementChild;
  if (firstCard && firstCard.dataset.justAdded === "true") {
    firstCard.classList.add("new-record-highlight");
    setTimeout(() => firstCard.querySelector("input")?.focus(), 100);
    setTimeout(() => {
      firstCard.removeAttribute("data-just-added");
      settingsData.skus.forEach((p) => delete p._new);
    }, 2000);
  }
}

function handleSearch(type, val) {
  searchQueries[type] = val;
  if (type === "boxes") {
    renderBoxTemplates();
    renderBoxOptions();
  }
  if (type === "skus") renderSkus();
}
window.handleSearch = handleSearch;

// ─── CRUD OPERATIONS (via backend API) ──────────────────────────────────
async function addEntity(type) {
  try {
    const created = type === "boxes" ? await Api.createBox({}) : await Api.createSku({});
    created._new = true;
    settingsData[type].unshift(created);
    renderAll();
    initSkuList();
    showToast(`New ${type === "boxes" ? "box" : "SKU"} added!`);

    const overlay = document.getElementById("settings-modal-overlay");
    if (overlay && !overlay.classList.contains("show")) overlay.classList.add("show");
    const tabId = type === "boxes" ? "tab-box-template" : "tab-sku";
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.toggle("active", pane.id === tabId));

    const newId = getEntityId(created);
    setTimeout(() => {
      const card = document.querySelector(`.entity-card[data-id="${newId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.querySelector("input")?.focus();
      }
    }, 60);
  } catch (err) {
    showToast(err.message || "Failed to add record", "error");
  }
}
window.addEntity = addEntity;

async function updateEntity(type, id, field, value) {
  const item = settingsData[type].find((i) => i.id === id || i.sku_id === id);
  if (!item) return;
  const prevValue = item[field];
  item[field] = value; // optimistic update
  try {
    const updated = type === "boxes" ? await Api.updateBox(id, { [field]: value }) : await Api.updateSku(id, { [field]: value });
    Object.assign(item, updated);
  } catch (err) {
    item[field] = prevValue; // revert on failure
    showToast(err.message || "Failed to save change", "error");
    renderAll();
  }
  if (type === "skus") initSkuList();
  else initConfigPanel();
}
window.updateEntity = updateEntity;

function deleteEntity(type, id) {
  const label = type === "boxes" ? "box" : "SKU";
  showConfirm(`Are you sure you want to delete this ${label}?`, async () => {
    try {
      if (type === "boxes") await Api.deleteBox(id);
      else await Api.deleteSku(id);
      settingsData[type] = settingsData[type].filter((i) => i.id !== id && i.sku_id !== id);
      renderAll();
      initSkuList();
      showToast("Record deleted");
    } catch (err) {
      showToast(err.message || "Failed to delete record", "error");
    }
  });
}
window.deleteEntity = deleteEntity;

function showConfirm(message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="confirm-box-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </div>
        <div>
          <div class="confirm-box-title">Confirm Delete</div>
          <div class="confirm-box-msg">${message}</div>
        </div>
      </div>
      <div class="confirm-box-actions">
        <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
        <button class="btn btn-primary" id="confirm-ok" style="background:var(--danger)">Delete</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 180);
  };
  overlay.querySelector("#confirm-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#confirm-ok").addEventListener("click", () => {
    close();
    onConfirm();
  });
}

// ─── SETTINGS MODAL ──────────────────────────────────────────────────────
const btnSettings = document.getElementById("btn-settings");
const modalOverlay = document.createElement("div");
modalOverlay.className = "modal-overlay";
modalOverlay.id = "settings-modal-overlay";
modalOverlay.innerHTML = `
  <div class="settings-modal">
    <div class="modal-hdr">
      <h2>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Entity Configuration
      </h2>
      <button class="btn-icon-sm" id="close-modal" style="border:none; background:transparent">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="modal-content-wrap">
      <div class="modal-sidebar">
        <div class="sidebar-nav">
          <div class="nav-item active" data-tab="box-template">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line><line x1="12" y1="3" x2="12" y2="21"></line></svg>
            Boxes
          </div>
          <div class="nav-item" data-tab="sku">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
            SKUs
          </div>
        </div>
      </div>
      <div class="modal-main">
        <div class="settings-sec active" id="tab-box-template">
          <div class="sec-hdr">
            <h3>Box Templates</h3>
            <div class="search-wrap">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search boxes..." oninput="handleSearch('boxes', this.value)">
            </div>
            <button class="btn-add" onclick="addEntity('boxes')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Box
            </button>
          </div>
          <div class="entity-grid"></div>
        </div>
        <div class="settings-sec" id="tab-sku">
          <div class="sec-hdr">
            <h3>SKU Catalog</h3>
            <div class="search-wrap">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search SKUs..." oninput="handleSearch('skus', this.value)">
            </div>
            <button class="btn-add" onclick="addEntity('skus')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add SKU
            </button>
          </div>
          <div class="entity-grid"></div>
        </div>
      </div>
    </div>
    <div class="modal-ftr">
      <button class="btn-close" style="background:#eee; color:#333; border:none" id="cancel-settings">Close</button>
      <button class="btn-add" id="save-settings">Close</button>
    </div>
  </div>
`;
document.body.appendChild(modalOverlay);

const navItems = modalOverlay.querySelectorAll(".nav-item");
const sections = modalOverlay.querySelectorAll(".settings-sec");
navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((ni) => ni.classList.remove("active"));
    sections.forEach((sec) => sec.classList.remove("active"));
    item.classList.add("active");
    document.getElementById("tab-" + item.dataset.tab).classList.add("active");
  });
});

btnSettings.onclick = () => {
  renderBoxTemplates();
  renderSkus();
  renderBoxOptions();
  modalOverlay.classList.add("show");
};
const closeModal = () => modalOverlay.classList.remove("show");
document.getElementById("close-modal").onclick = closeModal;
document.getElementById("cancel-settings").onclick = closeModal;
document.getElementById("save-settings").onclick = closeModal;

// ─── SKU LIST (left panel) ───────────────────────────────────────────────
function initSkuList() {
  const el = document.getElementById("sku-list");
  if (!el) return;

  if (!settingsData.skus || settingsData.skus.length === 0) {
    el.innerHTML = '<div class="fcst-empty">No SKUs found. Add one in Settings.</div>';
    return;
  }

  const activeSkus = settingsData.skus.filter((b) => b.active);
  if (activeSkus.length === 0) {
    el.innerHTML = '<div class="fcst-empty">No active SKUs to select. Check settings.</div>';
    return;
  }

  activeSkus.forEach((b) => {
    const id = b.sku_id || b.id;
    if (S.qty[id] === undefined) S.qty[id] = 0;
  });

  el.innerHTML = activeSkus
    .map((b) => {
      const id = b.sku_id || b.id;
      const skuColor = b.color || "#3B82F6";
      return `
        <div class="sku-row${S.qty[id] > 0 ? " active" : ""}" id="row-${id}">
          <div class="sku-dot" style="background:${skuColor}"></div>
          <div class="sku-info">
            <div class="sku-name">${b.name}</div>
            <div class="sku-dim">${b.width}×${b.length}×${b.height}cm · ${b.weight}kg</div>
          </div>
          <div class="qty-ctrl">
            <button class="qty-b" data-id="${id}" data-d="-1">−</button>
            <input type="number" class="qty-n" data-id="${id}" value="${S.qty[id] || 0}" min="0">
            <button class="qty-b" data-id="${id}" data-d="1">+</button>
          </div>
        </div>
      `;
    })
    .join("");

  el.querySelectorAll(".qty-b").forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id,
        d = +e.currentTarget.dataset.d;
      S.qty[id] = Math.max(0, (S.qty[id] || 0) + d);
      const input = el.querySelector(`input.qty-n[data-id="${id}"]`);
      if (input) input.value = S.qty[id];
      refreshRow(id);
      updateSummary();
    }),
  );

  el.querySelectorAll(".qty-n").forEach((i) =>
    i.addEventListener("input", (e) => {
      S.qty[e.target.dataset.id] = Math.max(0, parseInt(e.target.value) || 0);
      refreshRow(e.target.dataset.id);
      updateSummary();
    }),
  );
}

function refreshRow(id) {
  const r = document.getElementById("row-" + id);
  if (!r) return;
  r.className = "sku-row" + (S.qty[id] > 0 ? " active" : "");
}

// ─── CONFIG PANEL (box picker cards) ─────────────────────────────────────
function initConfigPanel() {
  renderBoxOptions();
}

function renderBoxOptions() {
  const el = document.getElementById("box-opts");
  if (!el) return;
  const boxes = settingsData.boxes.filter((p) => p.active).sort((a, b) => a.width * a.length - b.width * b.length);
  if (!boxes.length) {
    el.innerHTML = '<div class="fcst-empty">No active boxes. Add boxes in Settings.</div>';
    return;
  }

  el.innerHTML = boxes
    .map((p) => {
      let boxCount = 0;
      if (S.optimized) {
        S.boxesData.forEach((boxData) => {
          if (boxData.boxId == p.id) boxCount++;
        });
      }
      let boxCountText = "";
      let deckActive = "";
      if (boxCount) {
        boxCountText = " x" + boxCount;
        deckActive = "deck-opt-active";
      }
      return `
      <div class="deck-opt ${deckActive}" data-id="${p.id}">
        <div class="deck-opt-hd">
          <span class="deck-opt-name">${p.name}<span class="deck-opt-count">${boxCountText}</span></span>
          <span class="deck-badge">${p.type || "STD"}</span>
        </div>
        <div class="deck-specs">
          <div class="deck-spec">
            <svg class="spec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            ${p.width}×${p.length}×${p.height}cm/${p.weight}kg
          </div>
          <div class="deck-spec">
            <svg class="spec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
            Max load ${(p.loadLimit ?? 0).toLocaleString()}kg
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  const badge = document.getElementById("available-boxes-count-badge");
  if (badge) badge.textContent = boxes.length;
}

// ─── SUMMARY (header metrics + right panel) ──────────────────────────────
function updateSummary() {
  const skuCount = S.optimized && S.summary ? S.summary.totalSkusPacked : 0;
  document.getElementById("sum-skus").textContent = S.optimized ? skuCount : "—";
  document.getElementById("sum-boxes").textContent = S.optimized ? S.boxesData.length : "—";
  if (S.optimized) computeEfficiency();
}

function computeEfficiency() {
  if (!S.summary) {
    document.getElementById("sum-eff").textContent = "—";
    const se = document.getElementById("sum-space-eff");
    if (se) se.textContent = "—";
    return;
  }
  document.getElementById("sum-eff").textContent = S.summary.totalWeight.toFixed(3);
  const spaceEl = document.getElementById("sum-space-eff");
  if (spaceEl) spaceEl.textContent = Math.round(S.summary.spaceEfficiencyPct).toString();
}

function updateStats() {
  const headerCostEl = document.getElementById("header-total-cost");
  if (!S.summary) {
    if (headerCostEl) headerCostEl.textContent = "—";
    return;
  }
  if (headerCostEl) {
    headerCostEl.textContent = S.summary.totalFreightCost.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const group = S.boxesData[S.activeBoxIdx];
  if (!group) return;
  const dims = group.dimensions || {};

  let usedVolume = 0;
  group.layout.forEach((it) => {
    usedVolume += it.w * it.d * it.h;
  });
  const totalVolume = (dims.width || 0) * (dims.depth || 0) * (dims.height || 0);
  const efficiency = totalVolume > 0 ? (usedVolume / totalVolume) * 100 : 0;
  const effEl = document.getElementById("rp-eff");
  if (effEl) effEl.textContent = Math.round(efficiency);

  const weightEl = document.getElementById("rp-weight");
  if (weightEl) weightEl.textContent = group.totalWeight.toFixed(3);

  const volWeightEl = document.getElementById("rp-vol-wt");
  const volWeight = getVolumetricWeight({ length: dims.depth, width: dims.width, height: dims.height });
  if (volWeightEl) volWeightEl.textContent = volWeight.toFixed(2);

  const freightEl = document.getElementById("rp-freight-cost");
  if (freightEl) freightEl.textContent = group.freightCost.toFixed(2);
}

function updateSKUPlaced() {
  const summaryEl = document.getElementById("sku-summary");
  if (!summaryEl || !S.boxesData || !S.boxesData.length) return;

  const group = S.boxesData[S.activeBoxIdx];
  if (!group || !group.layout) return;

  const counts = group.placedQty || {};
  let html = "";
  settingsData.skus.forEach((sku) => {
    const placed = counts[sku.sku_id] || 0;
    if (placed > 0) {
      html += `
        <div class="sku-summary-item">
          <div class="sku-color-dot" style="background: ${sku.color}"></div>
          <div style="flex:1; font-weight:600;">${sku.name}</div>
          <div style="font-family:var(--mono); color:var(--primary); font-weight:700;">x${placed}</div>
        </div>
      `;
    }
  });
  summaryEl.innerHTML = html || '<div style="font-size:12px; color:var(--text-muted)">No items in this box</div>';
}

// ─── OPTIMIZE (delegates the packing algorithm to the backend) ──────────
async function runOptimize() {
  const activeBoxes = settingsData.boxes.filter((p) => p.active);
  if (!activeBoxes.length) {
    showToast("No active box templates found. Add boxes in Settings.", "error");
    return;
  }

  const quantities = {};
  let anyQty = false;
  settingsData.skus
    .filter((b) => b.active)
    .forEach((b) => {
      const id = b.sku_id || b.id;
      if (S.qty[id] > 0) {
        quantities[id] = S.qty[id];
        anyQty = true;
      }
    });

  if (!anyQty) {
    showToast("Please select at least one SKU with quantity > 0", "error");
    return;
  }

  document.getElementById("vis-empty").style.display = "none";

  let result;
  try {
    result = await Api.optimize({ quantities });
  } catch (err) {
    showToast(err.message || "Optimization failed", "error");
    document.getElementById("vis-empty").style.display = "flex";
    return;
  }

  S.boxesData = result.boxes.map((pd) => ({ ...pd, boxName: pd.boxName }));
  S.summary = result.summary;
  S.boxId = S.boxesData[0]?.boxId || settingsData.boxes[0].id;

  const prevBoxCount = S.boxesData_prev ? S.boxesData_prev.length : 0;
  const newBoxCount = S.boxesData.length;
  const shouldViewAll = newBoxCount > prevBoxCount && newBoxCount > 1;

  if (shouldViewAll) {
    S.activeBoxIdx = -1;
  } else if (prevBoxCount === 0) {
    S.activeBoxIdx = newBoxCount === 1 ? 0 : -1;
  } else if (newBoxCount < prevBoxCount) {
    S.activeBoxIdx = newBoxCount - 1;
  }

  const rp = document.getElementById("right-panel");
  const ag = document.querySelector(".app");
  if (S.activeBoxIdx === -1) {
    if (rp) rp.style.display = "none";
    if (ag) ag.style.gridTemplateColumns = "340px 1fr";
  } else {
    if (rp) rp.style.display = "";
    if (ag) ag.style.gridTemplateColumns = "340px 1fr 300px";
  }

  S.boxesData_prev = S.boxesData.map((pd) => ({ ...pd }));
  _syncActiveBox();

  S.optimized = true;
  window._resetDragHistory();
  _originalLayout = S.layout.map((i) => ({ ...i }));
  window._updateRevertButtons();

  renderLayout();
  computeEfficiency();
  updateSummary();
  updateStats();
  updateSKUPlaced();
  initSkuList();
  renderBoxTabs();
  renderBoxOptions();

  document.getElementById("vis-empty").style.display = "none";
  document.getElementById("three-container").style.display = "block";

  if (window.init3D) window.init3D(); // no-ops if already initialized
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.render3DLayout();
    }),
  );
}
let _originalLayout = null;

function _syncActiveBox() {
  const pd = S.boxesData[S.activeBoxIdx];
  if (!pd) return;
  S.layout = pd.layout;
  S.layerDefs = pd.layerDefs;
  S.totalWeight = pd.totalWeight;
  S.actualHeight = pd.actualHeight;
  S.placedQty = pd.placedQty;
  if (pd.boxId) S.boxId = pd.boxId;
}

function renderBoxTabs() {
  let bar = document.getElementById("box-tabs-bar");
  if (!bar) return;
  const count = S.boxesData.length;
  if (!count) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";
  bar.innerHTML = "";

  const renderBoxData = {};
  S.boxesData.forEach((pd, idx) => {
    let boxCountId = pd.boxId;
    Object.keys(pd.placedQty).forEach((key) => {
      boxCountId += key + pd.placedQty[key];
    });
    if (renderBoxData[boxCountId]) {
      renderBoxData[boxCountId].count++;
    } else {
      renderBoxData[boxCountId] = { idx, count: 1, boxId: pd.boxId, length: pd.layout.length };
    }
  });

  Object.keys(renderBoxData).forEach((key) => {
    const tab = document.createElement("button");
    tab.className = "box-tab" + (renderBoxData[key].idx === S.activeBoxIdx ? " active" : "");

    const _tabBox = settingsData.boxes.find((i) => i.id === renderBoxData[key].boxId) || {};
    let countElement = "";
    if (renderBoxData[key].count > 1) countElement = `<span class="deck-opt-count"> x${renderBoxData[key].count}</span>`;
    const _tabName = _tabBox.name || `Box ${renderBoxData[key].idx + 1}`;
    tab.innerHTML = `<span class="pt-label">${_tabName}</span><span class="pt-skus">${renderBoxData[key].length} SKUs</span>${countElement}`;
    tab.addEventListener("click", () => {
      S.activeBoxIdx = renderBoxData[key].idx;
      _syncActiveBox();
      window._resetDragHistory();
      _originalLayout = S.layout.map((i) => ({ ...i }));
      window._updateRevertButtons();
      renderBoxTabs();
      computeEfficiency();
      updateSummary();
      updateStats();
      updateSKUPlaced();
      window.render3DLayout();

      const rp = document.getElementById("right-panel");
      const ag = document.querySelector(".app");
      if (rp) rp.style.display = "";
      if (ag) ag.style.gridTemplateColumns = "340px 1fr 300px";

      setTimeout(() => window.render3DLayout(), 50);
    });
    bar.appendChild(tab);
  });

  const allBtn = document.createElement("button");
  allBtn.className = "box-tab" + (S.activeBoxIdx === -1 ? " active" : "");
  allBtn.innerHTML = '<span class="pt-label">View All</span>';
  allBtn.style.marginLeft = "auto";
  allBtn.addEventListener("click", () => {
    S.activeBoxIdx = -1;
    renderBoxTabs();
    updateSummary();
    window.render3DLayout();
    initSkuList();

    const rp = document.getElementById("right-panel");
    const ag = document.querySelector(".app");
    if (rp) rp.style.display = "none";
    if (ag) ag.style.gridTemplateColumns = "340px 1fr";

    setTimeout(() => window.render3DLayout(), 50);
  });
  bar.appendChild(allBtn);
}

function renderLayout() {
  if (S.optimized) window.render3DLayout();
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────
function showTT(ev, item) {
  const tt = document.getElementById("tooltip");
  document.getElementById("tt-name").textContent = item.name;
  document.getElementById("tt-size").textContent = `${item.w}×${item.d}×${item.h} cm`;
  document.getElementById("tt-wt").textContent = item.kg + " kg";
  document.getElementById("tt-layer").textContent = "Layer " + item.layer + ` (z:${item.z}cm)`;
  tt.style.left = ev.clientX + 14 + "px";
  tt.style.top = ev.clientY - 50 + "px";
  tt.classList.add("show");
}
function hideTT() {
  document.getElementById("tooltip").classList.remove("show");
}

// ─── MANUAL MODE TOGGLE ──────────────────────────────────────────────────
document.getElementById("btn-manual-toggle").addEventListener("click", () => {
  S.isManual = !S.isManual;
  const btn = document.getElementById("btn-manual-toggle");
  const chip = document.getElementById("mode-chip");
  const notice = document.getElementById("manual-notice");
  if (S.isManual) {
    btn.textContent = "Switch to Auto";
    chip.textContent = "MANUAL MODE";
    chip.className = "mode-chip manual";
    notice.style.display = "flex";
  } else {
    btn.textContent = "Switch to Manual";
    chip.textContent = "AUTO MODE";
    chip.className = "mode-chip";
    notice.style.display = "none";
  }
  if (S.optimized) window.render3DLayout(true);
});

// ─── REVERT LAST DRAG / REVERT TO START ──────────────────────────────────
document.getElementById("btn-revert-drag").addEventListener("click", () => {
  const snap = window._popDragHistory();
  if (!snap) return;
  const item = S.layout.find((i) => i.id === snap.itemId);
  if (item) {
    item.x = snap.x;
    item.y = snap.y;
    item.z = snap.z;
    item.layer = snap.layer;
    item.w = snap.w;
    item.d = snap.d;
    item.h = snap.h;
  }
  window._updateRevertButtons();
  window.render3DLayout(true);
});

document.getElementById("btn-revert-all").addEventListener("click", () => {
  if (!_originalLayout) return;
  _originalLayout.forEach((orig) => {
    const item = S.layout.find((i) => i.id === orig.id);
    if (item) {
      item.x = orig.x;
      item.y = orig.y;
      item.z = orig.z;
      item.layer = orig.layer;
      item.w = orig.w;
      item.d = orig.d;
      item.h = orig.h;
    }
  });
  window._resetDragHistory();
  window._updateRevertButtons();
  window.render3DLayout(true);
});

// ─── OPTIMIZE / RESET BUTTONS ─────────────────────────────────────────────
document.getElementById("btn-optimize").addEventListener("click", runOptimize);
document.getElementById("btn-reset").addEventListener("click", () => {
  S.layout = [];
  S.layerDefs = [];
  S.totalWeight = 0;
  S.optimized = false;
  S.boxesData = [];
  S.activeBoxIdx = 0;
  S.summary = null;
  _originalLayout = null;
  window._resetDragHistory();
  window._updateRevertButtons();
  document.getElementById("vis-empty").style.display = "flex";
  document.getElementById("three-container").style.display = "none";
  const seEl = document.getElementById("sum-eff");
  if (seEl) seEl.textContent = "—";
  const spaceEl = document.getElementById("sum-space-eff");
  if (spaceEl) spaceEl.textContent = "—";
  const sbEl = document.getElementById("sum-boxes");
  if (sbEl) sbEl.textContent = "—";
  const tabsBar = document.getElementById("box-tabs-bar");
  if (tabsBar) {
    tabsBar.style.display = "none";
    tabsBar.innerHTML = "";
  }
  updateSummary();
});

// ─── COLLAPSIBLE AVAILABLE BOXES ─────────────────────────────────────────
function toggleAvailableBoxes() {
  const content = document.getElementById("box-opts");
  const chevron = document.getElementById("available-boxes-chevron");
  const badge = document.getElementById("available-boxes-count-badge");
  const isCollapsed = content.classList.toggle("collapsed");
  chevron.style.transform = isCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
  if (isCollapsed) {
    const count = settingsData && settingsData.boxes ? settingsData.boxes.filter((b) => b.active).length : 0;
    badge.textContent = count;
    badge.style.display = count ? "inline-block" : "none";
  } else {
    badge.style.display = "none";
  }
}
window.toggleAvailableBoxes = toggleAvailableBoxes;

// ─── INIT ─────────────────────────────────────────────────────────────────
fetchSettings();
updateSummary();
