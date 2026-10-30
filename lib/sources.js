// Reads the week folder: every source file as numbered lines (documents, last week's brief) or as
// rows with ids (the tracker, the answer blocks) or rows by line (the decision log, the merged
// table). Parses a source reference, finds dates, numbers, periods and names in text. The checker
// (lib/check.js) and the store (lib/store.js) both lean on this file; nothing here reads the
// expected results.
import fs from "node:fs";
import path from "node:path";

// ---------- csv ----------
export const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function parseCsvRows(text) {
  const rows = []; let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const head = rows[0];
  return rows.slice(1).filter((r) => r.length > 1 || r[0] !== "").map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// ---------- the week folder ----------
// Files the server writes are never sources.
export const OUTPUT_FILES = /^(brief_\d{4}-\d{2}-\d{2}\.md|unsourced\.md|claims\.csv|run_log\.csv)$/;
export const ID_COLUMN = { "tracker.csv": "action_id", "answers.csv": "answer_id" };
export const isConfidential = (line) => /\bconfidential\b/i.test(line || "");

export function loadSources(dir) {
  const files = {};
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(csv|md)$/.test(f) && !OUTPUT_FILES.test(f)).sort() : [];
  for (const name of names) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    const f = { name, kind: name.endsWith(".csv") ? "csv" : "md", lines: [], rows: [], byId: null, declined: false, lineCount: lines.length };
    if (isConfidential(lines[0])) { f.declined = true; files[name] = f; continue; }   // nothing past the first line is kept
    f.lines = lines;
    if (f.kind === "csv") {
      f.header = parseCsvRows(lines[0] + "\n")[0] || [];
      // one row per physical line after the header, so "line N" and the row agree
      f.rows = lines.slice(1).map((l, i) => { const vals = parseCsvRows(l + "\n")[0] || []; const row = Object.fromEntries(f.header.map((h, j) => [h, vals[j] ?? ""])); row.__line = i + 2; return row; });
      const idc = ID_COLUMN[name];
      if (idc) f.byId = Object.fromEntries(f.rows.map((r) => [r[idc], r]));
    }
    files[name] = f;
  }
  const tracker = files["tracker.csv"];
  const runs = tracker && !tracker.declined ? [...new Set(tracker.rows.flatMap((r) => [r.added_run, r.closed_run]).filter(Boolean))].sort() : [];
  const latestRun = runs[runs.length - 1] || "";
  const weekEnding = (/R(\d{4}-\d{2}-\d{2})/.exec(latestRun) || [])[1] || "unknown";
  return { dir, files, read: names.filter((n) => !files[n].declined), declined: names.filter((n) => files[n].declined), latestRun, weekEnding, year: Number(weekEnding.slice(0, 4)) || new Date().getFullYear() };
}

// ---------- references ----------
// One form per file: "tracker.csv A007", "answers.csv D202610300900-Q03", "<any other file> line 9".
const REF = /^([A-Za-z0-9_.-]+\.(?:csv|md))\s+(?:line\s+(\d+)|([A-Za-z][A-Za-z0-9-]*))$/;
export function parseRef(s) {
  const m = REF.exec(String(s || "").trim());
  if (!m) return { error: `reference "${s}" is not of the form "<file> line N" or "<file> <id>"` };
  const file = m[1];
  if (ID_COLUMN[file]) { if (!m[3]) return { error: `${file} is referenced by ${ID_COLUMN[file]}, not by line` }; return { file, id: m[3], text: `${file} ${m[3]}` }; }
  if (!m[2]) return { error: `${file} is referenced by line number, not by id` };
  return { file, line: Number(m[2]), text: `${file} line ${m[2]}` };
}
// Returns { ref, file, row?, line?, text } or { error }.
export function resolveRef(sources, s) {
  const ref = parseRef(s); if (ref.error) return ref;
  const f = sources.files[ref.file];
  if (!f) return { error: `${ref.file} is not in the week folder` };
  if (f.declined) return { error: `${ref.file} was declined (marked confidential) and cannot be cited` };
  if (ref.id) { const row = f.byId[ref.id]; if (!row) return { error: `${ref.file} has no row ${ref.id}` }; return { ref: ref.text, file: f, row, text: Object.entries(row).filter(([k]) => k !== "__line").map(([, v]) => v).join(" ") }; }
  if (ref.line < 1 || ref.line > f.lineCount) return { error: `${ref.file} has ${f.lineCount} lines, no line ${ref.line}` };
  if (f.kind === "csv") { if (ref.line === 1) return { error: `${ref.file} line 1 is the header` }; const row = f.rows[ref.line - 2]; return { ref: ref.text, file: f, row, line: ref.line, text: Object.entries(row).filter(([k]) => k !== "__line").map(([, v]) => v).join(" | ") }; }
  return { ref: ref.text, file: f, line: ref.line, text: f.lines[ref.line - 1] };
}
export const refIsBracket = /\s*\[[^\]]*\.(?:csv|md)[^\]]*\]/g;   // "[tracker.csv A007; project_note.md line 5]" written into text

