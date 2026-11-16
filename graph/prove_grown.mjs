#!/usr/bin/env node
// WORK-10, decision 1: the proof that the grown week fires no gate the six-file week does not.
// Runs before any model call, on every folder in data/cases-grown/, against its six-file folder in
// data/cases/, with lib/ and eval/check.js imported unchanged. Any failed check exits 1.
//
//   1. six files     every committed file of data/cases/<case> is in the grown folder byte for byte
//   2. archive       the grown folder holds the six files and the 200 archive files only, flat, named
//                    archive_<week>_<kind>.<ext>, 25 weeks of 8 kinds, the same bytes in every folder;
//                    every tracker snapshot holds open and closed rows, no action twice, and each
//                    archived brief's What moved and What is due lines follow its own week's tracker
//   3. declined      the declined lists are equal
//   4. tracker dates for every tracker row, a date claim alone on its due date gives the same result
//                    (pass, or the same disagreement) in both folders
//   5. expected      the expected sentences of eval/expected/ (and the mock's planted trap) run
//                    through checkDraft pass and fail exactly as on the six-file folder
//   6. forbidden     no archive line starts "Decision needed:" or "Open question:" (nor carries either
//                    anywhere), no first line is marked confidential (nor any line), no .md line names
//                    an action id with a date other than its tracker due date, and no line carries a
//                    must-not number or string of any case or the text of a current tracker action
//   7. mock          a scripted stand-in, through the real server over MCP, writes the eight briefs on
//                    the grown week and meets the bar (and, as a control, on the six-file week)
//
// It also measures each folder's size: raw bytes, and characters as read_source returns them.
//
//   node graph/prove_grown.mjs [--no-mock] [--json <file>]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadSources, findDates, ACTION_ID_RE, OUTPUT_FILES, sameNumber, parseCsv } from "../lib/sources.js";
import { checkClaim, checkDraft, SECTIONS } from "../lib/check.js";
import { Store } from "../lib/store.js";
import { loadExpected, loadRun, checkAll, verdict } from "../eval/check.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CASES = path.join(ROOT, "data", "cases");
const GROWN = path.join(ROOT, "data", "cases-grown");
const argv = process.argv.slice(2);
const NO_MOCK = argv.includes("--no-mock");
const JSON_OUT = argv.includes("--json") ? argv[argv.indexOf("--json") + 1] : null;

const expected = loadExpected(path.join(ROOT, "eval", "expected"));
const byCase = Object.fromEntries(expected.cases.map((e) => [e.case, e]));
const FOLDERS = fs.readdirSync(GROWN, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const ARCHIVE_NAME = /^archive_(\d{4}-\d{2}-\d{2})_(project|supplier|brief|meeting|risk|tracker|answers|decisions)\.(md|csv)$/;
const KIND_EXT = { project: "md", supplier: "md", brief: "md", meeting: "md", risk: "md", tracker: "csv", answers: "csv", decisions: "csv" };
const SIX_NAMES = new Set(fs.readdirSync(CASES).flatMap((c) => fs.readdirSync(path.join(CASES, c))));
const PAGE_NUM = /(?<![\w.])-?\d[\d,]*(?:\.\d+)?/g;   // the number pattern eval/check.js applies to the page
const ci = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const MUST_NOT_NUMBERS = [...new Set(expected.cases.flatMap((e) => (e.must_not?.numbers || []).map(String)))];
const MUST_NOT_STRINGS = [...new Set(expected.cases.flatMap((e) => e.must_not?.strings || []))];

const results = {};
const check = (folder, name, ok, detail) => { (results[folder] ||= {})[name] = { ok, detail }; };

// ---------- size: characters as the server returns them ----------
function readChars(dir) {
  const s = loadSources(dir), store = Object.assign(Object.create(Store.prototype), { dir, sources: s, runId: "", caseId: "", log() {} });
  let chars = 0;
  for (const f of s.read) chars += JSON.stringify(store.readSource(f), null, 2).length;
  return { files: s.read.length + s.declined.length, read: s.read.length, chars, list_sources_chars: JSON.stringify(store.listSources(), null, 2).length };
}
const dirBytes = (dir) => fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);

