#!/usr/bin/env node
// The eval harness. One command writes every brief in the case set and records the result.
//
//   node eval/run_eval.js --model claude-opus-5-5 [--effort high] [--label name] [--max-calls 30]
//   node eval/run_eval.js --mock          (no API call: a scripted stand-in makes the known calls; never recorded)
//   node eval/run_eval.js --page-only     (rebuild EXEMPLAR.md from eval/results without running anything)
//   node eval/run_eval.js --only 02_disagreement --model ...   (one case, shows the calls; never recorded)
//
// WORK-09 (see WORK-09-DESIGN.md): with --arm, the same eight briefs run under one of three arms
// and are recorded in eval/results-arms/ with a trace per brief; eval/ARMS.md is rebuilt from them.
// Without --arm, the harness runs and records exactly as at v1.3.
//
//   node eval/run_eval.js --arm one|review|reviewer --model ... [--effort high]
//   node eval/run_eval.js --arm review --mock     (every arm has a mock; never recorded)
//   node eval/run_eval.js --arms-page             (rebuild ARMS.md from eval/results-arms)
//
// What a run does, for each of the eight briefs (six cases, then the clean week again for State B,
// then the clean week with one new document for State A):
//   1. Copies the case's week folder into an empty folder under eval/runs/<label>/<case>/ and starts
//      the real tool server (server.js) on it, as the desktop app does, over MCP.
//   2. Opens a fresh conversation: the skill (skill/SKILL.md) as the only instructions, the server's
//      tools (set_case kept back; the harness calls it itself), and the message "Write this week's
//      brief." When the model stops and the case has a fixed answer (eval/answers.txt), sends it.
//      If the model ends its turn without releasing a page, sends "Submit the brief now with
//      draft_brief." once.
//   3. Checks the released page, claims.csv, unsourced.md and run_log.csv against eval/expected/
//      (which the model cannot reach), writes eval/results/<label>.json and the transcript, and
//      rebuilds eval/EXEMPLAR.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadExpected, loadRun, checkAll, verdict } from "./check.js";
import { writePage } from "./page.js";
import { MockModel } from "./mock.js";
import { ARMS, REVIEWER_MAX_CALLS, RETURN_FINDINGS, armName, loadArm, checkCopies, readSections, readFindings, matchChanges, removedFrom, buildTrace } from "./arms.js";
import { writeArmsPage } from "./arms_page.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(here);
const EVAL = path.join(ROOT, "eval");

// ---------- arguments ----------
const argv = process.argv.slice(2);
const arg = (name, dflt = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(`--${name}`);
const MOCK = flag("mock");
const MODEL = MOCK ? "mock (scripted, no model)" : arg("model", "claude-opus-5-5");
const EFFORT = arg("effort");
const MAX_CALLS = Number(arg("max-calls", 30));   // per brief
const CACHE = !flag("no-cache");
const ONLY = arg("only");
const ARM = arg("arm");                           // null: the v1.3 path, unchanged
if (ARM != null && !ARMS.includes(ARM)) { console.error(`--arm must be one of ${ARMS.join(", ")}`); process.exit(2); }

const skillText = fs.readFileSync(path.join(ROOT, "skill", "SKILL.md"), "utf8");
const skillBody = skillText.replace(/^---[\s\S]*?\n---\n/, "").trim();
const skillVersion = (/Version: (v[\d.]+)/.exec(skillText) || [])[1] || "unknown";
const serverVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const ARMS_RESULTS = path.join(EVAL, "results-arms");
const ARMS_PAGE = path.join(EVAL, "ARMS.md");

if (flag("page-only")) {
  console.log("page written:", writePage(path.join(EVAL, "results"), path.join(EVAL, "EXEMPLAR.md"), { version: skillVersion }));
  process.exit(0);
}
if (flag("arms-page")) {
  console.log("page written:", writeArmsPage(ARMS_RESULTS, ARMS_PAGE, ROOT));
  process.exit(0);
}
// The arm: the drafter's instructions and any harness tools. Without --arm, the skill as it stands.
const A = ARM ? loadArm(ARM, ROOT, skillBody, skillVersion) : null;
const SYSTEM = A ? A.system : skillBody;
const VERSION = A ? A.skillVersion : skillVersion;
const ARM_LABEL = A ? armName(ARM, MOCK ? "mock" : MODEL, EFFORT) : null;
if (A && MOCK) {
  const fails = checkCopies(ROOT, skillBody, skillVersion);
  if (fails.length) { console.error("mock stopped before the first brief:\n  " + fails.join("\n  ")); process.exit(1); }
  console.log("arm words checked: the reviewer's copied tables match skill/SKILL.md; the checklist is carried whole in the A2 drafter, the B drafter and the B reviewer; the two drafters differ in step 5 and the tool bullet only");
}

function apiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile)) { const m = /^ANTHROPIC_API_KEY\s*=\s*"?([^"\n]+)"?/m.exec(fs.readFileSync(envFile, "utf8")); if (m) return m[1].trim(); }
  console.error("No API key. Put ANTHROPIC_API_KEY=... in .env in this folder (see .env.example), or set it in the environment.");
  process.exit(2);
}

