export interface WordEntry {
  word: string;
  phonetic: string;
  translation: string;
  definition: string;
  pos: string;
  collins: number;
  oxford: number;
  tag: string;
  exchange: string;
}

export interface ParsedEntry {
  word: string;
  phonetic: string;
  collins: number;
  oxford: boolean;
  tags: string[];
  groups: PosGroup[];
  exchanges: ExchangeInfo[];
  englishDefs: PosGroup[];
}

export interface PosGroup {
  pos: string;
  posAbbr: string;
  percentage?: number;
  meanings: string[];
}

export interface ExchangeInfo {
  type: string;
  word: string;
}