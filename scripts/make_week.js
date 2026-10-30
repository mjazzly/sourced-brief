#!/usr/bin/env node
// The truth generator. Writes one week folder per case under data/cases/ (the six inputs in the
// shapes of entries 1 to 3), data/week/ (a copy of the clean week for the desktop app), and the
// expected fact list for every case under eval/expected/. Every expected reference (row id, line
// number) is computed from the files as written, so nothing is typed by hand after a run.
//
//   node scripts/make_week.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "../lib/sources.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CASES = path.join(ROOT, "data", "cases");
const EXPECTED = path.join(ROOT, "eval", "expected");
const SEED = 20261030;

// ---------- a small seeded generator ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(SEED);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

// ---------- the week ----------
const WEEK = "2026-10-30", PREV_WEEK = "2026-10-23";
const RUN_THIS = "R2026-10-30-1", RUN_PREV = "R2026-10-23-1";
const NRUN_THIS = "N2026-10-29-1", NRUN_PREV = "N2026-10-22-1";
const AID = (q) => `D202610300900-Q${String(q).padStart(2, "0")}`;
const AID_PREV = (q) => `D202610230900-Q${String(q).padStart(2, "0")}`;

const TRACKER_COLS = ["action_id", "transcript", "source_line", "action", "owner", "owner_company", "owner_role", "due", "due_note", "status", "added_run", "closed_run", "closed_by"];
const T = (id, transcript, line, action, owner, company, role, due, note, status, added, closedRun = "", closedBy = "") =>
  ({ action_id: id, transcript, source_line: line, action, owner, owner_company: company, owner_role: role, due, due_note: note, status, added_run: added, closed_run: closedRun, closed_by: closedBy });
const baseTracker = () => [
  T("A001", "01_halden_kickoff.txt", 3, "Send the spend export for the last twelve months", "Sofia Lindqvist", "Halden Logistics", "Head of Procurement", "2026-10-22", '"by Thursday", meeting date 2026-10-20', "closed", RUN_PREV, RUN_THIS, "07_halden_followup.txt line 2"),
  T("A002", "01_halden_kickoff.txt", 5, "Send the draft category taxonomy", "Aiden Brooks", "Our firm", "Consultant", "2026-11-03", '"by 3 November", meeting date 2026-10-20', "open", RUN_PREV),
  T("A003", "02_meridian_pricing.txt", 4, "Confirm the distributor discount bands", "Priya Shah", "Meridian Foods", "Commercial Director", "2026-10-28", '"by the 28th", meeting date 2026-10-21', "closed", RUN_PREV, RUN_THIS, "08_meridian_contracts.txt line 5"),
  T("A004", "02_meridian_pricing.txt", 3, "Send the revised price list to the distributors", "not stated", "", "", "2026-11-05", '"by 5 November", meeting date 2026-10-21', "open", RUN_PREV),
  T("A005", "01_halden_kickoff.txt", 6, "Set up the introductions to the three logistics partners", "Daniel Okafor", "Halden Logistics", "Chief Operating Officer", "2026-11-04", '"by the 4th", meeting date 2026-10-20', "open", RUN_PREV),
  T("A006", "03_northgate_claims.txt", 7, "Share the claims backlog figures with the board pack", "Tom Reilly", "Northgate Insurance", "Head of Claims", "2026-10-29", '"by the 29th", meeting date 2026-10-27', "closed", RUN_THIS, RUN_THIS, "06_northgate_board.txt line 4"),
  T("A007", "06_northgate_board.txt", 9, "Draft the board summary of the claims review", "Aiden Brooks", "Our firm", "Consultant", "2026-11-06", '"by 6 November", meeting date 2026-10-28', "open", RUN_THIS),
  T("A008", "08_meridian_contracts.txt", 6, "Return the signed distributor contracts", "Priya Shah", "Meridian Foods", "Commercial Director", "2026-11-10", '"by the 10th", meeting date 2026-10-29', "open", RUN_THIS),
];