// ---------- the run folder ----------
const now = new Date();
const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
const date = local.slice(0, 10);
const RUN_ID = `${A ? "W" : "B"}${local.slice(0, 16).replace(/[-:T]/g, "")}`;
const modelTag = MOCK ? "mock" : MODEL.replace(/^claude-/, "");
const LABEL = arg("label", A ? `${RUN_ID}-${ARM}-${modelTag}${EFFORT ? "-" + EFFORT : ""}` : `${RUN_ID}-${modelTag}${EFFORT ? "-" + EFFORT : ""}`);
const runDir = path.join(EVAL, MOCK || ONLY ? "runs-mock" : "runs", LABEL);
if (fs.existsSync(runDir)) { console.error(`${runDir} exists; pass --label or wait a minute`); process.exit(2); }
fs.mkdirSync(runDir, { recursive: true });

// ---------- the briefs ----------
const expected = loadExpected(path.join(EVAL, "expected"));
const briefs = expected.cases.map((e) => ({ id: e.case, source: e.based_on || e.case, folder: e.rule === "only_new_document" ? e.case : e.based_on || e.case, expected: e }));
const order = ["01_clean", "02_disagreement", "03_change", "04_gap", "05_inference", "06_confidential", "state_b", "state_a"];
briefs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const todo = ONLY ? briefs.filter((b) => b.id === ONLY) : briefs;
const answers = Object.fromEntries(fs.readFileSync(path.join(EVAL, "answers.txt"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

// ---------- the tool server ----------
let mcp, tools;
async function startServer(dataDir) {
  mcp = new Client({ name: "eval-harness", version: "1.0.0" });
  await mcp.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, "server.js")], env: { ...process.env, SOURCED_BRIEF_DATA: dataDir, SOURCED_BRIEF_RUN_ID: RUN_ID }, stderr: "ignore" }));
  tools = (await mcp.listTools()).tools.filter((t) => t.name !== "set_case").map((t) => { const { $schema, ...input_schema } = t.inputSchema; return { name: t.name, description: t.description, input_schema }; });
}
async function callTool(name, input) { const r = await mcp.callTool({ name, arguments: input }); return { text: r.content.map((c) => c.text || "").join("\n"), isError: !!r.isError }; }

// ---------- the model ----------
const model = MOCK ? new MockModel(ARM) : new Anthropic({ apiKey: apiKey() });
const tokens = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
const transcript = [];
let calls = 0;
const PRICES = (() => { try { return JSON.parse(fs.readFileSync(path.join(EVAL, "prices.json"), "utf8")); } catch { return {}; } })();
const callCost = (m, u) => { const p = PRICES[m]; if (!p || !u) return u ? null : 0; return ((u.input_tokens || 0) * p.input + (u.cache_creation_input_tokens || 0) * p.cache_write_5m + (u.cache_read_input_tokens || 0) * p.cache_read + (u.output_tokens || 0) * p.output) / 1e6; };
const byAgent = { drafter: { model_calls: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0 }, reviewer: { model_calls: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0 } };
const ok = (o) => ({ text: JSON.stringify(o, null, 2), isError: false });
const err = (msg) => ({ text: `error: ${msg}`, isError: true });
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// The brief being run: its trace steps, its review and its totals.
let brief = null;
const newBrief = () => ({ steps: [], review: { ran: false }, reviewCalls: 0, submitted: null, checker: null, t0: null, seconds: 0, totals: { calls: { drafter: 0, reviewer: 0 }, tokens_in: 0, tokens_out: 0, cost_usd: 0 } });
const at = () => (brief?.t0 == null ? 0 : round((performance.now() - brief.t0) / 1000, 2));
const step = (s) => { if (!brief) return s; s.n = brief.steps.length + 1; brief.steps.push(s); return s; };

