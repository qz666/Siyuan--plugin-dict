import { Plugin } from "siyuan";
import { initDB, queryWord, queryLemma, closeDB } from "./db";
import {
  createPopup, showPopup, showLoading, showError,
  hidePopup, destroyPopup, parseEntry,
} from "./popup";

const WORD_RE = /^[a-zA-Z]([a-zA-Z'-]*[a-zA-Z])?$/;

export default class DictPlugin extends Plugin {
  private handleMouseUp: ((e: MouseEvent) => void) | null = null;
  private dbReady = false;

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

    this.handleMouseUp = (e: MouseEvent) => this.onMouseUp(e);
    setTimeout(() => {
      document.addEventListener("mouseup", this.handleMouseUp!);
    }, 1000);
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

  private onMouseUp(e: MouseEvent) {
    const popup = document.querySelector(".ecdict-popup");
    if (popup && popup.contains(e.target as Node)) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!WORD_RE.test(text) || text.length > 40) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const el = container instanceof HTMLElement ? container : container.parentElement;
    if (!el?.closest(".protyle-wysiwyg")) return;

    const rect = range.getBoundingClientRect();
    this.lookup(text, rect.left, rect.bottom);
  }

  private lookup(word: string, x: number, y: number) {
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

  private injectStyles() {
    const style = document.createElement("style");
    style.id = "ecdict-plugin-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  private removeStyles() {
    document.getElementById("ecdict-plugin-styles")?.remove();
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