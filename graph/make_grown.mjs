#!/usr/bin/env node
// WORK-10, decision 15a: the grown week. Copies each committed data/cases/<case> folder byte for byte
// into data/cases-grown/<case> and writes an archive of 25 earlier weeks beside the six files: eight
// files a week (project note, supplier note, released brief, meeting note, risk note, tracker
// snapshot, answers snapshot, decision log snapshot), 200 files, the same bytes in every folder.
// The archive carries near misses on purpose (the same four metrics with older values; older
// actions under the same ids A001 to A008) and is written so that no gate fires that the six-file
// case does not fire. The archived trackers are the earlier review cycle's: each id holds one older
// action at a time, drawn from a seeded pool of neutral actions for the same five people and three
// client firms, with its own transcript and meeting date; it runs open for one to four weeks,
// closes, stays one week more as closed, and its id then takes the next action. No archived row or
// line repeats the text of any of the eight current actions, which tracker.csv adds in runs
// R2026-10-23-1 and R2026-10-30-1, when the current cycle starts its numbering again.
// graph/prove_grown.mjs checks that, file by file, before any model call.
//
// The rules the archive keeps (WORK-10-DESIGN.md, decision 1):
//   - flat files named archive_<week>_<kind>.<ext>; no name matches brief_<date>.md, a six-file name
//     or risk_note.md
//   - no line carries "Decision needed:" or "Open question:" (past ones read "Decided on <date>:"
//     and "Answered on <date>:"); no line carries the word confidential
//   - in a .md file, a line that names an action id carries no date
//   - no line carries the text of a current action; every tracker snapshot holds open and closed rows
//   - no line carries a must-not number or string of any case (no Brightwater, no October price,
//     no lead time on the Harbour route, no "points", no 8.16 or 8.2 and so on)
// This file never reads eval/expected/.
//
//   node graph/make_grown.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { esc, parseCsv } from "../lib/sources.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CASES = path.join(ROOT, "data", "cases");
const GROWN = path.join(ROOT, "data", "cases-grown");
const SEED = 20261030;
export const CASE_IDS = ["01_clean", "02_disagreement", "03_change", "04_gap", "05_inference", "06_confidential", "state_a"];

// ---------- the same seeded generator as scripts/make_week.js, its own instance ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(SEED);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

