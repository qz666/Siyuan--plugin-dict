import type { ParsedEntry, WordEntry, PosGroup, ExchangeInfo } from "./types";

let popupEl: HTMLElement | null = null;

// ==================== 词性映射 ====================

const POS_MAP: Record<string, string> = {
  n: "名词", v: "动词", adj: "形容词", adv: "副词",
  prep: "介词", conj: "连词", pron: "代词", interj: "感叹词",
  art: "冠词", num: "数词", vt: "及物动词", vi: "不及物动词",
};

const EXCHANGE_TYPE_MAP: Record<string, string> = {
  p: "过去式", d: "过去分词", i: "现在分词",
  "3": "三单", r: "比较级", t: "最高级",
  s: "复数", "0": "原型", "1": "原型变换",
};

const TAG_MAP: Record<string, string> = {
  zk: "中考", gk: "高考", cet4: "四级", cet6: "六级",
  ky: "考研", ielts: "雅思", toefl: "托福", gre: "GRE",
};

// ==================== 解析 ====================

export function parseEntry(raw: WordEntry): ParsedEntry {
  const posGroups = parsePosField(raw.pos);
  const groups = parseTranslation(raw.translation, posGroups);
  const englishDefs = parseDefinition(raw.definition);
  const exchanges = parseExchange(raw.exchange);

  const tags = raw.tag
    ? raw.tag.trim().split(/\s+/).map((t) => TAG_MAP[t] || t).filter(Boolean)
    : [];

  return {
    word: raw.word,
    phonetic: raw.phonetic,
    collins: raw.collins,
    oxford: raw.oxford === 1,
    tags,
    groups,
    exchanges,
    englishDefs,
  };
}

function parsePosField(pos: string): { abbr: string; name: string; pct: number }[] {
  if (!pos) return [];
  return pos.split("/").filter(Boolean).map((item) => {
    const [abbr, pctStr] = item.split(":");
    return {
      abbr: (abbr || "").trim(),
      name: POS_MAP[(abbr || "").trim()] || (abbr || "").trim(),
      pct: parseInt(pctStr) || 0,
    };
  });
}

function parseTranslation(
  translation: string,
  posInfo: { abbr: string; name: string; pct: number }[]
): PosGroup[] {
  if (!translation) return [];

  const lines = translation.split("\n").map((l) => l.trim()).filter(Boolean);
  const groups: PosGroup[] = [];
  let currentPos = "";
  let currentPosAbbr = "";
  let currentMeanings: string[] = [];

  for (const line of lines) {
    // 匹配 "n. xxx" "vt. xxx" "adj. xxx" 等开头
    const posMatch = line.match(
      /^(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.|art\.|num\.)\s*(.*)/i
    );

    if (posMatch) {
      if (currentMeanings.length > 0) {
        groups.push({
          pos: currentPos || "释义",
          posAbbr: currentPosAbbr,
          meanings: currentMeanings,
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
      meanings: currentMeanings,
    });
  }

  // 补充词性占比
  for (const g of groups) {
    const match = posInfo.find((p) => p.abbr === g.posAbbr);
    if (match) g.percentage = match.pct;
  }

  return groups;
}

function splitMeanings(text: string): string[] {
  return text.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
}

function parseDefinition(definition: string): PosGroup[] {
  if (!definition) return [];
  const lines = definition.split("\n").map((l) => l.trim()).filter(Boolean);
  const groups: PosGroup[] = [];
  let currentPos = "";
  let currentMeanings: string[] = [];

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

function parseExchange(exchange: string): ExchangeInfo[] {
  if (!exchange) return [];
  return exchange.split("/").map((item) => {
    const [type, word] = item.split(":");
    if (!type || !word) return null;
    return { type: EXCHANGE_TYPE_MAP[type] || type, word };
  }).filter(Boolean) as ExchangeInfo[];
}

// ==================== UI ====================

export function createPopup(): HTMLElement {
  if (popupEl) return popupEl;
  popupEl = document.createElement("div");
  popupEl.className = "ecdict-popup";
  popupEl.style.display = "none";
  document.body.appendChild(popupEl);

  document.addEventListener("mousedown", (e) => {
    if (popupEl && !popupEl.contains(e.target as Node)) hidePopup();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hidePopup();
  });

  return popupEl;
}

export function showPopup(x: number, y: number, entry: ParsedEntry) {
  if (!popupEl) createPopup();
  popupEl!.innerHTML = renderEntry(entry);
  popupEl!.style.display = "block";
  positionPopup(x, y);
}

export function showLoading(x: number, y: number, word: string) {
  if (!popupEl) createPopup();
  popupEl!.innerHTML = `
    <div class="ecdict-header">
      <span class="ecdict-word">${esc(word)}</span>
    </div>
    <div class="ecdict-loading"><span class="ecdict-spinner"></span> 查询中...</div>`;
  popupEl!.style.display = "block";
  positionPopup(x, y);
}

export function showError(x: number, y: number, word: string, msg?: string) {
  if (!popupEl) createPopup();
  popupEl!.innerHTML = `
    <div class="ecdict-header">
      <span class="ecdict-word">${esc(word)}</span>
    </div>
    <div class="ecdict-error">${esc(msg || "未找到该词的释义")}</div>`;
  popupEl!.style.display = "block";
  positionPopup(x, y);
}

export function hidePopup() {
  if (popupEl) popupEl.style.display = "none";
}

export function destroyPopup() {
  if (popupEl) { popupEl.remove(); popupEl = null; }
}

function positionPopup(x: number, y: number) {
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

function renderEntry(entry: ParsedEntry): string {
  let html = "";

  // 头部
  html += `<div class="ecdict-header">`;
  html += `<span class="ecdict-word">${esc(entry.word)}</span>`;
  if (entry.phonetic) {
    html += `<span class="ecdict-phonetic">/${esc(entry.phonetic)}/</span>`;
  }
  html += `</div>`;

  // 标签
  const badges: string[] = [];
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

  // 中文释义
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

  // 英文释义（折叠）
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

  // 词形变化
  if (entry.exchanges.length > 0) {
    html += `<div class="ecdict-exchange">`;
    html += entry.exchanges.map((e) =>
      `<span class="ecdict-ex-item"><span class="ecdict-ex-type">${esc(e.type)}</span> ${esc(e.word)}</span>`
    ).join("");
    html += `</div>`;
  }

  return html;
}

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}