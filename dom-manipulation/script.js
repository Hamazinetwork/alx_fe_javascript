/***********************
 * Keys / Constants
 ***********************/
const LS_QUOTES_KEY = "dqg_quotes";
const SS_LAST_QUOTE_KEY = "dqg_last_quote";
const LS_SELECTED_CATEGORY_KEY = "selectedCategory";
const LAST_SYNC_KEY = "dqg_last_sync";
const REMOTE_QUOTES_KEY = "dqg_REMOTE_QUOTES";   // mock "server"
const CONFLICT_BACKUPS_KEY = "dqg_conflict_backups"; // local backups when server overwrites
const SYNC_INTERVAL_MS = 15000; // 15s periodic sync

/***********************
 * State / DOM
 ***********************/
let quotes = []; // Local working set: [{id, text, category, updatedAt}]
let lastSelectedCategory = localStorage.getItem(LS_SELECTED_CATEGORY_KEY) || "all";

const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteButton = document.getElementById("newQuote");
const categoryFilter = document.getElementById("categoryFilter");
const exportBtn = document.getElementById("exportJson");
const lastSeenHint = document.getElementById("lastSeenHint");
const banner = document.getElementById("banner");
const conflictsPanel = document.getElementById("conflictsPanel");
const conflictsList = document.getElementById("conflictsList");
const toggleConflictsBtn = document.getElementById("toggleConflicts");
const syncNowBtn = document.getElementById("syncNow");
const simulateServerBtn = document.getElementById("simulateServer");

/***********************
 * Utilities
 ***********************/
function nowTs() { return Date.now(); }
function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function shallowClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function showBanner(msg, type = "info") {
  banner.textContent = msg;
  banner.className = type === "warn" ? "banner-warn" : "banner-info";
  banner.style.display = "block";
  // auto-hide after 5s
  setTimeout(() => { banner.style.display = "none"; }, 5000);
}

/***********************
 * Local Persistence
 ***********************/
function saveQuotes() { localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes)); }
function loadQuotes() {
  const raw = localStorage.getItem(LS_QUOTES_KEY);
  if (raw) {
    try { quotes = JSON.parse(raw) || []; } catch { quotes = []; }
  }
  if (!Array.isArray(quotes) || quotes.length === 0) {
    quotes = [
      { id: generateId(), text: "The best way to get started is to quit talking and begin doing.", category: "Motivation", updatedAt: nowTs() },
      { id: generateId(), text: "Success is not final, failure is not fatal: It is the courage to continue that counts.", category: "Inspiration", updatedAt: nowTs() },
      { id: generateId(), text: "Do not wait for leaders; do it alone, person to person.", category: "Action", updatedAt: nowTs() }
    ];
  }
  // Normalize any legacy items (without id/updatedAt)
  quotes = quotes.map(q => ({
    id: q.id || generateId(),
    text: q.text,
    category: q.category || "General",
    updatedAt: typeof q.updatedAt === "number" ? q.updatedAt : nowTs()
  }));
  saveQuotes();
}

function getConflictBackups() {
  try { return JSON.parse(localStorage.getItem(CONFLICT_BACKUPS_KEY)) || []; }
  catch { return []; }
}
function setConflictBackups(arr) {
  localStorage.setItem(CONFLICT_BACKUPS_KEY, JSON.stringify(arr));
}
function addConflictBackup(localVersion, serverVersion) {
  const backups = getConflictBackups();
  backups.push({ id: localVersion.id, local: localVersion, server: serverVersion, when: nowTs() });
  setConflictBackups(backups);
  toggleConflictsBtn.style.display = "inline-block";
}

/***********************
 * Mock "Server"
 * - Stored in localStorage under REMOTE_QUOTES_KEY (so it works offline & across tabs)
 * - You can replace MockServer.getAll()/upsertMany() with real API calls if you later add a backend
 ***********************/