// ---------- checks 1 to 6 ----------
let archiveRef = null;
for (const c of FOLDERS) {
  const six = path.join(CASES, c), grown = path.join(GROWN, c);
  const sixFiles = fs.readdirSync(six).sort(), entries = fs.readdirSync(grown, { withFileTypes: true });
  // 1. six files
  const diff = sixFiles.filter((f) => !fs.existsSync(path.join(grown, f)) || sha(fs.readFileSync(path.join(six, f))) !== sha(fs.readFileSync(path.join(grown, f))));
  check(c, "1 six files", diff.length === 0, diff.length ? `differ or missing: ${diff.join(", ")}` : `${sixFiles.length} files identical by sha256`);
  // 2. archive
  const problems = [];
  const subdirs = entries.filter((e) => !e.isFile()).map((e) => e.name);
  if (subdirs.length) problems.push(`not a plain file: ${subdirs.join(", ")}`);
  const extra = entries.filter((e) => e.isFile() && !sixFiles.includes(e.name)).map((e) => e.name).sort();
  const bad = extra.filter((n) => { const m = ARCHIVE_NAME.exec(n); return !m || KIND_EXT[m[2]] !== m[3] || OUTPUT_FILES.test(n) || SIX_NAMES.has(n) || n === "risk_note.md"; });
  if (bad.length) problems.push(`names outside the rule: ${bad.join(", ")}`);
  const weeks = new Set(extra.map((n) => ARCHIVE_NAME.exec(n)?.[1]).filter(Boolean));
  if (extra.length !== 200 || weeks.size !== 25) problems.push(`${extra.length} archive files over ${weeks.size} weeks, not 200 over 25`);
  for (const w of weeks) { const k = extra.filter((n) => n.startsWith(`archive_${w}_`)).length; if (k !== 8) problems.push(`week ${w} has ${k} files, not 8`); }
  const hashes = Object.fromEntries(extra.map((n) => [n, sha(fs.readFileSync(path.join(grown, n)))]));
  const listHash = sha(extra.map((n) => `${hashes[n]}  ${n}`).join("\n") + "\n");
  if (archiveRef == null) archiveRef = { folder: c, hash: listHash }; else if (archiveRef.hash !== listHash) problems.push(`archive bytes differ from ${archiveRef.folder}'s`);
  // each week's tracker and brief agree
  const showOwner = (o) => (o === "not stated" ? "owner not stated" : o);
  let mixMin = Infinity, briefLines = 0;
  for (const w of [...weeks].sort()) {
    const tr = parseCsv(fs.readFileSync(path.join(grown, `archive_${w}_tracker.csv`), "utf8")), run = `R${w}-1`;
    const open = tr.filter((r) => r.status === "open").length; mixMin = Math.min(mixMin, open, tr.length - open);
    if (!open || open === tr.length) problems.push(`archive_${w}_tracker.csv holds ${open} open rows of ${tr.length}`);
    if (new Set(tr.map((r) => r.action)).size !== tr.length) problems.push(`archive_${w}_tracker.csv holds one action under two ids`);
    const b = fs.readFileSync(path.join(grown, `archive_${w}_brief.md`), "utf8").split("\n");
    const sec = (t) => { const i = b.indexOf(`## ${t}`); const out = []; for (let j = i + 1; j < b.length && !b[j].startsWith("## "); j++) if (b[j].startsWith("- ") && b[j] !== "- No source this week.") out.push(b[j]); return out; };
    const want = { moved: tr.filter((r) => r.closed_run === run).map((r) => `- ${r.action}, ${showOwner(r.owner)}: closed this week. [tracker.csv ${r.action_id}]`),
      due: tr.map((r, k) => ({ ...r, row: k + 2 })).filter((r) => r.status === "open").sort((x, y) => x.due.localeCompare(y.due)).map((r) => `- ${r.action}, ${showOwner(r.owner)}, due ${r.due}. [tracker.csv row ${r.row}]`) };
    const moved = sec("What moved").filter((l) => !/\.xlsx: /.test(l)), due = sec("What is due");
    if (JSON.stringify(moved) !== JSON.stringify(want.moved)) problems.push(`archive_${w}_brief.md What moved does not follow its tracker`);
    if (JSON.stringify(due) !== JSON.stringify(want.due)) problems.push(`archive_${w}_brief.md What is due does not follow its tracker`);
    briefLines += moved.length + due.length;
  }
  check(c, "2 archive", problems.length === 0, problems.length ? problems.join("; ") : `200 files, 25 weeks of 8 kinds, flat; every tracker snapshot holds at least ${mixMin} open and ${mixMin} closed rows; ${briefLines} brief lines follow their week's tracker; archive hash ${listHash.slice(0, 16)}, the same in every folder so far`);

  const S6 = loadSources(six), SG = loadSources(grown);
  // 3. declined
  check(c, "3 declined", JSON.stringify(S6.declined) === JSON.stringify(SG.declined) && S6.weekEnding === SG.weekEnding && S6.latestRun === SG.latestRun,
    `six-file [${S6.declined.join(", ") || "none"}], grown [${SG.declined.join(", ") || "none"}]; week ending ${S6.weekEnding} and ${SG.weekEnding}; latest run ${S6.latestRun} and ${SG.latestRun}`);
  // 4. tracker dates
  const rows = S6.files["tracker.csv"].rows, tdiff = [], tsum = [];
  for (const r of rows) {
    const claim = { kind: "date", ref: `tracker.csv ${r.action_id}`, value: r.due };
    const a = checkClaim(claim, S6, { claims: [claim] }), b = checkClaim(claim, SG, { claims: [claim] });
    const ka = JSON.stringify([a.ok, a.reason || "", a.gate || "", a.detail || ""]), kb = JSON.stringify([b.ok, b.reason || "", b.gate || "", b.detail || ""]);
    if (ka !== kb) tdiff.push(`${r.action_id}: six-file ${a.ok ? "pass" : a.reason}; grown ${b.ok ? "pass" : b.reason}`);
    tsum.push(`${r.action_id} ${a.ok ? "pass" : a.gate || "fail"}`);
  }
  check(c, "4 tracker dates", tdiff.length === 0, tdiff.length ? tdiff.join("; ") : `${rows.length} rows the same in both: ${tsum.join(", ")}`);
  // 5. expected sentences through checkDraft
  const e = byCase[c], all = [...(e.sentences || []), ...(e.mock_extra || [])];
  const sections = Object.fromEntries(SECTIONS.map((k) => [k, all.filter((s) => s.section === k).map(({ text, claims }) => ({ text, claims }))]));
  const key = (s) => JSON.stringify([s.section, s.n, s.ok, s.reasons, s.gates]);
  const d6 = checkDraft(sections, S6), dG = checkDraft(sections, SG);
  const ediff = d6.filter((s, i) => key(s) !== key(dG[i])).map((s) => `[${s.section} ${s.n}] ${s.text}`);
  check(c, "5 expected", ediff.length === 0, ediff.length ? `differ: ${ediff.join("; ")}` : `${d6.length} sentences, ${d6.filter((s) => s.ok).length} pass and ${d6.filter((s) => !s.ok).length} fail in both${d6.some((s) => !s.ok) ? ` (the failing one is the planted trap: ${d6.filter((s) => !s.ok).map((s) => s.reasons[0]).join("; ")})` : ""}`);
  // 6. forbidden
  const found = [];
  const due = Object.fromEntries(rows.map((r) => [r.action_id, r.due]));
  for (const n of extra) {
    const lines = fs.readFileSync(path.join(grown, n), "utf8").replace(/\r/g, "").split("\n");
    lines.forEach((l, i) => {
      const at = `${n} line ${i + 1}`;
      if (/^(Decision needed:|Open question:)/.test(l)) found.push(`${at}: starts a source item`);
      else if (/decision needed:|open question:/i.test(l)) found.push(`${at}: carries a source item's words`);
      if (/\bconfidential\b/i.test(l)) found.push(`${at}: ${i === 0 ? "first line marked confidential" : "carries the word confidential"}`);
      if (n.endsWith(".md")) for (const id of new Set(l.match(ACTION_ID_RE) || [])) for (const d of findDates(l, 2026)) if (d.iso !== due[id]) found.push(`${at}: ${id} with ${d.raw}, its tracker due date is ${due[id]}`);
      const nums = (l.match(PAGE_NUM) || []).map((t) => Number(t.replace(/,/g, "")));
      for (const m of MUST_NOT_NUMBERS) if (nums.some((x) => sameNumber(x, m))) found.push(`${at}: must-not number ${m}`);
      for (const m of MUST_NOT_STRINGS) if (ci(l).includes(ci(m))) found.push(`${at}: must-not string "${m}"`);
      for (const r of rows) if (ci(l).includes(ci(r.action))) found.push(`${at}: the text of current action ${r.action_id}`);
    });
  }
  check(c, "6 forbidden", found.length === 0, found.length ? `${found.length} found: ${found.slice(0, 12).join("; ")}${found.length > 12 ? " ..." : ""}` : `nothing found in ${extra.length} archive files (${MUST_NOT_NUMBERS.length} must-not numbers, ${MUST_NOT_STRINGS.length} must-not strings of every case, ${rows.length} current action texts)`);
  // size
  results[c].size = { six: { bytes: dirBytes(six), ...readChars(six) }, grown: { bytes: dirBytes(grown), ...readChars(grown) } };
}