// One agent's loop: model call, tool calls, until it ends its turn. The drafter's loop with no
// --arm is the v1.3 loop: same request, same tools, same transcript lines.
async function runAgent(ctx, messages) {
  while (true) {
    if (ctx.budget.calls >= ctx.maxCalls) { const e = new Error(ctx.agent === "drafter" ? `stopped after ${ctx.maxCalls} model calls on one brief` : `the reviewer reached its cap of ${ctx.maxCalls} model calls`); e.cap = true; throw e; }
    ctx.budget.calls++; calls++;
    const req = { model: MODEL, max_tokens: 16000, system: ctx.system, tools: ctx.tools, messages };
    if (ctx.effort) req.output_config = { effort: ctx.effort };
    if (CACHE) req.cache_control = { type: "ephemeral" };
    const t0 = performance.now(), atStart = at();
    const res = MOCK ? await model.create(req, ctx.agent) : await model.messages.create(req);
    const u = res.usage;
    if (u) {
      tokens.input += u.input_tokens || 0; tokens.output += u.output_tokens || 0;
      tokens.cache_read += u.cache_read_input_tokens || 0; tokens.cache_write += u.cache_creation_input_tokens || 0;
    }
    const tin = u ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0, tout = u?.output_tokens || 0, cost = callCost(MODEL, u);
    const ag = byAgent[ctx.agent]; ag.model_calls++; ag.tokens_in += tin; ag.tokens_out += tout; if (cost != null) ag.cost_usd += cost;
    if (brief) { brief.totals.calls[ctx.agent]++; brief.totals.tokens_in += tin; brief.totals.tokens_out += tout; if (cost != null) brief.totals.cost_usd += cost; }
    const words = res.content.filter((b) => b.type === "text" && b.text.trim()).map((b) => b.text).join("\n\n");
    step({ agent: ctx.agent, type: "model_call", at_s: atStart, seconds: round((performance.now() - t0) / 1000), tokens: { in: tin, out: tout, cache_read: u?.cache_read_input_tokens || 0, cache_write: u?.cache_creation_input_tokens || 0 }, cost_usd: cost == null ? null : round(cost, 6), stop_reason: res.stop_reason, text: words || null, tool_calls: res.content.filter((b) => b.type === "tool_use").map((b) => b.name) });
    messages.push({ role: "assistant", content: res.content });
    for (const b of res.content) if (b.type === "text" && b.text.trim()) transcript.push(ctx.agent === "drafter" ? { who: "model", text: b.text } : { who: ctx.agent, text: b.text });
    if (res.stop_reason !== "tool_use") return res.stop_reason;
    const results = [];
    let ended = false;
    for (const b of res.content.filter((x) => x.type === "tool_use")) {
      const s = step({ agent: ctx.agent, type: "tool", tool: b.name, input: b.input, at_s: at() });
      const t1 = performance.now();
      const allowed = !ctx.guard || ctx.tools.some((t) => t.name === b.name);
      const out = !allowed ? err(`${b.name} is not a tool here`) : ctx.handlers?.[b.name] ? await ctx.handlers[b.name](b.input, s) : await callTool(b.name, b.input);
      s.result = out.text; s.is_error = out.isError; s.seconds = round((performance.now() - t1) / 1000);
      if (b.name === "draft_brief" && !out.isError && brief && !brief.checker) {
        const r = removedFrom(out.text);
        if (r && r.released != null) { brief.checker = r; brief.submitted = readSections(b.input?.sections).sections || null; }
      }
      transcript.push(ctx.agent === "drafter" ? { who: "tool", name: b.name, input: b.name === "draft_brief" ? b.input : b.input, result: out.text.slice(0, 4000), is_error: out.isError } : { who: "tool", agent: ctx.agent, name: b.name, input: b.input, result: out.text.slice(0, 4000), is_error: out.isError });
      const status = (/"status": "(\w+)"/.exec(out.text) || [])[1];
      process.stdout.write(`    ${ctx.agent === "drafter" ? "" : ctx.agent + ": "}${b.name}${b.input?.file ? " " + b.input.file : ""}${b.input?.reason ? " " + b.input.reason : ""}${status ? " (" + status + ")" : ""}${out.isError ? " (error: " + out.text.slice(7, 90) + ")" : ""}\n`);
      results.push({ type: "tool_result", tool_use_id: b.id, content: out.text, is_error: out.isError || undefined });
      if (out.end) ended = true;
    }
    messages.push({ role: "user", content: results });
    if (ended) return "returned";
  }
}

