import type { WordEntry } from "./types";

interface SqlJsDatabase {
  run(sql: string, params?: any[]): void;
  exec(sql: string, params?: any[]): { columns: string[]; values: any[][] }[];
  close(): void;
}

interface SqlJsStatic {
  Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

let db: SqlJsDatabase | null = null;
let initPromise: Promise<void> | null = null;

export async function initDB(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;
  initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
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

async function loadSqlJs(): Promise<SqlJsStatic> {
  return new Promise((resolve, reject) => {
    if ((window as any).initSqlJs) {
      (window as any).initSqlJs({
        locateFile: (file: string) => `/plugins/siyuan-plugin-dict/${file}`,
      }).then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.src = "/plugins/siyuan-plugin-dict/sql-wasm.js";
    script.onload = () => {
      (window as any).initSqlJs({
        locateFile: (file: string) => `/plugins/siyuan-plugin-dict/${file}`,
      }).then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error("Failed to load sql-wasm.js"));
    document.head.appendChild(script);
  });
}

export function queryWord(word: string): WordEntry | null {
  if (!db) return null;
  const trimmed = word.trim().toLowerCase();

  try {
    const result = db.exec(
      "SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, exchange FROM stardict WHERE word = '" +
        trimmed.replace(/'/g, "''") +
        "' COLLATE NOCASE LIMIT 1"
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

function queryBySw(word: string): WordEntry | null {
  if (!db) return null;
  const sw = word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  try {
    const result = db.exec(
      "SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, exchange FROM stardict WHERE sw = '" +
        sw.replace(/'/g, "''") +
        "' LIMIT 1"
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return rowToEntry(result[0].values[0]);
  } catch (e) {
    return null;
  }
}

export function queryLemma(word: string): WordEntry | null {
  if (!db) return null;

  try {
    const escaped = word.toLowerCase().replace(/'/g, "''");
    const result = db.exec(
      "SELECT word, phonetic, definition, translation, pos, collins, oxford, tag, exchange FROM stardict WHERE exchange LIKE '%:" +
        escaped +
        "/%' OR exchange LIKE '%:" +
        escaped +
        "' LIMIT 5"
    );

    if (result.length === 0 || result[0].values.length === 0) return null;
    return rowToEntry(result[0].values[0]);
  } catch (e) {
    return null;
  }
}

function rowToEntry(row: any[]): WordEntry {
  return {
    word: (row[0] || "").toString(),
    phonetic: (row[1] || "").toString(),
    definition: (row[2] || "").toString(),
    translation: (row[3] || "").toString(),
    pos: (row[4] || "").toString(),
    collins: parseInt(row[5]) || 0,
    oxford: parseInt(row[6]) || 0,
    tag: (row[7] || "").toString(),
    exchange: (row[8] || "").toString(),
  };
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
  initPromise = null;
}