// ---------- check 7: the mock through the real server ----------
const STOP_TEXT = {   // the texts of eval/mock.js
  disagreement: "tracker.csv A005 is due 2026-11-04; project_note.md gives 6 November for the same action.",
  no_source: "No document this week carries a decision line and no source disagrees with another, so What needs a decision has nothing to cite.",
  arithmetic: "The project note asks for the Q3 returns rate; the answer blocks give orders and returns for Q3 and no block gives the rate.",
  confidential: "supplier_note.md is marked confidential on its first line and was declined.",
};
async function mockRun(base) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "work10-proof-"));
  const runs = {}, calls = {};
  try {
    for (const e of expected.cases) {
      const folder = e.rule === "only_new_document" ? e.case : e.based_on || e.case;
      const draftFrom = e.sentences ? e : byCase[e.based_on];
      const dir = path.join(tmp, e.case); fs.mkdirSync(dir);
      for (const f of fs.readdirSync(path.join(base, folder))) fs.copyFileSync(path.join(base, folder, f), path.join(dir, f));
      const mcp = new Client({ name: "work10-proof", version: "1.0.0" });
      await mcp.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, "server.js")], env: { ...process.env, SOURCED_BRIEF_DATA: dir, SOURCED_BRIEF_RUN_ID: "GPROOF" }, stderr: "ignore" }));
      const call = async (name, args) => { const r = await mcp.callTool({ name, arguments: args }); if (r.isError) throw new Error(`${e.case} ${name}: ${r.content[0].text}`); calls[e.case] = (calls[e.case] || 0) + 1; return JSON.parse(r.content[0].text); };
      await call("set_case", { case_id: e.case });
      const list = await call("list_sources", {});
      for (const s of list.sources.filter((x) => x.status === "READABLE")) await call("read_source", { file: s.file });
      if (e.gate) await call("stop", { reason: e.gate, text: STOP_TEXT[e.gate] });
      const all = [...draftFrom.sentences, ...(draftFrom.mock_extra || [])];
      await call("draft_brief", { sections: Object.fromEntries(SECTIONS.map((k) => [k, all.filter((s) => s.section === k).map(({ text, claims }) => ({ text, claims }))])) });
      await mcp.close();
      runs[e.case] = loadRun(dir);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const cases = checkAll(expected, runs);
  return { cases, verdict: verdict(cases), calls };
}
let mock = null;
if (!NO_MOCK) {
  const control = await mockRun(CASES), grown = await mockRun(GROWN);
  mock = { control: control.verdict, grown: grown.verdict };
  for (const c of FOLDERS) {
    const ids = expected.cases.filter((e) => (e.rule === "only_new_document" ? e.case : e.based_on || e.case) === c).map((e) => e.case);
    const ok = ids.every((id) => grown.cases[id].match);
    check(c, "7 mock", ok && grown.verdict.passed, ids.map((id) => { const g = grown.cases[id], s = control.cases[id]; return `${id} ${g.match ? "MATCH" : "MISS"}${g.facts_total ? ` ${g.facts_found}/${g.facts_total} facts` : ""}, ${g.removed} removed${g.gate ? `, gate ${g.gate} ${g.gate_held ? "held" : "NOT held"}` : ""}${g.wording_identical != null ? `, wording ${g.wording_identical ? "identical" : "differs"}` : ""} (six-file: ${s.match ? "MATCH" : "MISS"}), ${grown.calls[id]} tool calls${g.fails.length ? `; ${g.fails.join("; ")}` : ""}`; }).join(" | "));
  }
}