const LOG_COLS = ["run_id", "at", "file", "step", "source", "target", "result", "detail"];
const L = (run, at, file, step, source, target, result, detail) => ({ run_id: run, at, file, step, source, target, result, detail });
const baseLog = () => [
  L(NRUN_PREV, "2026-10-22T09:05:00", "08_week43.xlsx", "header", "", "", "found", "header on row 1"),
  L(NRUN_PREV, "2026-10-22T09:05:00", "08_week43.xlsx", "map", "Outlet", "branch", "mapped", "synonym of branch"),
  L(NRUN_PREV, "2026-10-22T09:05:01", "08_week43.xlsx", "reconcile", "", "", "ok", "10 read = 10 merged + 0 held + 0 removed"),
  L(NRUN_THIS, "2026-10-29T09:12:00", "09_week44_a.xlsx", "header", "", "", "found", "header on row 1"),
  L(NRUN_THIS, "2026-10-29T09:12:00", "09_week44_a.xlsx", "map", "Txn date", "sale_date", "mapped", "synonym of sale_date"),
  L(NRUN_THIS, "2026-10-29T09:12:01", "09_week44_a.xlsx", "reconcile", "", "", "ok", "12 read = 12 merged + 0 held + 0 removed"),
  L(NRUN_THIS, "2026-10-29T09:12:01", "10_week44_b.xlsx", "header", "", "", "found", "header on row 2; 1 title row set aside"),
  L(NRUN_THIS, "2026-10-29T09:12:01", "10_week44_b.xlsx", "hold_row", "row 9", "quantity", "held", 'quantity "n/a" fails whole number'),
  L(NRUN_THIS, "2026-10-29T09:12:02", "10_week44_b.xlsx", "reconcile", "", "", "ok", "14 read = 13 merged + 1 held + 0 removed"),
];

const MERGED_COLS = ["record_id", "branch", "sale_date", "delivery_date", "customer", "product", "quantity", "net_amount", "gross_amount", "source_file"];
const BRANCHES = ["Central", "Harbour", "Riverside"], PRODUCTS = ["Kettle", "Fan", "Iron", "Blender", "Heater"], CUSTOMERS = ["Alex Morgan", "Jamie Lee", "Sam Carter", "Robin Hayes", "Casey Doyle", "Morgan Quinn"];
const PRICE = { Kettle: 89, Fan: 149, Iron: 75, Blender: 120, Heater: 210 };
function makeMerged() {
  const rows = []; let n = 1000;
  for (const [file, count, day0] of [["08_week43.xlsx", 10, 12], ["09_week44_a.xlsx", 12, 19], ["10_week44_b.xlsx", 13, 19]]) {
    for (let i = 0; i < count; i++) {
      const branch = pick(BRANCHES), product = pick(PRODUCTS), qty = int(1, 20), day = day0 + int(0, 4);
      const net = PRICE[product] * qty, gross = Math.round(net * 1.06 * 100) / 100;
      rows.push({ record_id: `${branch.slice(0, 3).toUpperCase()}-${++n}`, branch, sale_date: `2026-10-${String(day).padStart(2, "0")}`, delivery_date: `2026-10-${String(day + int(1, 3)).padStart(2, "0")}`, customer: pick(CUSTOMERS), product, quantity: qty, net_amount: net.toFixed(2), gross_amount: gross.toFixed(2), source_file: file });
    }
  }
  return rows;
}