// ---------- the harness tools of the arms ----------
function reviewClosed(name) {
  if (brief.reviewCalls) return `${name} takes one call per brief`;
  if (brief.checker) return `the brief is released; ${name} comes before draft_brief`;
  return null;
}
const drafterHandlers = {
  // A2: the drafter's own review, put on the record. Checks nothing.
  record_review: async (input) => {
    const closed = reviewClosed("record_review"); if (closed) return err(closed);
    const s = readSections(input?.sections); if (s.error) return err(s.error);
    const f = readFindings(input?.findings); if (f.error) return err(f.error);
    brief.reviewCalls++;
    brief.review = { ran: true, status: "RECORDED", draft_before: s.sections, findings: f.findings };
    return ok({ status: "RECORDED", findings: f.findings.length, next: "Make the changes you decided on, then call draft_brief once." });
  },
  // B: a reviewer agent in a fresh conversation, with the two read tools and return_findings.
  review_draft: async (input, s) => {
    const closed = reviewClosed("review_draft"); if (closed) return err(closed);
    const d = readSections(input?.sections); if (d.error) return err(d.error);
    brief.reviewCalls++; s.opens_review = 1;
    let returned = null, reason = null;
    const rctx = { agent: "reviewer", system: A.reviewerSystem, effort: null, guard: true, budget: { calls: 0 }, maxCalls: REVIEWER_MAX_CALLS,
      tools: [...tools.filter((t) => t.name === "list_sources" || t.name === "read_source"), RETURN_FINDINGS],
      handlers: { return_findings: async (inp) => { if (returned) return err("return_findings takes one call"); const f = readFindings(inp?.findings); if (f.error) return err(f.error); returned = f.findings; return { ...ok({ status: "RETURNED", findings: returned.length }), end: true }; } } };
    const opening = `Review this draft.\n\n${JSON.stringify(d.sections, null, 2)}`;
    step({ agent: "harness", type: "message", to: "reviewer", text: opening, at_s: at() });
    transcript.push({ who: "harness", text: "review_draft: a reviewer opened in a fresh conversation" });
    try { const end = await runAgent(rctx, [{ role: "user", content: opening }]); if (!returned) reason = `the reviewer ended its turn (${end}) without return_findings`; }
    catch (e) { if (!e.cap) throw e; reason = `the reviewer reached its cap of ${REVIEWER_MAX_CALLS} model calls without return_findings`; }
    if (returned) {
      brief.review = { ran: true, status: "FINDINGS", draft_before: d.sections, findings: returned, reviewer_calls: rctx.budget.calls };
      return ok({ status: "FINDINGS", findings: returned.map(({ id, ...f }) => f) });
    }
    brief.review = { ran: false, status: "NO_REVIEW", reason, draft_before: d.sections, findings: [], reviewer_calls: rctx.budget.calls };
    return ok({ status: "NO_REVIEW", reason });
  },
};

let drafter;
async function say(messages, text, budget) {
  messages.push({ role: "user", content: text }); transcript.push({ who: "person", text });
  step({ agent: "harness", type: "message", to: "drafter", text, at_s: at() });
  return runAgent({ ...drafter, budget }, messages);
}