// ---------- dates ----------
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday"];
const isoWeek = (iso) => { const d = new Date(`${iso}T00:00:00Z`); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - y) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); };
const monthBefore = (iso) => { const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const quarterBefore = (iso) => { const y = Number(iso.slice(0, 4)), q = Math.ceil(Number(iso.slice(5, 7)) / 3); return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`; };
const quarterAfter = (p) => { const y = Number(p.slice(0, 4)), q = Number(p.slice(-1)); return q === 4 ? `Q1 ${y + 1}` : `Q${q + 1} ${y}`; };
const periodLabel = (p) => (/^\d{4}-Q\d$/.test(p) ? `Q${p.slice(-1)} ${p.slice(0, 4)}` : `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`);
const dayMonth = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

// 25 earlier weeks, ending 2026-05-01 to 2026-10-16 (the six-file week ends 2026-10-30; brief_previous.md is 2026-10-23)
export const WEEKS = Array.from({ length: 25 }, (_, i) => addDays("2026-05-01", 7 * i));

// ---------- the committed six-file tracker, read for the action texts and their due dates ----------
const trackerText = fs.readFileSync(path.join(CASES, "01_clean", "tracker.csv"), "utf8");
for (const c of CASE_IDS) if (fs.readFileSync(path.join(CASES, c, "tracker.csv"), "utf8") !== trackerText) throw new Error(`data/cases/${c}/tracker.csv differs from 01_clean's; the archive assumes one tracker`);
const CURRENT = parseCsv(trackerText);
const CURRENT_DUE = Object.fromEntries(CURRENT.map((r) => [r.action_id, r.due]));

// ---------- shapes (the column lists of scripts/make_week.js) ----------
const TRACKER_COLS = ["action_id", "transcript", "source_line", "action", "owner", "owner_company", "owner_role", "due", "due_note", "status", "added_run", "closed_run", "closed_by"];
const LOG_COLS = ["run_id", "at", "file", "step", "source", "target", "result", "detail"];
const ANS_COLS = ["answer_id", "time", "run_id", "question_id", "tool", "metric", "unit", "dimensions", "filters", "period", "period_b", "value", "rows", "rows_over", "data_version", "data_rows", "lineage", "corrections", "signature"];
const csv = (cols, rows) => [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";

// ---------- the projects, suppliers and people (the six-file week's own, Brightwater left out) ----------
const PROJECTS = [
  { name: "Halden category review", firm: "Halden Logistics", ids: ["A001", "A002", "A005"], people: ["Sofia Lindqvist", "Daniel Okafor", "Aiden Brooks"],
    status: ["Status: the spend export from Sofia Lindqvist is still being cleaned before loading.", "Status: Aiden Brooks has mapped {n} of the spend categories.", "Status: Daniel Okafor has asked for the partner list to be refreshed.", "Status: the category taxonomy has {n} draft headings under review."],
    decided: ["to keep the pilot at the Central branch until the taxonomy is drafted", "to load the spend export in two batches", "to hold the Riverside branch out of the first pass", "to review the taxonomy headings with Halden Logistics every fortnight"],
    answered: ["does the spend export include the Harbour depot? Not at that stage; the Central warehouse only.", "will Halden Logistics share the carrier invoices? Yes, from the next export.", "is the partner list complete? Two partners were still to be named."] },
  { name: "Meridian pricing review", firm: "Meridian Foods", ids: ["A003", "A004", "A008"], people: ["Priya Shah", "Aiden Brooks"],
    status: ["Status: Priya Shah has circulated the distributor discount bands for comment.", "Status: the revised price list is waiting on the distributor counts.", "Status: {n} distributors have returned the pricing survey.", "Status: the contract template is with Priya Shah for a first read."],
    decided: ["to send the price list to the distributors in one batch", "to keep the discount bands at three tiers", "to share the contract template before the price list", "to survey every distributor before the bands are set"],
    answered: ["has Meridian Foods agreed the contract template? Yes, with one change to the payment clause.", "do the discount bands apply to the Harbour branch? Yes, all three branches.", "will the distributors see the bands before the price list? No, both go together."] },
  { name: "Northgate claims review", firm: "Northgate Insurance", ids: ["A006", "A007"], people: ["Tom Reilly", "Aiden Brooks"],
    status: ["Status: Tom Reilly has shared the claims backlog by branch.", "Status: the board pack outline is with Aiden Brooks.", "Status: the claims backlog stood at {n} open files at the last count.", "Status: Tom Reilly has asked for the backlog to be split by claim type."],
    decided: ["to report the claims backlog monthly rather than weekly", "to leave the Harbour branch claims out of the first board summary", "to draft the board summary after the backlog figures are shared", "to show the backlog by claim type and by branch"],
    answered: ["does the board want the backlog by branch? Yes, all three branches.", "will the board pack carry the claim types? Only the three largest.", "is the backlog count taken on the Friday? Yes, at the close of the week."] },
];

// ---------- the earlier cycle's actions: a pool per client, the same people ----------
const PEOPLE = { "Sofia Lindqvist": ["Halden Logistics", "Head of Procurement"], "Daniel Okafor": ["Halden Logistics", "Chief Operating Officer"], "Aiden Brooks": ["Our firm", "Consultant"],
  "Priya Shah": ["Meridian Foods", "Commercial Director"], "Tom Reilly": ["Northgate Insurance", "Head of Claims"], "not stated": ["", ""] };
const POOL = {
  halden: [["Send the carrier list for the first export", "Sofia Lindqvist"], ["Confirm the cost centre codes for the export", "Sofia Lindqvist"], ["Share the depot map for the category review", "Daniel Okafor"],
    ["Book the warehouse walk-through at the Central branch", "Daniel Okafor"], ["Draft the interview guide for the category owners", "Aiden Brooks"], ["Write up the supplier interviews", "Aiden Brooks"], ["Name a contact for the Riverside depot", "not stated"]],
  meridian: [["Send the current distributor list", "Priya Shah"], ["Confirm the promotion calendar for the quarter", "Priya Shah"], ["Share the margin by product line", "Priya Shah"],
    ["Draft the pricing survey for the distributors", "Aiden Brooks"], ["Write up the distributor interviews", "Aiden Brooks"], ["Collect the survey returns from the distributors", "not stated"]],
  northgate: [["Send the claims extract for the last quarter", "Tom Reilly"], ["Confirm the claim types for the review", "Tom Reilly"], ["Share the branch claims contacts", "Tom Reilly"],
    ["Draft the outline of the claims review", "Aiden Brooks"], ["Write up the claims handler interviews", "Aiden Brooks"], ["Set the date for the board pre-read", "not stated"]],
};
const SLOT_CLIENT = { A001: "halden", A002: "halden", A005: "halden", A003: "meridian", A004: "meridian", A008: "meridian", A006: "northgate", A007: "northgate" };
for (const [t] of Object.values(POOL).flat()) if (CURRENT.some((r) => r.action.toLowerCase() === t.toLowerCase())) throw new Error(`the pool repeats a current action: ${t}`);
const lc = (t) => t[0].toLowerCase() + t.slice(1);
const SUPPLIERS = ["Alder Cartons", "Kestrel Freight", "Fenwick Labels", "Marlow Pallets"];
const RISKS = [
  { topic: "Halden carrier invoices", risk: "the carrier invoices may arrive after the spend export is loaded", mit: "load the export first and match the invoices in a second pass", dec: "to accept the invoices in a second pass" },
  { topic: "Meridian distributor payment terms", risk: "some distributors may ask for a longer payment term before signing", mit: "prepare the payment clause before the contracts go out", dec: "to keep the standard payment clause in the template" },
  { topic: "Northgate board timetable", risk: "the board pack may close before the backlog figures are final", mit: "agree a cut-off with Tom Reilly for the figures", dec: "to send the figures as they stand at the cut-off" },
  { topic: "Riverside branch stock counts", risk: "the Riverside stock count may lag the other two branches", mit: "ask the branch for a count on the Thursday", dec: "to report the Riverside count a week behind if needed" },
];
const MAPS = [["Outlet", "branch", "synonym of branch"], ["Txn date", "sale_date", "synonym of sale_date"], ["Qty", "quantity", "synonym of quantity"], ["Store", "branch", "synonym of branch"], ["Item", "product", "synonym of product"], ["Client", "customer", "synonym of customer"]];
const HOLDS = [["quantity", 'quantity "n/a" fails whole number'], ["sale_date", 'sale_date "TBC" fails date'], ["net_amount", 'net_amount "-" fails number']];

// ---------- the four metrics, carried week to week ----------
const METRICS = [
  { q: 1, metric: "orders", label: "Orders", unit: "orders", period: monthBefore, fresh: () => String(int(3700, 4450)), revise: (v) => String(Number(v) + int(5, 60) * (rand() < 0.5 ? -1 : 1)) },
  { q: 2, metric: "revenue", label: "Revenue", unit: "amount", period: quarterBefore, fresh: () => (int(140000000, 170000000) / 100).toFixed(2), revise: (v) => (Number(v) + int(50000, 900000) / 100).toFixed(2) },
  { q: 3, metric: "returns_rate", label: "Returns rate", unit: "%", period: quarterBefore, fresh: () => (int(680, 785) / 100).toFixed(2), revise: (v) => { const d = int(1, 9) / 100; return (Number(v) + d > 7.85 ? Number(v) - d : Number(v) + d).toFixed(2); } },
  { q: 4, metric: "average_order_value", label: "Average order value", unit: "amount", period: monthBefore, fresh: () => (int(11800, 13600) / 100).toFixed(2), revise: (v) => (Number(v) + int(10, 90) / 100 * (rand() < 0.5 ? -1 : 1)).toFixed(2) },
];
// a value the six-file week holds for the same metric is never reused, so a near miss is always a different value
const TAKEN = { orders: ["4210", "3150"], revenue: ["1604322.50"], returns_rate: ["7.92", "8.15"], average_order_value: ["128.56"] };
const show = (v, unit) => { const n = Number(v); return unit === "%" ? n.toFixed(2) + "%" : unit === "amount" ? n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString("en-GB"); };

// ---------- one week of archive ----------
const order = Object.fromEntries(Object.entries(POOL).map(([k, xs]) => { const o = xs.map((_, j) => j); for (let j = o.length - 1; j > 0; j--) { const r = Math.floor(rand() * (j + 1)); [o[j], o[r]] = [o[r], o[j]]; } return [k, { o, next: 0 }]; }));
const slots = {};
// A new older action for an id from week i: added that week (or, in the first week, up to two weeks
// before it), open for one to four weeks, closed, shown one week more or not, then replaced.
function newAction(id, i) {
  const client = SLOT_CLIENT[id], p = order[client], [text, owner] = POOL[client][p.o[p.next++ % p.o.length]];
  const added = i === 0 ? -int(0, 2) : i, addedWeek = addDays(WEEKS[0], 7 * added);
  const close = Math.max(added + int(1, 4), i), hide = close + int(0, 1);
  const meeting = addDays(addedWeek, -int(2, 3));
  let due; do due = addDays(meeting, int(6, Math.max(8, 7 * (close - added) + 1))); while (due === CURRENT_DUE[id]);
  return { text, owner, client, transcript: `w${isoWeek(meeting)}_${client}_call.txt`, source_line: int(2, 9), meeting, due, added_run: `R${addedWeek}-1`, close, hide,
    closed_by: `w${isoWeek(addDays(WEEKS[Math.min(close, WEEKS.length - 1)], -int(1, 3)))}_${client}_call.txt line ${int(2, 9)}` };
}
const values = {};          // metric -> period -> value
let prevAnswerIds = null, prevBrief = null, prevLog = [], dataRows = 8200, dataVersion = 1;
function week(w, i) {
  const wk = isoWeek(w), thu = addDays(w, -1), run = `R${w}-1`, nrun = `N${thu}-1`, dcode = `D${w.replace(/-/g, "")}0900`;
  const proj = PROJECTS[i % PROJECTS.length], supplier = SUPPLIERS[i % SUPPLIERS.length], risk = RISKS[i % RISKS.length];
  const files = {};

  // tracker snapshot: the older action each id holds this week
  const tracker = CURRENT.map(({ action_id: id }) => {
    if (!slots[id] || i > slots[id].hide) slots[id] = newAction(id, i);
    const a = slots[id], closed = i >= a.close;
    return { action_id: id, transcript: a.transcript, source_line: a.source_line, action: a.text, owner: a.owner, owner_company: PEOPLE[a.owner][0], owner_role: PEOPLE[a.owner][1],
      due: a.due, due_note: `"by ${dayMonth(a.due)}", meeting date ${a.meeting}`, status: closed ? "closed" : "open", added_run: a.added_run, closed_run: closed ? `R${WEEKS[a.close]}-1` : "", closed_by: closed ? a.closed_by : "" };
  });
  if (new Set(tracker.map((t) => t.action)).size !== tracker.length) throw new Error(`the tracker for ${w} holds one action under two ids`);
  const nOpen = tracker.filter((t) => t.status === "open").length;
  if (nOpen === 0 || nOpen === tracker.length) throw new Error(`the tracker for ${w} holds ${nOpen} open rows of ${tracker.length}; every snapshot holds open and closed rows`);
  files[`archive_${w}_tracker.csv`] = csv(TRACKER_COLS, tracker);

  // decision log snapshot: last week's file, then this week's one or two
  const log = [...prevLog];
  const nFiles = rand() < 0.4 ? 2 : 1, moved = [];
  for (let f = 0; f < nFiles; f++) {
    const file = nFiles === 1 ? `week${wk}.xlsx` : `week${wk}_${"ab"[f]}.xlsx`, mm = String(10 + int(0, 40)).padStart(2, "0");
    const titleRow = rand() < 0.3, [src, tgt, det] = pick(MAPS), read = int(9, 16), held = rand() < 0.35 ? int(1, 2) : 0;
    const mine = [{ run_id: nrun, at: `${thu}T09:${mm}:00`, file, step: "header", source: "", target: "", result: "found", detail: titleRow ? "header on row 2; 1 title row set aside" : "header on row 1" },
      { run_id: nrun, at: `${thu}T09:${mm}:00`, file, step: "map", source: src, target: tgt, result: "mapped", detail: det }];
    for (let h = 0; h < held; h++) { const [t, d] = pick(HOLDS); mine.push({ run_id: nrun, at: `${thu}T09:${mm}:01`, file, step: "hold_row", source: `row ${int(3, 14)}`, target: t, result: "held", detail: d }); }
    mine.push({ run_id: nrun, at: `${thu}T09:${mm}:02`, file, step: "reconcile", source: "", target: "", result: "ok", detail: `${read} read = ${read - held} merged + ${held} held + 0 removed` });
    log.push(...mine); moved.push({ file, read, merged: read - held, held, line: log.length + 1 });
  }
  files[`archive_${w}_decisions.csv`] = csv(LOG_COLS, log);
  prevLog = log.filter((r) => r.run_id === nrun && r.file === moved[moved.length - 1].file && r.step !== "hold_row");   // next week opens with this week's last file

  // answers snapshot: the four metrics for the month and quarter before the week
  const added = int(80, 200); dataRows += added;
  const answers = [];
  let changed = false;
  for (const m of METRICS) {
    const p = m.period(w); values[m.metric] ||= {};
    const had = values[m.metric][p];
    let v = had, lineage;
    const id = `${dcode}-Q0${m.q}`, prevId = prevAnswerIds ? prevAnswerIds[m.q] : null;
    if (had == null) { do v = m.fresh(); while (TAKEN[m.metric].includes(v)); lineage = "first answer"; }
    else if (rand() < 0.35) { do v = m.revise(had); while (TAKEN[m.metric].includes(v) || v === had); lineage = `data changed since ${prevId}: ${added} rows added`; changed = true; }
    else lineage = `same as ${prevId}`;
    values[m.metric][p] = v;
    const orders = values.orders[monthBefore(w)];
    answers.push({ answer_id: id, time: `${w}T09:00:00`, run_id: dcode, question_id: `Q0${m.q}`, tool: "run_metric", metric: m.metric, unit: m.unit, dimensions: "", filters: "{}", period: p, period_b: "", value: v, rows: "null",
      rows_over: m.metric === "orders" || m.metric === "average_order_value" ? orders : dataRows, data_version: dataVersion, data_rows: dataRows, lineage, corrections: "{}", signature: "" });
  }
  if (changed) { dataVersion++; for (const a of answers) a.data_version = dataVersion; }   // one data version a snapshot
  files[`archive_${w}_answers.csv`] = csv(ANS_COLS, answers);
  prevAnswerIds = Object.fromEntries(answers.map((a, k) => [METRICS[k].q, a.answer_id]));

  // project note
  const sub = (s) => s.replace("{n}", String(int(12, 40)));
  const si = int(0, proj.status.length - 1), sj = (si + int(1, proj.status.length - 1)) % proj.status.length;
  const [s1, s2] = [proj.status[si], proj.status[sj]].map(sub);
  const aid = pick(proj.ids), arow = tracker.find((r) => r.action_id === aid);
  const actionLine = arow.owner === "not stated" ? `${aid}, to ${lc(arow.action)}, was reviewed; no owner is named yet.` : `${aid}, to ${lc(arow.action)}, was reviewed with ${arow.owner}; the tracker holds its date.`;
  const decision = pick(proj.decided), answered = pick(proj.answered);
  const project = [`# Project note, ${proj.name}, week ending ${w}`, "", s1, s2, actionLine, "",
    `Decided on ${addDays(w, -int(0, 4))}: ${decision}.`, "", `Answered on ${addDays(w, -int(0, 4))}: ${answered}`, "", `Next review with ${proj.firm} is booked for ${addDays(w, int(5, 12))}.`];
  files[`archive_${w}_project.md`] = project.join("\n") + "\n";

  // supplier note
  const supplierNote = [`# Supplier note, ${supplier}, week ending ${w}`, "",
    `${supplier} has ${pick(["held its quoted price for all three branches", "raised its quoted price for the Central branch", "held its quoted price for the Riverside branch only"])}.`,
    `"Lead time on the ${pick(["Central", "Riverside"])} run is ${pick(["three", "four", "six", "seven", "eight"])} days," the account manager wrote on ${pick(WEEKDAYS)}.`, "",
    `Decided on ${addDays(w, -int(0, 4))}: to renew the ${supplier} contract for ${pick(["three", "six", "nine"])} months.`, "",
    `Answered on ${addDays(w, -int(0, 4))}: can ${supplier} hold its quoted price into ${quarterAfter(quarterBefore(addDays(w, 92)))}? ${pick(["Yes, confirmed in writing.", "Not beyond the quarter.", "Only for orders placed before the month end."])}`];
  files[`archive_${w}_supplier.md`] = supplierNote.join("\n") + "\n";

  // meeting note
  const [ia, ib] = proj.ids.length > 2 ? [proj.ids[0], pick(proj.ids.slice(1))] : proj.ids;
  const meeting = [`# Meeting note, ${proj.name} weekly call, week ending ${w}`, "", `Attendees: ${proj.people.join(", ")}.`,
    (([ta, tb]) => pick([`The call opened on the action to ${ta}.`, `The call covered the actions to ${ta} and to ${tb}.`, `Most of the call was on the action to ${tb}.`]))([ia, ib].map((x) => lc(tracker.find((r) => r.action_id === x).action))),
    `${ia} and ${ib} were discussed; the tracker was updated after the call.`,
    pick(["The Harbour depot figures were not ready for the call.", "The Central branch figures were shared on screen.", "The Riverside branch asked for a separate session."]), "",
    `The next call is on ${pick(WEEKDAYS)}.`];
  files[`archive_${w}_meeting.md`] = meeting.join("\n") + "\n";

  // risk note
  const riskNote = [`# Risk note, ${risk.topic}, week ending ${w}`, "", `Risk: ${risk.risk}.`, `Likelihood: ${pick(["low", "medium", "high"])}; impact: ${pick(["low", "medium", "high"])}.`, `Mitigation: ${risk.mit}.`, "",
    `Decided on ${addDays(w, -int(0, 4))}: ${risk.dec}.`];
  files[`archive_${w}_risk.md`] = riskNote.join("\n") + "\n";

  // the brief released that week, in the five sections, its references as they were then
  const B = [`# Weekly brief, week ending ${w}`, "Sources read: answers.csv, brief_previous.md, decision_log.csv, merged.csv, project_note.md, supplier_note.md, tracker.csv. Declined: none.", "", "## What moved"];
  for (const m of moved) B.push(`- ${m.file}: ${m.read} rows read, ${m.merged} merged${m.held ? `, ${m.held} held` : ""}. [decision_log.csv line ${m.line}]`);
  for (const t of tracker.filter((r) => r.closed_run === run)) B.push(`- ${t.action}, ${t.owner === "not stated" ? "owner not stated" : t.owner}: closed this week. [tracker.csv ${t.action_id}]`);
  B.push("", "## What is due");
  const open = tracker.map((t, k) => ({ ...t, row: k + 2 })).filter((t) => t.status === "open").sort((a, b) => a.due.localeCompare(b.due));
  if (!open.length) B.push("- No source this week.");
  for (const t of open) B.push(`- ${t.action}, ${t.owner === "not stated" ? "owner not stated" : t.owner}, due ${t.due}. [tracker.csv row ${t.row}]`);
  B.push("", "## What changed in the numbers");
  answers.forEach((a, k) => {
    const m = METRICS[k], label = `- ${m.label}, ${periodLabel(a.period)}:`, v = show(a.value, a.unit);
    const pl = prevBrief ? prevBrief.findIndex((l) => l.startsWith(label)) : -1;
    if (pl < 0) { B.push(`${label} ${v}; first brief with this number. [answers.csv ${a.answer_id}]`); return; }
    const old = /: ([\d,.]+%?)/.exec(prevBrief[pl])[1];
    B.push(`${label} ${v}; ${old === v ? "unchanged from last week" : `last week ${old}`}. [answers.csv ${a.answer_id}; brief_previous.md line ${pl + 1}]`);
  });
  B.push("", "## What needs a decision");
  B.push(rand() < 0.5 ? "- No source this week." : `- Whether ${pick(["to extend the pilot to another branch", "to change the discount bands", "to move the board summary a week"])} was still open that week. [project_note.md line ${int(6, 8)}]`);
  B.push("", "## Open questions");
  const noOwner = tracker.filter((t) => t.status === "open" && t.owner === "not stated");
  if (!noOwner.length) B.push("- No source this week.");
  for (const t of noOwner) B.push(`- ${t.action_id} has no owner stated. [tracker.csv ${t.action_id}]`);
  B.push("", "Removed: none.");
  files[`archive_${w}_brief.md`] = B.join("\n") + "\n";
  prevBrief = B;
  return files;
}

// ---------- write ----------
export function makeArchive() {
  const archive = {};
  WEEKS.forEach((w, i) => Object.assign(archive, week(w, i)));
  return archive;
}
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archive = makeArchive();
  const names = Object.keys(archive).sort();
  fs.mkdirSync(GROWN, { recursive: true });
  let files = 0, bytes = 0;
  for (const c of CASE_IDS) {
    const dir = path.join(GROWN, c);
    fs.rmSync(dir, { recursive: true, force: true });   // only the seven folders this script writes
    fs.mkdirSync(dir);
    for (const f of fs.readdirSync(path.join(CASES, c)).sort()) { fs.copyFileSync(path.join(CASES, c, f), path.join(dir, f)); files++; bytes += fs.statSync(path.join(dir, f)).size; }
    for (const n of names) { fs.writeFileSync(path.join(dir, n), archive[n]); files++; bytes += Buffer.byteLength(archive[n]); }
  }
  const archiveBytes = names.reduce((n, k) => n + Buffer.byteLength(archive[k]), 0);
  const archiveHash = sha(names.map((n) => `${sha(archive[n])}  ${n}`).join("\n") + "\n");
  console.log(`archive: ${names.length} files, ${archiveBytes} bytes, weeks ${WEEKS[0]} to ${WEEKS[WEEKS.length - 1]}`);
  console.log(`archive hash (sha256 of the sorted "sha256  name" list): ${archiveHash}`);
  console.log(`data/cases-grown: ${CASE_IDS.length} folders, ${files} files, ${bytes} bytes`);
}
