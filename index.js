"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const siyuan = require("siyuan");
let db = null;
let initPromise = null;
async function initDB() {
  if (db) return;
  if (initPromise) return initPromise;
  initPromise = doInit();
  return initPromise;
}
async function doInit() {
  try {
    console.log("[ECDICT] Loading sql.js ...");
    const SQL = await loadSqlJs();
    console.log("[ECDICT] Loading database file ...");
    const response = await fetch("/plugins/siyuan-plugin-dict/dict/stardict.db");
    if (!response.ok) {
      throw new Error("Failed to fetch stardict.db: " + response.status);
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log("[ECDICT] Initializing database ...");
    db = new SQL.Database(uint8Array);
    const result = db.exec("SELECT COUNT(*) FROM stardict");
    if (result.length > 0) {
      console.log("[ECDICT] Database ready, total entries:", result[0].values[0][0]);
    }
  } catch (e) {
    console.error("[ECDICT] Database init failed:", e);
    db = null;
    throw e;
  }
}
async function loadSqlJs() {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) {
      window.initSqlJs({
        locateFile: (file) => `/plugins/siyuan-plugin-dict/${file}`
      }).then(resolve).catch(reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "/plugins/siyuan-plugin-dict/sql-wasm.js";
    script.onload = () => {
      window.initSqlJs({
        locateFile: (file) => `/plugins/siyuan-plugin-dict/${file}`
      }).then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error("Failed to load sql-wasm.js"));
    document.head.appendChild(script);
  });
}
function queryWord(word) {
  if (!db) return null;
  const trimmed = word.trim().toLowerCase();
  try {
    const result = db.exec(
      "SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, exchange FROM stardict WHERE word = '" + trimmed.replace(/'/g, "''") + "' COLLATE NOCASE LIMIT 1"
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return queryBySw(trimmed);
    }
    return rowToEntry(result[0].values[0]);
  } catch (e) {
    console.error("[ECDICT] Query error:", e);
    return null;
  }
}
function queryBySw(word) {
  if (!db) return null;
  const sw = word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  try {
    const result = db.exec(
      "SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, exchange FROM stardict WHERE sw = '" + sw.replace(/'/g, "''") + "' LIMIT 1"
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return rowToEntry(result[0].values[0]);
  } catch (e) {
    return null;
  }
}
function queryLemma(word) {
  if (!db) return null;
  try {
    const escaped = word.toLowerCase().replace(/'/g, "''");
    const result = db.exec(
      "SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, exchange FROM stardict WHERE exchange LIKE '%:" + escaped + "/%' OR exchange LIKE '%:" + escaped + "' LIMIT 5"
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return rowToEntry(result[0].values[0]);
  } catch (e) {
    return null;
  }
}
function rowToEntry(row) {
  return {
    word: (row[0] || "").toString(),
    phonetic: (row[1] || "").toString(),
    definition: (row[2] || "").toString(),
    translation: (row[3] || "").toString(),
    pos: (row[4] || "").toString(),
    collins: parseInt(row[5]) || 0,
    oxford: parseInt(row[6]) || 0,
    tag: (row[7] || "").toString(),
    exchange: (row[8] || "").toString()
  };
}
function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
  initPromise = null;
}
let popupEl = null;
const POS_MAP = {
  n: "名词",
  v: "动词",
  adj: "形容词",
  adv: "副词",
  prep: "介词",
  conj: "连词",
  pron: "代词",
  interj: "感叹词",
  art: "冠词",
  num: "数词",
  vt: "及物动词",
  vi: "不及物动词"
};
const EXCHANGE_TYPE_MAP = {
  p: "过去式",
  d: "过去分词",
  i: "现在分词",
  "3": "三单",
  r: "比较级",
  t: "最高级",
  s: "复数",
  "0": "原型",
  "1": "原型变换"
};
const TAG_MAP = {
  zk: "中考",
  gk: "高考",
  cet4: "四级",
  cet6: "六级",
  ky: "考研",
  ielts: "雅思",
  toefl: "托福",
  gre: "GRE"
};
function parseEntry(raw) {
  const posGroups = parsePosField(raw.pos);
  const groups = parseTranslation(raw.translation, posGroups);
  const englishDefs = parseDefinition(raw.definition);
  const exchanges = parseExchange(raw.exchange);
  const tags = raw.tag ? raw.tag.trim().split(/\s+/).map((t) => TAG_MAP[t] || t).filter(Boolean) : [];
  return {
    word: raw.word,
    phonetic: raw.phonetic,
    collins: raw.collins,
    oxford: raw.oxford === 1,
    tags,
    groups,
    exchanges,
    englishDefs
  };
}
function parsePosField(pos) {
  if (!pos) return [];
  return pos.split("/").filter(Boolean).map((item) => {
    const [abbr, pctStr] = item.split(":");
    return {
      abbr: (abbr || "").trim(),
      name: POS_MAP[(abbr || "").trim()] || (abbr || "").trim(),
      pct: parseInt(pctStr) || 0
    };
  });
}
function parseTranslation(translation, posInfo) {
  if (!translation) return [];
  const lines = translation.split("\n").map((l) => l.trim()).filter(Boolean);
  const groups = [];
  let currentPos = "";
  let currentPosAbbr = "";
  let currentMeanings = [];
  for (const line of lines) {
    const posMatch = line.match(
      /^(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.|art\.|num\.)\s*(.*)/i
    );
    if (posMatch) {
      if (currentMeanings.length > 0) {
        groups.push({
          pos: currentPos || "释义",
          posAbbr: currentPosAbbr,
          meanings: currentMeanings
        });
      }
      const abbrRaw = posMatch[1].replace(".", "").toLowerCase();
      currentPosAbbr = abbrRaw;
      currentPos = POS_MAP[abbrRaw] || abbrRaw;
      currentMeanings = [];
      if (posMatch[2]) {
        splitMeanings(posMatch[2]).forEach((m) => currentMeanings.push(m));
      }
    } else {
      splitMeanings(line).forEach((m) => currentMeanings.push(m));
    }
  }
  if (currentMeanings.length > 0) {
    groups.push({
      pos: currentPos || "释义",
      posAbbr: currentPosAbbr,
      meanings: currentMeanings
    });
  }
  for (const g of groups) {
    const match = posInfo.find((p) => p.abbr === g.posAbbr);
    if (match) g.percentage = match.pct;
  }
  return groups;
}
function splitMeanings(text) {
  return text.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
}
function parseDefinition(definition) {
  if (!definition) return [];
  const lines = definition.split("\n").map((l) => l.trim()).filter(Boolean);
  const groups = [];
  let currentPos = "";
  let currentMeanings = [];
  for (const line of lines) {
    const posMatch = line.match(
      /^(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.)\s*(.*)/i
    );
    if (posMatch) {
      if (currentMeanings.length > 0) {
        groups.push({ pos: currentPos, posAbbr: "", meanings: currentMeanings });
      }
      currentPos = posMatch[1];
      currentMeanings = posMatch[2] ? [posMatch[2]] : [];
    } else {
      currentMeanings.push(line);
    }
  }
  if (currentMeanings.length > 0) {
    groups.push({ pos: currentPos, posAbbr: "", meanings: currentMeanings });
  }
  return groups;
}
function parseExchange(exchange) {
  if (!exchange) return [];
  return exchange.split("/").map((item) => {
    const [type, word] = item.split(":");
    if (!type || !word) return null;
    return { type: EXCHANGE_TYPE_MAP[type] || type, word };
  }).filter(Boolean);
}
function createPopup() {
  if (popupEl) return popupEl;
  popupEl = document.createElement("div");
  popupEl.className = "ecdict-popup";
  popupEl.style.display = "none";
  document.body.appendChild(popupEl);
  document.addEventListener("mousedown", (e) => {
    if (popupEl && !popupEl.contains(e.target)) hidePopup();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hidePopup();
  });
  return popupEl;
}
function showPopup(x, y, entry) {
  if (!popupEl) createPopup();
  popupEl.innerHTML = renderEntry(entry);
  popupEl.style.display = "block";
  positionPopup(x, y);
}
function showLoading(x, y, word) {
  if (!popupEl) createPopup();
  popupEl.innerHTML = `
    <div class="ecdict-header">
      <span class="ecdict-word">${esc(word)}</span>
    </div>
    <div class="ecdict-loading"><span class="ecdict-spinner"></span> 查询中...</div>`;
  popupEl.style.display = "block";
  positionPopup(x, y);
}
function showError(x, y, word, msg) {
  if (!popupEl) createPopup();
  popupEl.innerHTML = `
    <div class="ecdict-header">
      <span class="ecdict-word">${esc(word)}</span>
    </div>
    <div class="ecdict-error">${esc(msg || "未找到该词的释义")}</div>`;
  popupEl.style.display = "block";
  positionPopup(x, y);
}
function hidePopup() {
  if (popupEl) popupEl.style.display = "none";
}
function destroyPopup() {
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
  }
}
function positionPopup(x, y) {
  if (!popupEl) return;
  popupEl.style.left = `${x}px`;
  popupEl.style.top = `${y + 8}px`;
  requestAnimationFrame(() => {
    if (!popupEl) return;
    const r = popupEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x, top = y + 8;
    if (r.right > vw - 10) left = vw - r.width - 10;
    if (r.bottom > vh - 10) top = y - r.height - 8;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    popupEl.style.left = `${left}px`;
    popupEl.style.top = `${top}px`;
  });
}
function renderEntry(entry) {
  let html = "";
  html += `<div class="ecdict-header">`;
  html += `<span class="ecdict-word">${esc(entry.word)}</span>`;
  if (entry.phonetic) {
    html += `<span class="ecdict-phonetic">/${esc(entry.phonetic)}/</span>`;
  }
  html += `</div>`;
  const badges = [];
  if (entry.collins > 0) {
    badges.push(`<span class="ecdict-badge ecdict-collins">${"★".repeat(entry.collins)}${"☆".repeat(5 - entry.collins)}</span>`);
  }
  if (entry.oxford) {
    badges.push(`<span class="ecdict-badge ecdict-oxford">牛津核心</span>`);
  }
  for (const tag of entry.tags) {
    badges.push(`<span class="ecdict-badge">${esc(tag)}</span>`);
  }
  if (badges.length > 0) {
    html += `<div class="ecdict-badges">${badges.join("")}</div>`;
  }
  if (entry.groups.length > 0) {
    html += `<div class="ecdict-body">`;
    for (const group of entry.groups) {
      html += `<div class="ecdict-group">`;
      if (group.pos) {
        html += `<span class="ecdict-pos">${esc(group.pos)}`;
        if (group.percentage) html += ` <span class="ecdict-pct">${group.percentage}%</span>`;
        html += `</span>`;
      }
      if (group.meanings.length === 1) {
        html += `<div class="ecdict-single-meaning">${esc(group.meanings[0])}</div>`;
      } else {
        html += `<ol class="ecdict-meanings">`;
        for (const m of group.meanings) {
          html += `<li>${esc(m)}</li>`;
        }
        html += `</ol>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  if (entry.englishDefs.length > 0 && entry.englishDefs.some((g) => g.meanings.length > 0)) {
    html += `<details class="ecdict-english-section">`;
    html += `<summary class="ecdict-en-toggle">英文释义</summary>`;
    html += `<div class="ecdict-en-body">`;
    for (const group of entry.englishDefs) {
      if (group.pos) html += `<div class="ecdict-en-pos">${esc(group.pos)}</div>`;
      for (const m of group.meanings) {
        html += `<div class="ecdict-en-def">${esc(m)}</div>`;
      }
    }
    html += `</div></details>`;
  }
  if (entry.exchanges.length > 0) {
    html += `<div class="ecdict-exchange">`;
    html += entry.exchanges.map(
      (e) => `<span class="ecdict-ex-item"><span class="ecdict-ex-type">${esc(e.type)}</span> ${esc(e.word)}</span>`
    ).join("");
    html += `</div>`;
  }
  return html;
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
const WORD_RE = /^[a-zA-Z]([a-zA-Z'-]*[a-zA-Z])?$/;
class DictPlugin extends siyuan.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "handleMouseUp", null);
    __publicField(this, "dbReady", false);
  }
  async onload() {
    console.log("[ECDICT] Plugin loading...");
    createPopup();
    this.injectStyles();
    try {
      await initDB();
      this.dbReady = true;
      console.log("[ECDICT] Ready");
    } catch (e) {
      console.error("[ECDICT] DB init failed:", e);
    }
    this.handleMouseUp = (e) => this.onMouseUp(e);
    setTimeout(() => {
      document.addEventListener("mouseup", this.handleMouseUp);
    }, 1e3);
  }
  async onunload() {
    if (this.handleMouseUp) {
      document.removeEventListener("mouseup", this.handleMouseUp);
      this.handleMouseUp = null;
    }
    destroyPopup();
    closeDB();
    this.removeStyles();
    console.log("[ECDICT] Unloaded");
  }
  onMouseUp(e) {
    const popup = document.querySelector(".ecdict-popup");
    if (popup && popup.contains(e.target)) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!WORD_RE.test(text) || text.length > 40) return;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const el = container instanceof HTMLElement ? container : container.parentElement;
    if (!(el == null ? void 0 : el.closest(".protyle-wysiwyg"))) return;
    const rect = range.getBoundingClientRect();
    this.lookup(text, rect.left, rect.bottom);
  }
  lookup(word, x, y) {
    if (!this.dbReady) {
      showError(x, y, word, "词典数据库未加载");
      return;
    }
    showLoading(x, y, word);
    setTimeout(() => {
      let result = queryWord(word);
      if (!result) {
        const lemmaResult = queryLemma(word);
        if (lemmaResult) result = lemmaResult;
      }
      if (result && result.translation) {
        const parsed = parseEntry(result);
        showPopup(x, y, parsed);
      } else {
        showError(x, y, word);
      }
    }, 10);
  }
  injectStyles() {
    const style = document.createElement("style");
    style.id = "ecdict-plugin-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }
  removeStyles() {
    var _a;
    (_a = document.getElementById("ecdict-plugin-styles")) == null ? void 0 : _a.remove();
  }
}
const STYLES = `
.ecdict-popup {
  position: fixed;
  z-index: 99999;
  background: var(--b3-theme-surface, #ffffff);
  border: 1px solid var(--b3-border-color, #d0d7de);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08);
  padding: 14px 18px;
  max-width: 460px;
  min-width: 260px;
  max-height: 420px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.65;
  color: var(--b3-theme-on-surface, #24292f);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  animation: ecdict-fadein 0.15s ease-out;
}
@keyframes ecdict-fadein {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.ecdict-popup::-webkit-scrollbar { width: 5px; }
.ecdict-popup::-webkit-scrollbar-thumb {
  background: var(--b3-scroll-color, #c1c1c1);
  border-radius: 3px;
}
.ecdict-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}
.ecdict-word {
  font-size: 20px;
  font-weight: 700;
  color: var(--b3-theme-primary, #0969da);
}
.ecdict-phonetic {
  font-size: 13px;
  color: var(--b3-theme-on-surface-light, #656d76);
  font-family: "Lucida Sans Unicode", serif;
}
.ecdict-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--b3-border-color, #d8dee4);
}
.ecdict-badge {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--b3-theme-surface-light, #f6f8fa);
  color: var(--b3-theme-on-surface-light, #656d76);
  border: 1px solid var(--b3-border-color, #d0d7de);
}
.ecdict-collins { color: #cf222e; letter-spacing: -1px; }
.ecdict-oxford { background: #dafbe1; color: #116329; border-color: #aceebb; }
.ecdict-group { margin-bottom: 8px; }
.ecdict-pos {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--b3-theme-primary, #0969da);
  padding: 1px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}
.ecdict-pct { font-weight: 400; opacity: 0.8; font-size: 11px; }
.ecdict-meanings { margin: 2px 0 0 0; padding-left: 22px; }
.ecdict-meanings li { margin-bottom: 2px; }
.ecdict-single-meaning { padding-left: 4px; margin-top: 2px; }
.ecdict-english-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--b3-border-color, #d8dee4);
}
.ecdict-en-toggle {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light, #656d76);
  cursor: pointer;
  user-select: none;
}
.ecdict-en-toggle:hover { color: var(--b3-theme-primary, #0969da); }
.ecdict-en-body { margin-top: 4px; }
.ecdict-en-pos {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-light, #656d76);
  margin-top: 4px;
}
.ecdict-en-def {
  font-size: 13px;
  color: var(--b3-theme-on-surface-light, #656d76);
  padding-left: 8px;
  font-style: italic;
}
.ecdict-exchange {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--b3-border-color, #d8dee4);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ecdict-ex-item { font-size: 12px; color: var(--b3-theme-on-surface-light, #656d76); }
.ecdict-ex-type { font-size: 11px; color: var(--b3-theme-secondary, #8250df); font-weight: 500; }
.ecdict-loading { color: var(--b3-theme-on-surface-light, #656d76); font-size: 13px; padding: 8px 0; }
.ecdict-spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border: 2px solid var(--b3-border-color, #d0d7de);
  border-top-color: var(--b3-theme-primary, #0969da);
  border-radius: 50%;
  animation: ecdict-spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 4px;
}
@keyframes ecdict-spin { to { transform: rotate(360deg); } }
.ecdict-error { color: var(--b3-theme-error, #cf222e); font-size: 13px; padding: 4px 0; }
`;
module.exports = DictPlugin;