// ---------- report ----------
let failed = 0;
for (const c of FOLDERS) {
  console.log(`\n${c}`);
  for (const [name, r] of Object.entries(results[c])) {
    if (name === "size") continue;
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${name}: ${r.detail}`);
  }
  const z = results[c].size;
  console.log(`  size  six-file ${z.six.files} files, ${z.six.bytes} bytes, read_source ${z.six.chars} chars; grown ${z.grown.files} files, ${z.grown.bytes} bytes, read_source ${z.grown.chars} chars, list_sources ${z.grown.list_sources_chars} chars`);
}
if (mock) for (const [k, v] of Object.entries(mock)) console.log(`\nmock, ${k === "control" ? "six-file week (control)" : "grown week"}: ${v.cases_matched} of ${v.of_cases} cases, state ${v.state_matched} of ${v.of_state}, ${v.claims_verified} of ${v.of_claims} claims verified, ${v.unsourced_caught} removed, ${v.gates_held} of ${v.of_gates} gates held: ${v.passed ? "BAR MET" : "BAR NOT MET"}`);
console.log(`\n${failed ? `${failed} CHECKS FAILED` : "ALL CHECKS PASSED"} over ${FOLDERS.length} folders${NO_MOCK ? " (mock skipped)" : ""}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ folders: results, mock }, null, 2) + "\n");
process.exit(failed ? 1 : 0);