const MockServer = {
  getAll() {
    try {
      const raw = localStorage.getItem(REMOTE_QUOTES_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) return arr;
      // seed remote with a couple of “server” quotes once
      const seed = [
        { id: "srv-1", text: "Stay hungry, stay foolish.", category: "Inspiration", updatedAt: nowTs() - 60000 },
        { id: "srv-2", text: "Simplicity is the soul of efficiency.", category: "Productivity", updatedAt: nowTs() - 45000 }
      ];
      localStorage.setItem(REMOTE_QUOTES_KEY, JSON.stringify(seed));
      return seed;
    } catch { return []; }
  },
  upsertMany(items) {
    const remote = this.getAll();
    const map = new Map(remote.map(r => [r.id, r]));
    for (const it of items) {
      map.set(it.id, { ...it }); // last-write-wins at server
    }
    const next = Array.from(map.values());
    localStorage.setItem(REMOTE_QUOTES_KEY, JSON.stringify(next));
    return next;
  },
  // helpful for demos: change one random remote item (or create one) to trigger conflicts
  simulateRemoteUpdate() {
    let remote = this.getAll();
    if (remote.length === 0) remote = this.upsertMany([]);
    if (remote.length && Math.random() < 0.7) {
      const i = Math.floor(Math.random() * remote.length);
      remote[i] = {
        ...remote[i],
        text: remote[i].text + " [server edit]",
        updatedAt: nowTs()
      };
      localStorage.setItem(REMOTE_QUOTES_KEY, JSON.stringify(remote));
      return { type: "edit", id: remote[i].id };
    } else {
      const newItem = {
        id: "srv-" + generateId(),
        text: "New remote quote at " + new Date().toLocaleTimeString(),
        category: "Server",
        updatedAt: nowTs()
      };
      remote.push(newItem);
      localStorage.setItem(REMOTE_QUOTES_KEY, JSON.stringify(remote));
      return { type: "add", id: newItem.id };
    }
  }
};

/***********************
 * OPTIONAL: JSONPlaceholder seeding (read-only import)
 * - Call once to pull a few posts and map to quotes (no persistence on their side)
 ***********************/
async function seedFromJSONPlaceholder(max = 3) {
  try {
    const res = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=" + max);
    const posts = await res.json();
    const mapped = posts.map(p => ({
      id: "ph-" + p.id,
      text: p.title,
      category: "JSONPH",
      updatedAt: nowTs() - 30000
    }));
    MockServer.upsertMany(mapped);
  } catch {
    // Ignore if offline or blocked; purely optional
  }
}

/***********************
 * UI Builders
 ***********************/
function populateCategories() {
  const categories = ["all", ...new Set(quotes.map(q => q.category).filter(Boolean))];
  categoryFilter.innerHTML = "";
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat === "all" ? "All Categories" : cat;
    categoryFilter.appendChild(opt);
  }
  categoryFilter.value = lastSelectedCategory;
}

function showRandomQuote() {
  const cat = categoryFilter.value || "all";
  const pool = cat === "all" ? quotes : quotes.filter(q => q.category === cat);
  if (!pool.length) {
    quoteDisplay.textContent = "No quotes available for this category.";
    sessionStorage.removeItem(SS_LAST_QUOTE_KEY);
    lastSeenHint.textContent = "";
    return;
  }
  const q = pool[Math.floor(Math.random() * pool.length)];
  quoteDisplay.textContent = `"${q.text}" — ${q.category}`;
  sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(q));
  lastSeenHint.textContent = `Last viewed (this tab): "${q.text}" — ${q.category}`;
}

function filterQuotes() {
  lastSelectedCategory = categoryFilter.value;
  localStorage.setItem(LS_SELECTED_CATEGORY_KEY, lastSelectedCategory);
  showRandomQuote();
}

/***********************
 * Add / Import / Export
 ***********************/
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl = document.getElementById("newQuoteCategory");
  const text = (textEl.value || "").trim();
  const category = (catEl.value || "").trim();
  if (!text || !category) { alert("Please enter both quote text and category."); return; }

  const q = { id: generateId(), text, category, updatedAt: nowTs() };
  quotes.push(q);
  saveQuotes();
  populateCategories();
  categoryFilter.value = category;
  showRandomQuote();
  textEl.value = ""; catEl.value = "";
  showBanner("Quote added locally. Will sync shortly.");
}