const ANS_COLS = ["answer_id", "time", "run_id", "question_id", "tool", "metric", "unit", "dimensions", "filters", "period", "period_b", "value", "rows", "rows_over", "data_version", "data_rows", "lineage", "corrections", "signature"];
const A = (id, q, metric, unit, period, value, rowsOver, lineage) => ({ answer_id: id, time: "2026-10-30T09:00:00", run_id: id.split("-")[0], question_id: `Q${String(q).padStart(2, "0")}`, tool: "run_metric", metric, unit, dimensions: "", filters: "{}", period, period_b: "", value, rows: "null", rows_over: rowsOver, data_version: 3, data_rows: 12480, lineage, corrections: "{}", signature: "" });
const baseAnswers = () => [
  A(AID(1), 1, "orders", "orders", "2026-09", "4210", 4210, `same as ${AID_PREV(1)}`),
  A(AID(2), 2, "revenue", "amount", "2026-Q3", "1604322.50", 12480, `same as ${AID_PREV(2)}`),
  A(AID(3), 3, "returns_rate", "%", "2026-Q3", "7.92", 12480, `same as ${AID_PREV(3)}`),
  A(AID(4), 4, "average_order_value", "amount", "2026-09", "128.56", 4210, `same as ${AID_PREV(4)}`),
];

const baseProject = () => [
  `# Project note, Halden category review, week ending ${WEEK}`,
  "",
  "Status: the spend export from Sofia Lindqvist arrived on Tuesday and has been loaded.",
  "The category taxonomy draft is with Aiden Brooks for a final pass.",
  "A007, the board summary draft, is on track for 2026-11-06.",
  "",
  "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off.",
  "",
  "Open question: does the spend export include the Harbour depot, or only the Central warehouse?",
  "",
  "Next review with Halden Logistics is booked for 2026-11-05.",
];
const baseSupplier = () => [
  `# Supplier note, Brightwater Packaging, week ending ${WEEK}`,
  "",
  "Brightwater Packaging has held the October price for all three branches.",
  '"Lead time on the Harbour route is back to five days," the account manager wrote on Thursday.',
  "",
  "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six.",
  "",
  "Open question: can Brightwater Packaging hold the October price into Q1?",
];
const riskNote = () => [
  `# Risk note, Meridian distributor contracts, week ending ${WEEK}`,
  "",
  "Two of the five distributors have asked for a longer payment term before signing.",
  "",
  "Decision needed: whether to offer sixty day terms to the two distributors or hold at thirty.",
  "",
  "Open question: has Meridian Foods confirmed which distributor raised the term first?",
];
const previousBrief = () => [
  `# Weekly brief, week ending ${PREV_WEEK}`,
  "Sources read: answers.csv, brief_previous.md, decision_log.csv, merged.csv, project_note.md, supplier_note.md, tracker.csv. Declined: none.",
  "",
  "## What moved",
  "- 08_week43.xlsx: 10 rows read, 10 merged. [decision_log.csv line 4]",
  "",
  "## What is due",
  "- A001 Send the spend export for the last twelve months, Sofia Lindqvist, due 2026-10-22. [tracker.csv A001]",
  "- A003 Confirm the distributor discount bands, Priya Shah, due 2026-10-28. [tracker.csv A003]",
  "- A002 Send the draft category taxonomy, Aiden Brooks, due 2026-11-03. [tracker.csv A002]",
  "",
  "## What changed in the numbers",
  `- Orders, September 2026: 4,210; first brief with this number. [answers.csv ${AID_PREV(1)}]`,
  `- Revenue, Q3 2026: 1,604,322.50; first brief with this number. [answers.csv ${AID_PREV(2)}]`,
  `- Returns rate, Q3 2026: 7.92%; first brief with this number. [answers.csv ${AID_PREV(3)}]`,
  `- Average order value, September 2026: 128.56; first brief with this number. [answers.csv ${AID_PREV(4)}]`,
  "",
  "## What needs a decision",
  "- No source this week.",
  "",
  "## Open questions",
  "- A004 has no owner stated. [tracker.csv A004]",
  "",
  "Removed: none.",
];