console.log(`run ${LABEL}: skill ${VERSION}, server ${serverVersion}, model ${MODEL}${EFFORT ? ", effort " + EFFORT : ""}${A ? `, arm ${ARM} (${ARM_LABEL})` : ""}, ${todo.length} briefs`);
const runs = {}, traces = {};
let completed = true, error = null;
try {
  for (const b of todo) {
    const dataDir = path.join(runDir, b.id);
    fs.mkdirSync(dataDir, { recursive: true });
    const src = path.join(ROOT, "data", "cases", b.folder);
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dataDir, f));
    await startServer(dataDir);
    drafter = { agent: "drafter", system: SYSTEM, effort: EFFORT, guard: !!A, maxCalls: MAX_CALLS, tools: A ? [...tools, ...A.drafterTools] : tools, handlers: A ? Object.fromEntries(A.drafterTools.map((t) => [t.name, drafterHandlers[t.name]])) : null };
    console.log(`  ${b.id}  ${b.expected.title}`);
    await callTool("set_case", { case_id: b.id });
    if (MOCK) model.setCase(b.expected.sentences ? b.expected : expected.cases.find((c) => c.case === b.expected.based_on), fs.readdirSync(src).filter((f) => !(b.expected.declined || []).includes(f)).sort());
    const messages = [], budget = { calls: 0 };
    brief = newBrief(); traces[b.id] = brief;
    transcript.push({ who: "harness", text: `brief ${b.id}` });
    brief.t0 = performance.now();
    try {
      await say(messages, "Write this week's brief.", budget);
      const stopped = () => loadRun(dataDir).log.some((l) => l.step === "stop");
      if (answers[b.id] && stopped() && !loadRun(dataDir).released) {
        console.log(`    (stopped; sending the fixed answer: ${answers[b.id]})`);
        await say(messages, answers[b.id], budget);
      }
      if (!loadRun(dataDir).released) {
        console.log("    (no page released; asking once for the draft)");
        await say(messages, "Submit the brief now with draft_brief.", budget);
      }
    } finally { brief.seconds = (performance.now() - brief.t0) / 1000; }
    if (A && ARM !== "one" && !brief.review.ran && !brief.review.status) brief.review = { ran: false, status: "SKIPPED", findings: [] };
    if (brief.review.draft_before && brief.submitted) brief.review.changes = matchChanges(brief.review.draft_before, brief.submitted, brief.review.findings);
    await mcp.close();
    runs[b.id] = loadRun(dataDir);
    console.log(`    ${runs[b.id].released ? `released, ${runs[b.id].log.filter((l) => l.step === "unsourced").length} removed` : "NO PAGE RELEASED"}${A ? `; ${round(brief.seconds, 1)} s${ARM !== "one" ? `; review ${brief.review.status}${brief.review.findings ? `, ${brief.review.findings.length} findings` : ""}${brief.review.changes ? `, ${brief.review.changes.filter((c) => c.change !== "kept").length} sentences changed` : ""}` : ""}` : ""}`);
  }
} catch (e) {
  completed = false; error = String(e.message || e);
  console.error("run did not finish:", error);
  try { await mcp.close(); } catch {}
}

// ---------- check and record ----------
const checked = checkAll(expected, runs);
if (ONLY) for (const id of Object.keys(checked)) if (id !== ONLY) delete checked[id];
const v = verdict(checked);
const totalIn = tokens.input + tokens.cache_read + tokens.cache_write;
const reachedModel = MOCK || totalIn + tokens.output > 0;
if (reachedModel) {
  for (const c of Object.values(checked)) console.log(`${c.match ? "MATCH" : "MISS "} ${c.name}${c.facts_total ? ` (${c.facts_found} of ${c.facts_total} facts)` : ""}${c.fails.length ? "\n        " + c.fails.join("\n        ") : ""}`);
  if (!ONLY) console.log(`\n${v.cases_matched} of ${v.of_cases} cases, state ${v.state_matched} of ${v.of_state}, ${v.claims_verified} of ${v.of_claims} claims verified, ${v.unsourced_caught} sentences removed, ${v.gates_held} of ${v.of_gates} gates held${v.wording_identical != null ? `, State B wording ${v.wording_identical ? "identical" : "differs"}` : ""}: ${v.passed ? "BAR MET" : "BAR NOT MET"}`);
}
let cost = null;
try {
  const prices = JSON.parse(fs.readFileSync(path.join(EVAL, "prices.json"), "utf8"))[MODEL];
  if (prices) cost = (tokens.input * prices.input + tokens.cache_write * prices.cache_write_5m + tokens.cache_read * prices.cache_read + tokens.output * prices.output) / 1e6;
} catch {}
const BRIEFS = briefs.length;
console.log(`model calls ${calls}; input ${totalIn} (fresh ${tokens.input}, cache write ${tokens.cache_write}, cache read ${tokens.cache_read}), output ${tokens.output}${cost != null ? `; cost US$${cost.toFixed(3)} (US$${(cost / BRIEFS).toFixed(4)} a brief)` : ""}${CACHE ? "; caching on" : "; caching off"}`);