function exportToJsonFile() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quotes-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error("Expected an array.");
      const cleaned = imported
        .filter(q => q && typeof q === "object")
        .map(q => ({
          id: q.id || generateId(),
          text: String(q.text || "").trim(),
          category: String(q.category || "General").trim(),
          updatedAt: typeof q.updatedAt === "number" ? q.updatedAt : nowTs()
        }))
        .filter(q => q.text && q.category);
      if (!cleaned.length) { alert("No valid quotes found."); return; }
      // Merge imported into local (local overwrite if same id and imported newer)
      const map = new Map(quotes.map(q => [q.id, q]));
      for (const it of cleaned) {
        const local = map.get(it.id);
        if (!local || it.updatedAt >= local.updatedAt) map.set(it.id, it);
      }
      quotes = Array.from(map.values());
      saveQuotes();
      populateCategories();
      showRandomQuote();
      showBanner(`Imported ${cleaned.length} quotes.`, "info");
    } catch {
      alert("Invalid JSON file.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

/***********************
 * Sync & Conflict Resolution
 * Strategy: SERVER WINS on discrepancies
 * - We still keep a local backup of overwritten items so the user can restore manually
 ***********************/
function toMap(arr) {
  const m = new Map();
  for (const it of arr) m.set(it.id, it);
  return m;
}

function syncNow({ silent = false } = {}) {
  const remote = MockServer.getAll();
  const localMap = toMap(quotes);
  const remoteMap = toMap(remote);

  let addedFromServer = 0;
  let updatedFromServer = 0;
  let conflicts = 0;

  // 1) Apply server to local (server precedence)
  for (const [id, r] of remoteMap) {
    const l = localMap.get(id);
    if (!l) {
      localMap.set(id, shallowClone(r));
      addedFromServer++;
    } else {
      const contentDiffers = (l.text !== r.text) || (l.category !== r.category) || (l.updatedAt !== r.updatedAt);
      if (contentDiffers) {
        // conflict or discrepancy -> server wins, but keep local backup
        addConflictBackup(l, r);
        localMap.set(id, shallowClone(r));
        updatedFromServer++;
        conflicts++;
      }
    }
  }

  // 2) Push local-only items to server (simulate POST/PUT)
  const pushList = [];
  for (const [id, l] of localMap) {
    if (!remoteMap.has(id)) pushList.push(l);
  }
  if (pushList.length) {
    MockServer.upsertMany(pushList);
  }

  // Save local results
  quotes = Array.from(localMap.values());
  saveQuotes();
  localStorage.setItem(LAST_SYNC_KEY, String(nowTs()));

  // UI feedback
  const backups = getConflictBackups();
  if (backups.length) toggleConflictsBtn.style.display = "inline-block";
  if (!silent) {
    if (addedFromServer || updatedFromServer) {
      const msg = `Synced: ${addedFromServer} new from server, ${updatedFromServer} updated${conflicts ? `, ${conflicts} conflict(s) resolved (server wins)` : ""}.`;
      showBanner(msg, conflicts ? "warn" : "info");
    } else {
      showBanner("Sync complete. No changes.", "info");
    }
  }

  // refresh UI
  populateCategories();
  filterQuotes();
}

function renderConflictsPanel() {
  const backups = getConflictBackups();
  if (!backups.length) {
    conflictsPanel.style.display = "none";
    toggleConflictsBtn.style.display = "none";
    return;
  }
  conflictsPanel.style.display = "block";
  conflictsList.innerHTML = "";
  backups
    .slice()
    .reverse()
    .forEach(b => {
      const wrapper = document.createElement("div");
      wrapper.className = "conflict-item";
      const when = new Date(b.when).toLocaleString();
      wrapper.innerHTML = `
        <div><strong>Quote ID:</strong> ${b.id}</div>
        <div class="muted">When: ${when}</div>
        <div><strong>Server:</strong> "${b.server.text}" — ${b.server.category}</div>
        <div><strong>Your local (overwritten):</strong> "${b.local.text}" — ${b.local.category}</div>
      `;
      const row = document.createElement("div"); row.className = "row";
      const restoreBtn = document.createElement("button");
      restoreBtn.textContent = "Restore Local Version";
      restoreBtn.onclick = () => restoreLocalVersion(b.id);
      const dismissBtn = document.createElement("button");
      dismissBtn.textContent = "Dismiss";
      dismissBtn.onclick = () => dismissConflict(b.id);
      row.appendChild(restoreBtn);
      row.appendChild(dismissBtn);
      wrapper.appendChild(row);
      conflictsList.appendChild(wrapper);
    });
}

function restoreLocalVersion(id) {
  const backups = getConflictBackups();
  const idx = backups.findIndex(b => b.id === id);
  if (idx === -1) return;
  const item = backups[idx];
  // restore local version and bump timestamp
  const restored = { ...item.local, updatedAt: nowTs() };
  const map = toMap(quotes);
  map.set(id, restored);
  quotes = Array.from(map.values());
  saveQuotes();

  // also push to server (so “your local” now becomes the remote truth)
  MockServer.upsertMany([restored]);

  // remove from backups
  backups.splice(idx, 1);
  setConflictBackups(backups);
  showBanner("Local version restored and pushed to server.", "info");

  renderConflictsPanel();
  if (!backups.length) {
    conflictsPanel.style.display = "none";
    toggleConflictsBtn.style.display = "none";
  }
  populateCategories();
  filterQuotes();
}

function dismissConflict(id) {
  const backups = getConflictBackups();
  const idx = backups.findIndex(b => b.id === id);
  if (idx === -1) return;
  backups.splice(idx, 1);
  setConflictBackups(backups);
  renderConflictsPanel();
  if (!backups.length) {
    conflictsPanel.style.display = "none";
    toggleConflictsBtn.style.display = "none";
  }
}

/***********************
 * Event Wiring & Init
 ***********************/
function init() {
  loadQuotes();
  populateCategories();

  // Restore last viewed quote (session)
  const last = sessionStorage.getItem(SS_LAST_QUOTE_KEY);
  if (last) {
    try {
      const q = JSON.parse(last);
      quoteDisplay.textContent = `"${q.text}" — ${q.category}`;
      lastSeenHint.textContent = `Last viewed (this tab): "${q.text}" — ${q.category}`;
      if ([...categoryFilter.options].some(o => o.value === q.category)) {
        categoryFilter.value = q.category;
      } else {
        categoryFilter.value = "all";
      }
    } catch { categoryFilter.value = "all"; showRandomQuote(); }
  } else {
    categoryFilter.value = lastSelectedCategory || "all";
    showRandomQuote();
  }

  // Hook controls
  newQuoteButton.addEventListener("click", showRandomQuote);
  exportBtn.addEventListener("click", exportToJsonFile);
  syncNowBtn.addEventListener("click", () => syncNow({ silent: false }));
  simulateServerBtn.addEventListener("click", () => {
    const res = MockServer.simulateRemoteUpdate();
    showBanner(`Server ${res.type}: ${res.id}`, "warn");
    syncNow({ silent: true }); // pull in change
  });
  toggleConflictsBtn.addEventListener("click", () => {
    conflictsPanel.style.display = conflictsPanel.style.display === "none" ? "block" : "none";
    if (conflictsPanel.style.display === "block") renderConflictsPanel();
  });
  document.getElementById("dismissConflicts").addEventListener("click", () => {
    setConflictBackups([]);
    conflictsPanel.style.display = "none";
    toggleConflictsBtn.style.display = "none";
  });

  // Periodic sync
  setInterval(() => syncNow({ silent: true }), SYNC_INTERVAL_MS);

  // Cross-tab sync: if another tab changes REMOTE_QUOTES_KEY, pull it
  window.addEventListener("storage", (e) => {
    if (e.key === REMOTE_QUOTES_KEY) syncNow({ silent: true });
  });

  // Optional: seed from JSONPlaceholder once (try/catch inside)
  seedFromJSONPlaceholder(2);
}
init();