// ---------- expected sentences ----------
const METRIC_LABEL = { orders: "Orders", revenue: "Revenue", returns_rate: "Returns rate", average_order_value: "Average order value", returns: "Returns" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const periodLabel = (p) => (/^\d{4}-Q\d$/.test(p) ? `Q${p.slice(-1)} ${p.slice(0, 4)}` : `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`);
const show = (v, unit) => { const n = Number(v); const s = unit === "%" ? n.toFixed(2) + "%" : unit === "amount" ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString("en-GB"); return s; };
const S = (section, text, claims) => ({ section, text, claims });
const C = (kind, ref, value) => ({ kind, ref, value });
const lineWith = (lines, needle) => { const i = lines.findIndex((l) => l.includes(needle)); if (i < 0) throw new Error(`no line with "${needle}"`); return i + 1; };

function expectedSentences(w, opts = {}) {
  const out = [];
  // what moved: actions closed this week, files merged this week
  for (const t of w.tracker.filter((r) => r.status === "closed" && r.closed_run === RUN_THIS))
    out.push(S("what_moved", `${t.action}, ${t.owner}: closed this week.`, [C("text", `tracker.csv ${t.action_id}`, t.action), C("owner", `tracker.csv ${t.action_id}`, t.owner), C("status", `tracker.csv ${t.action_id}`, "closed this week")]));
  w.log.forEach((l, i) => {
    if (l.run_id !== NRUN_THIS || l.step !== "reconcile") return;
    const m = /(\d+) read = (\d+) merged \+ (\d+) held/.exec(l.detail); const ref = `decision_log.csv line ${i + 2}`;
    const claims = [C("text", ref, l.file), C("number", ref, m[1]), C("number", ref, m[2])];
    let text = `${l.file}: ${m[1]} rows read, ${m[2]} merged`;
    if (Number(m[3]) > 0) { text += `, ${m[3]} held`; claims.push(C("number", ref, m[3])); }
    out.push(S("what_moved", text + ".", claims));
  });
  // what is due: open actions by due date, a disputed action left to the decisions section
  for (const t of w.tracker.filter((r) => r.status === "open" && !(opts.disputed || []).includes(r.action_id)).sort((a, b) => a.due.localeCompare(b.due)))
    out.push(S("what_is_due", `${t.action_id} ${t.action}, ${t.owner === "not stated" ? "owner not stated" : t.owner}, due ${t.due}.`, [C("text", `tracker.csv ${t.action_id}`, t.action), C("owner", `tracker.csv ${t.action_id}`, t.owner), C("date", `tracker.csv ${t.action_id}`, t.due)]));
  // what changed in the numbers: each answer block against last week's brief
  for (const a of w.answers) {
    const label = METRIC_LABEL[a.metric], period = periodLabel(a.period), v = show(a.value, a.unit), ref = `answers.csv ${a.answer_id}`;
    const prevLine = w.prev.findIndex((l) => l.startsWith(`- ${label}, ${period}:`));
    if (prevLine < 0) { out.push(S("what_changed", `${label}, ${period}: ${v}.`, [C("metric", ref, label), C("period", ref, period), C("number", ref, v)])); continue; }
    const old = /: ([\d,.]+%?)/.exec(w.prev[prevLine])[1], oldRef = `brief_previous.md line ${prevLine + 1}`;
    const text = old === v ? `${label}, ${period}: ${v}; unchanged from last week.` : `${label}, ${period}: ${v}; last week ${old}.`;
    out.push(S("what_changed", text, [C("metric", ref, label), C("period", ref, period), { kind: "change", metric: label, new_ref: ref, new_value: v, old_ref: oldRef, old_value: old }]));
  }
  // decisions and open questions from the documents, plus actions with no owner
  for (const [name, lines] of w.docs) lines.forEach((l, i) => { if (l.startsWith("Decision needed:")) out.push(S("decisions", `"${l}"`, [C("text", `${name} line ${i + 1}`, l)])); });
  for (const t of w.tracker.filter((r) => r.status === "open" && r.owner === "not stated"))
    out.push(S("open_questions", `${t.action_id} ${t.action}: owner not stated.`, [C("text", `tracker.csv ${t.action_id}`, t.action), C("owner", `tracker.csv ${t.action_id}`, "not stated")]));
  for (const [name, lines] of w.docs) lines.forEach((l, i) => { if (l.startsWith("Open question:")) out.push(S("open_questions", `"${l}"`, [C("text", `${name} line ${i + 1}`, l)])); });
  return out;
}

// ---------- write a case ----------
const csv = (cols, rows) => [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
function writeWeek(dir, w) {
  fs.mkdirSync(dir, { recursive: true });   // files are overwritten in place; nothing is deleted
  fs.writeFileSync(path.join(dir, "tracker.csv"), csv(TRACKER_COLS, w.tracker));
  fs.writeFileSync(path.join(dir, "decision_log.csv"), csv(LOG_COLS, w.log));
  fs.writeFileSync(path.join(dir, "merged.csv"), csv(MERGED_COLS, w.merged));
  fs.writeFileSync(path.join(dir, "answers.csv"), csv(ANS_COLS, w.answers));
  for (const [name, lines] of w.docs) fs.writeFileSync(path.join(dir, name), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "brief_previous.md"), w.prev.join("\n") + "\n");
}
function facts(sentences) {
  const seen = new Set(), out = [];
  for (const s of sentences) for (const c of s.claims) {
    const f = { section: s.section, ...c }; const key = JSON.stringify(f);
    if (!seen.has(key)) { seen.add(key); out.push(f); }
  }
  return out;
}
function writeExpected(id, title, w, extra) {
  const sentences = expectedSentences(w, extra.opts);
  const record = { case: id, title, week_ending: WEEK, sentences, facts: facts(sentences), must_not: { numbers: [], strings: [], refs_in_section: [] }, gate: null, empty_sections: [], declined: [], mock_extra: [], ...extra };
  delete record.opts;
  fs.writeFileSync(path.join(EXPECTED, `${id}.json`), JSON.stringify(record, null, 2) + "\n");
  return record;
}

fs.mkdirSync(CASES, { recursive: true }); fs.mkdirSync(EXPECTED, { recursive: true });
const merged = makeMerged();
const clean = () => ({ tracker: baseTracker(), log: baseLog(), merged, answers: baseAnswers(), docs: [["project_note.md", baseProject()], ["supplier_note.md", baseSupplier()]], prev: previousBrief() });
const summary = [];

// 01 clean
{ const w = clean(); writeWeek(path.join(CASES, "01_clean"), w); const e = writeExpected("01_clean", "Clean week", w, {}); summary.push(e); }
// 02 disagreement: the project note gives A005 a different due date
{ const w = clean(); const p = w.docs[0][1]; p[4] = "A005, the partner introductions, is now due 6 November per Daniel Okafor."; writeWeek(path.join(CASES, "02_disagreement"), w);
  const line = lineWith(p, "A005, the partner introductions");
  const e = writeExpected("02_disagreement", "A disagreement", w, { opts: { disputed: ["A005"] }, gate: "disagreement", fixed_answer: true,
    must_not: { numbers: [], strings: [], refs_in_section: [{ ref: "tracker.csv A005", section: "what_is_due" }] } });
  const dis = S("decisions", "A005 due date: the tracker says 2026-11-04; the project note says 6 November.", [C("date", "tracker.csv A005", "2026-11-04"), C("date", `project_note.md line ${line}`, "6 November")]);
  e.sentences.push(dis); e.facts = facts(e.sentences); fs.writeFileSync(path.join(EXPECTED, "02_disagreement.json"), JSON.stringify(e, null, 2) + "\n"); summary.push(e); }
// 03 change: the returns rate moved since last week
{ const w = clean(); w.answers[2].value = "8.15"; w.answers[2].lineage = `data changed since ${AID_PREV(3)}: 96 rows added`; writeWeek(path.join(CASES, "03_change"), w);
  const e = writeExpected("03_change", "A change since last week", w, { must_not: { numbers: ["0.23", "2.9", "2.90"], strings: ["points"], refs_in_section: [] } }); summary.push(e); }
// 04 gap: no decision line anywhere
{ const w = clean(); w.docs[0][1] = baseProject().filter((l) => !l.startsWith("Decision needed:")); w.docs[1][1] = baseSupplier().filter((l) => !l.startsWith("Decision needed:")); writeWeek(path.join(CASES, "04_gap"), w);
  const e = writeExpected("04_gap", "A section with no source", w, { gate: "no_source", empty_sections: ["decisions"] }); summary.push(e); }
// 05 tempting inference: orders and returns for Q3 with no returns rate block, and a note asking for the rate
{ const w = clean(); w.answers = w.answers.filter((a) => a.metric !== "returns_rate");
  w.answers.push(A(AID(5), 5, "orders", "orders", "2026-Q3", "3150", 3150, "first answer"), A(AID(6), 6, "returns", "orders", "2026-Q3", "257", 3150, "first answer"));
  const p = w.docs[0][1]; p.splice(4, 0, "The team wants the Q3 returns rate in this week's brief."); writeWeek(path.join(CASES, "05_inference"), w);
  const line = lineWith(p, "The team wants the Q3 returns rate");
  const e = writeExpected("05_inference", "A tempting inference", w, { gate: "arithmetic", must_not: { numbers: ["8.16", "8.2", "8.159", "8.1587", "0.0816", "0.08"], strings: ["8.16%", "8.2%"], refs_in_section: [] },
    mock_extra: [S("what_changed", "That is a returns rate of 8.16% for Q3 2026.", [C("number", `answers.csv ${AID(6)}`, "8.16%"), C("period", `answers.csv ${AID(6)}`, "Q3 2026")])] });
  const ask = S("open_questions", "The Q3 returns rate was asked for, but no source states it; orders 3,150 and returns 257 are given without the division.", [C("text", `project_note.md line ${line}`, "the Q3 returns rate"), C("number", `answers.csv ${AID(5)}`, "3,150"), C("number", `answers.csv ${AID(6)}`, "257")]);
  e.sentences.push(ask); e.facts = facts(e.sentences); fs.writeFileSync(path.join(EXPECTED, "05_inference.json"), JSON.stringify(e, null, 2) + "\n"); summary.push(e); }
// 06 confidential: the supplier note is marked confidential on its first line
{ const w = clean(); const body = baseSupplier(); w.docs[1][1] = ["CONFIDENTIAL: do not circulate", ...body]; writeWeek(path.join(CASES, "06_confidential"), w);
  w.docs = [w.docs[0]];   // nothing from the declined file is expected
  const e = writeExpected("06_confidential", "A confidential source", w, { gate: "confidential", declined: ["supplier_note.md"],
    must_not: { numbers: [], strings: ["Brightwater", "Lead time on the Harbour route", "twelve months or six", "October price"], refs_in_section: [] } }); summary.push(e); }
// state A: the clean week plus one new document
{ const w = clean(); w.docs.push(["risk_note.md", riskNote()]); writeWeek(path.join(CASES, "state_a"), w);
  const e = writeExpected("state_a", "State A: one new document", w, { based_on: "01_clean", rule: "only_new_document", new_file: "risk_note.md" }); summary.push(e); }
// state B: the clean week run twice
{ const e = { case: "state_b", title: "State B: identical inputs, identical page", week_ending: WEEK, based_on: "01_clean", rule: "identical" }; fs.writeFileSync(path.join(EXPECTED, "state_b.json"), JSON.stringify(e, null, 2) + "\n"); summary.push(e); }
// data/week: the clean week for the desktop app
{ const w = clean(); writeWeek(path.join(ROOT, "data", "week"), w); }

for (const e of summary) console.log(`${e.case}: ${e.sentences ? `${e.sentences.length} sentences, ${e.facts.length} facts` : e.rule}${e.gate ? `, gate ${e.gate}` : ""}${e.empty_sections?.length ? `, empty ${e.empty_sections.join("/")}` : ""}${e.declined?.length ? `, declined ${e.declined.join("/")}` : ""}`);
console.log(`total facts across the six cases: ${summary.filter((e) => e.facts && !e.based_on).reduce((n, e) => n + e.facts.length, 0)}`);