const record = { label: LABEL, run_id: RUN_ID, date, started_at: local, mode: MOCK ? "mock" : ONLY ? "one case" : "harness", blind: true,
  counted: !MOCK && !ONLY && completed, skill_version: VERSION, server_version: serverVersion, model: MODEL, effort: EFFORT,
  briefs: BRIEFS, model_calls: calls, tokens, total_input: totalIn, cost_usd: cost, cost_per_brief_usd: cost == null ? null : cost / BRIEFS, cache: CACHE, completed, error, verdict: v, cases: checked,
  note: !completed ? `Did not finish: ${error}` : undefined };
if (A) {
  const secs = Object.fromEntries(Object.entries(traces).map(([id, t]) => [id, round(t.seconds, 1)]));
  const total = Object.values(traces).reduce((n, t) => n + t.seconds, 0);
  Object.assign(record, {
    work: "WORK-09", arm: ARM, arm_name: ARM_LABEL, drafter_model: MODEL, reviewer_model: ARM === "reviewer" ? MODEL : null,
    checklist_sha: A.checklistSha, reviewer_sha: A.reviewerSha, max_calls: MAX_CALLS, reviewer_max_calls: ARM === "reviewer" ? REVIEWER_MAX_CALLS : null,
    by_agent: Object.fromEntries(Object.entries(byAgent).filter(([k]) => k === "drafter" || ARM === "reviewer").map(([k, x]) => [k, { ...x, cost_usd: PRICES[MODEL] ? round(x.cost_usd, 6) : null }])),
    seconds: round(total, 1), seconds_per_brief: round(total / BRIEFS, 1), seconds_by_brief: secs,
    review: ARM === "one" ? null : Object.fromEntries(Object.entries(traces).map(([id, t]) => [id, {
      ran: t.review.ran, status: t.review.status, reason: t.review.reason, reviewer_calls: t.review.reviewer_calls,
      findings: (t.review.findings || []).map((f) => ({ id: f.id, section: f.section, sentence: f.sentence, fault: f.fault, fix: f.fix, outcome: f.outcome })),
      sentences_changed: (t.review.changes || []).filter((c) => c.change !== "kept").length,
    }])),
    removed: Object.fromEntries(Object.entries(traces).map(([id, t]) => [id, t.checker?.removed || []])),
  });
}
fs.writeFileSync(path.join(runDir, "transcript.json"), JSON.stringify({ system: (A ? `skill/SKILL.md built for arm ${ARM} ` : "skill/SKILL.md ") + VERSION, transcript }, null, 2));
fs.writeFileSync(path.join(runDir, "result.json"), JSON.stringify(record, null, 2));
const writeTraces = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  for (const [id, t] of Object.entries(traces)) {
    const e = expected.cases.find((c) => c.case === id);
    fs.writeFileSync(path.join(dir, `${id}.trace.json`), JSON.stringify(buildTrace({ label: LABEL, arm: ARM, armLabel: ARM_LABEL, caseId: id, title: e?.title, drafterModel: MODEL, reviewerModel: ARM === "reviewer" ? MODEL : null, drafterVersion: VERSION, reviewerSha: A.reviewerSha, brief: t, result: checked[id], page: runs[id]?.page }), null, 2));
  }
  return dir;
};
if (!MOCK && !ONLY && !reachedModel) {
  console.log(`not recorded: the run never reached the model (${error || "no tokens"}). Details in ${runDir}`);
} else if (A && !MOCK && !ONLY) {
  fs.mkdirSync(ARMS_RESULTS, { recursive: true });
  fs.writeFileSync(path.join(ARMS_RESULTS, `${LABEL}.json`), JSON.stringify(record, null, 2));
  console.log("traces written:", writeTraces(path.join(ARMS_RESULTS, LABEL)));
  console.log("page written:", writeArmsPage(ARMS_RESULTS, ARMS_PAGE, ROOT));
} else if (!MOCK && !ONLY) {
  fs.mkdirSync(path.join(EVAL, "results"), { recursive: true });
  fs.writeFileSync(path.join(EVAL, "results", `${LABEL}.json`), JSON.stringify(record, null, 2));
  console.log("page written:", writePage(path.join(EVAL, "results"), path.join(EVAL, "EXEMPLAR.md"), { version: skillVersion }));
} else {
  if (A) console.log("traces written:", writeTraces(path.join(runDir, "traces")));
  console.log(`${MOCK ? "mock" : "one case"} run: recorded in ${runDir} only; ${A ? "ARMS.md and the arms records are" : "the exemplar page is"} not touched`);
}
process.exit(v.passed || ONLY ? 0 : 1);