// ---------- dates ----------
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthNum = (w) => { const i = MONTHS.findIndex((m) => m.startsWith(w.toLowerCase().slice(0, 3))); return i < 0 ? null : i + 1; };
const pad = (n) => String(n).padStart(2, "0");
const DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?(?:\s+(\d{4}))?\b|\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/g;
export function findDates(text, year) {
  const out = [];
  for (const m of String(text).matchAll(DATE_RE)) {
    let iso;
    if (m[1]) iso = `${m[1]}-${m[2]}-${m[3]}`;
    else if (m[4]) iso = `${m[6] || year}-${pad(monthNum(m[5]))}-${pad(m[4])}`;
    else iso = `${m[9] || year}-${pad(monthNum(m[7]))}-${pad(m[8])}`;
    out.push({ raw: m[0], iso, index: m.index });
  }
  return out;
}
export function normDate(s, year) { const d = findDates(String(s || ""), year); return d.length === 1 ? d[0].iso : null; }

// ---------- numbers ----------
const NUM_RE = /(?<![\w.])-?\d[\d,]*(?:\.\d+)?%?/g;
export const numberTokens = (text) => [...String(text).matchAll(NUM_RE)].map((m) => ({ raw: m[0], value: Number(m[0].replace(/[,%]/g, "")), index: m.index })).filter((t) => !Number.isNaN(t.value));
export const sameNumber = (a, b) => Math.abs(Number(String(a).replace(/[,%]/g, "")) - Number(String(b).replace(/[,%]/g, ""))) < 1e-9;

// ---------- periods ----------
export function normPeriod(s) {
  const t = String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  let m;
  if ((m = /^(\d{4})-q([1-4])$/.exec(t))) return `${m[1]}-Q${m[2]}`;
  if ((m = /^q([1-4]) (\d{4})$/.exec(t))) return `${m[2]}-Q${m[1]}`;
  if ((m = /^(\d{4})-(\d{2})$/.exec(t))) return `${m[1]}-${m[2]}`;
  if ((m = /^([a-z]+) (\d{4})$/.exec(t)) && monthNum(m[1])) return `${m[2]}-${pad(monthNum(m[1]))}`;
  if ((m = /^(\d{4})-h([12])$/.exec(t))) return `${m[1]}-H${m[2]}`;
  if ((m = /^(first|second) half of (\d{4})$/.exec(t))) return `${m[2]}-H${m[1] === "first" ? 1 : 2}`;
  return t;
}
export const normWords = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ---------- number words ----------
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
export const wordValue = (w) => WORDS[String(w).trim().toLowerCase()];
// digits inside a quarter or half label (Q1, H2), which a quote may carry
export const periodDigitTokens = (text) => [...String(text).matchAll(/\b[QH]([1-4])\b/g)].map((m) => ({ raw: m[1], value: Number(m[1]), index: m.index + 1 }));
export const wordTokens = (text) => [...String(text).matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi)].map((m) => ({ raw: m[0], value: WORDS[m[0].toLowerCase()], index: m.index }));

// ---------- names and ids ----------
export const ID_TOKEN_RE = /\b[A-Z]{1,3}\d{4,}(?:-[A-Z0-9]+)*\b/g;   // run ids, answer ids: R2026-10-30-1, D202610300900-Q03
export const ACTION_ID_RE = /\bA\d{3}\b/g;
export const NAME_RE = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
