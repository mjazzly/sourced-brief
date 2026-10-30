#!/usr/bin/env node
// The eval harness. One command writes every brief in the case set and records the result.
//
//   node eval/run_eval.js --model claude-opus-5-5 [--effort high] [--label name] [--max-calls 30]
//   node eval/run_eval.js --mock          (no API call: a scripted stand-in makes the known calls; never recorded)
//   node eval/run_eval.js --page-only     (rebuild EXEMPLAR.md from eval/results without running anything)
//   node eval/run_eval.js --only 02_disagreement --model ...   (one case, shows the calls; never recorded)
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
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadExpected, loadRun, checkAll, verdict } from "./check.js";
import { writePage } from "./page.js";
import { MockModel } from "./mock.js";

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

const skillText = fs.readFileSync(path.join(ROOT, "skill", "SKILL.md"), "utf8");
const skillBody = skillText.replace(/^---[\s\S]*?\n---\n/, "").trim();
const skillVersion = (/Version: (v[\d.]+)/.exec(skillText) || [])[1] || "unknown";
const serverVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

if (flag("page-only")) {
  console.log("page written:", writePage(path.join(EVAL, "results"), path.join(EVAL, "EXEMPLAR.md"), { version: skillVersion }));
  process.exit(0);
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
const RUN_ID = `B${local.slice(0, 16).replace(/[-:T]/g, "")}`;
const modelTag = MOCK ? "mock" : MODEL.replace(/^claude-/, "");
const LABEL = arg("label", `${RUN_ID}-${modelTag}${EFFORT ? "-" + EFFORT : ""}`);
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
const model = MOCK ? new MockModel() : new Anthropic({ apiKey: apiKey() });
const tokens = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
const transcript = [];
let calls = 0;

async function runUntilEnd(messages, budget) {
  while (true) {
    if (budget.calls >= MAX_CALLS) throw new Error(`stopped after ${MAX_CALLS} model calls on one brief`);
    budget.calls++; calls++;
    const req = { model: MODEL, max_tokens: 16000, system: skillBody, tools, messages };
    if (EFFORT) req.output_config = { effort: EFFORT };
    if (CACHE) req.cache_control = { type: "ephemeral" };
    const res = MOCK ? await model.create(req) : await model.messages.create(req);
    if (res.usage) {
      tokens.input += res.usage.input_tokens || 0; tokens.output += res.usage.output_tokens || 0;
      tokens.cache_read += res.usage.cache_read_input_tokens || 0; tokens.cache_write += res.usage.cache_creation_input_tokens || 0;
    }
    messages.push({ role: "assistant", content: res.content });
    for (const b of res.content) if (b.type === "text" && b.text.trim()) transcript.push({ who: "model", text: b.text });
    if (res.stop_reason !== "tool_use") return res.stop_reason;
    const results = [];
    for (const b of res.content.filter((x) => x.type === "tool_use")) {
      const out = await callTool(b.name, b.input);
      transcript.push({ who: "tool", name: b.name, input: b.name === "draft_brief" ? b.input : b.input, result: out.text.slice(0, 4000), is_error: out.isError });
      const status = (/"status": "(\w+)"/.exec(out.text) || [])[1];
      process.stdout.write(`    ${b.name}${b.input?.file ? " " + b.input.file : ""}${b.input?.reason ? " " + b.input.reason : ""}${status ? " (" + status + ")" : ""}${out.isError ? " (error: " + out.text.slice(7, 90) + ")" : ""}\n`);
      results.push({ type: "tool_result", tool_use_id: b.id, content: out.text, is_error: out.isError || undefined });
    }
    messages.push({ role: "user", content: results });
  }
}
async function say(messages, text, budget) { messages.push({ role: "user", content: text }); transcript.push({ who: "person", text }); return runUntilEnd(messages, budget); }

console.log(`run ${LABEL}: skill ${skillVersion}, server ${serverVersion}, model ${MODEL}${EFFORT ? ", effort " + EFFORT : ""}, ${todo.length} briefs`);
const runs = {};
let completed = true, error = null;
try {
  for (const b of todo) {
    const dataDir = path.join(runDir, b.id);
    fs.mkdirSync(dataDir, { recursive: true });
    const src = path.join(ROOT, "data", "cases", b.folder);
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dataDir, f));
    await startServer(dataDir);
    console.log(`  ${b.id}  ${b.expected.title}`);
    await callTool("set_case", { case_id: b.id });
    if (MOCK) model.setCase(b.expected.sentences ? b.expected : expected.cases.find((c) => c.case === b.expected.based_on), fs.readdirSync(src).filter((f) => !(b.expected.declined || []).includes(f)).sort());
    const messages = [], budget = { calls: 0 };
    transcript.push({ who: "harness", text: `brief ${b.id}` });
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
    await mcp.close();
    runs[b.id] = loadRun(dataDir);
    console.log(`    ${runs[b.id].released ? `released, ${runs[b.id].log.filter((l) => l.step === "unsourced").length} removed` : "NO PAGE RELEASED"}`);
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
  counted: !MOCK && !ONLY && completed, skill_version: skillVersion, server_version: serverVersion, model: MODEL, effort: EFFORT,
  briefs: BRIEFS, model_calls: calls, tokens, total_input: totalIn, cost_usd: cost, cost_per_brief_usd: cost == null ? null : cost / BRIEFS, cache: CACHE, completed, error, verdict: v, cases: checked,
  note: !completed ? `Did not finish: ${error}` : undefined };
fs.writeFileSync(path.join(runDir, "transcript.json"), JSON.stringify({ system: "skill/SKILL.md " + skillVersion, transcript }, null, 2));
fs.writeFileSync(path.join(runDir, "result.json"), JSON.stringify(record, null, 2));
if (!MOCK && !ONLY && !reachedModel) {
  console.log(`not recorded: the run never reached the model (${error || "no tokens"}). Details in ${runDir}`);
} else if (!MOCK && !ONLY) {
  fs.mkdirSync(path.join(EVAL, "results"), { recursive: true });
  fs.writeFileSync(path.join(EVAL, "results", `${LABEL}.json`), JSON.stringify(record, null, 2));
  console.log("page written:", writePage(path.join(EVAL, "results"), path.join(EVAL, "EXEMPLAR.md"), { version: skillVersion }));
} else {
  console.log(`${MOCK ? "mock" : "one case"} run: recorded in ${runDir} only; the exemplar page is not touched`);
}
process.exit(v.passed || ONLY ? 0 : 1);
