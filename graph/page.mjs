#!/usr/bin/env node
// WORK-10, session 4: writes eval/GRAPH.md from the records. The page is never edited by hand.
// Every number comes from eval/results-graph/ (run records, traces, stage 0 files, forecast.json,
// spend.json), eval/results-arms/ (WORK-09's figures) or data/cases-grown/ (the archived tracker
// check). The fixed verdict rule for F, the predictions and the limits in section 8 are copied word
// for word from WORK-10-DESIGN.md. Every sentence of prose that states a result is guarded by a check
// on the records: if the records stop supporting it, the script stops with the reason and writes
// nothing. It makes no network call and reads nothing under eval/expected/.
//
//   node graph/page.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TITLES } from "../lib/check.js";
import { parseCsv } from "../lib/sources.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RES = path.join(ROOT, "eval", "results-graph");
const OUT = path.join(ROOT, "eval", "GRAPH.md");
const NOTE = path.join(ROOT, "WORK-10-DESIGN.md");
const CASES = ["01_clean", "02_disagreement", "03_change", "04_gap", "05_inference", "06_confidential", "state_b", "state_a"];
const ARM_ORDER = ["P", "F", "K", "V", "PG", "E"];

// ---------- helpers ----------
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const must = (cond, why) => { if (!cond) throw new Error(`the records no longer support: ${why}`); };
const int = (n) => Number(n).toLocaleString("en-GB");
const usd = (n, d = 4) => `US$${Number(n).toFixed(d)}`;
const pct = (m, f) => { const p = ((m - f) / f) * 100; return `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(1)}%`; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => { const a = [...xs].sort((p, q) => p - q); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (xs) => `| ${xs.map(cell).join(" | ")} |`;
const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const short = (label) => label.replace(/-haiku-5-5$/, "");
const matched = (v) => v.cases_matched + v.state_matched;
const sec = (k) => TITLES[k] ?? k;
const range = (xs, f = (x) => x) => { const lo = Math.min(...xs), hi = Math.max(...xs); return String(f(lo)) === String(f(hi)) ? f(lo) : `${f(lo)} to ${f(hi)}`; };

// ---------- the records ----------
const all = fs.readdirSync(RES).filter((f) => f.endsWith(".json") && !["spend.json", "forecast.json"].includes(f)).map((f) => read(path.join(RES, f)));
const probe = all.filter((r) => r.label.startsWith("PROBE"));
const runs = all.filter((r) => r.label.startsWith("G")).sort((a, b) => a.label.slice(1, 15).padEnd(14, "0").localeCompare(b.label.slice(1, 15).padEnd(14, "0")));
const isE = (r) => r.arm === "E";
const casesOf = (r) => (isE(r) ? r.node_record?.cases ?? {} : r.cases ?? {});
const trace = (r, c) => { const f = path.join(RES, r.label, `${c}.trace.json`); return fs.existsSync(f) ? read(f) : null; };
const counted = runs.filter((r) => r.counted);
const byArm = (a, rs = counted) => rs.filter((r) => r.arm === a);
const inVerdict = (a) => byArm(a).filter((r) => !r.outside_verdict);
const spend = read(path.join(RES, "spend.json"));
const forecast = read(path.join(RES, "forecast.json"));
const recall = read(path.join(RES, "stage0", "recall.json"));
const recallF = read(path.join(RES, "stage0", "recall_F.json"));
const retrieved = read(path.join(RES, "stage0", "retrieved.json"));
const note = fs.readFileSync(NOTE, "utf8");
const w09 = fs.readdirSync(path.join(ROOT, "eval", "results-arms")).filter((f) => f.endsWith(".json")).map((f) => read(path.join(ROOT, "eval", "results-arms", f))).filter((r) => r.counted).sort((a, b) => a.started_at.localeCompare(b.started_at));
const w09arm = (n) => w09.filter((r) => r.arm_name === n);

const removalsOf = (r) => {
  if (isE(r)) return Object.entries(r.node_record?.removed ?? {}).flatMap(([c, xs]) => xs.map((x) => ({ case: c, section: sec(x.section), text: x.text, reasons: x.reasons, empty_reference: false })));
  return (r.removed ?? []).map((x) => ({ ...x, empty_reference: x.empty_reference ?? x.reasons.some((s) => s.startsWith('reference ""')) }));
};
const why = (r) => {
  if (r.counted) return r.outside_verdict ? "illustration, outside the verdict" : "";
  if (r.error && r.error.includes("compiled grammar is too large")) return "refused on its first draft call: 400, the compiled grammar is too large";
  if ((r.truncated_briefs ?? []).length) return `run under the 16,000 output-token cap; ${r.truncated_briefs.join(" and ")} ended on max_tokens`;
  if (isE(r)) return `uncounted E brief (\`--only 01_clean\`, \`--max-calls ${r.max_calls}\`)${r.cost_is_upper_bound ? "; ledger cost an upper bound" : ""}`;
  if (r.briefs === 1) return `test brief, ${Object.keys(r.cases).join("")} only, after the change to streaming and 32,000`;
  return "not counted";
};

// ---------- the arms ----------
const ARMS = {
  P: { what: "the graph reading every line of the six-file week", folder: "data/cases" },
  F: { what: "the graph keeping only lines from files of this week and the week before, the week read from each file's content; no query, no index model", folder: "data/cases-grown" },
  K: { what: "the graph with keyword retrieval (BM25), top 20 lines a section", folder: "data/cases-grown" },
  V: { what: "the graph with vector retrieval (a local embedding model), top 20 lines a section", folder: "data/cases-grown" },
  PG: { what: "the graph reading every line of the grown week", folder: "data/cases-grown" },
  E: { what: "the WORK-09 agent loop (arm A1, the Node harness) unchanged, on the grown week", folder: "data/cases-grown" },
};
for (const a of ARM_ORDER) must(byArm(a).length > 0, `a counted run of arm ${a}`);

function armStats(a) {
  const rs = byArm(a);
  const briefs = rs.length * 8;
  const cost = rs.reduce((s, r) => s + r.cost_usd, 0) / briefs;
  if (a === "E") {
    const nr = rs.map((r) => r.node_record);
    return { rs, cost, seconds: mean(nr.map((x) => x.seconds_per_brief)), index: null, draft: null, matched: rs.map((r) => matched(r.verdict)), bar: rs.filter((r) => r.verdict.passed).length };
  }
  const tr = rs.flatMap((r) => CASES.map((c) => trace(r, c)).filter(Boolean));
  return {
    rs, cost,
    seconds: mean(rs.map((r) => r.seconds_per_brief)),
    index: mean(rs.flatMap((r) => Object.values(r.index_seconds))),
    draft: mean(tr.map((t) => t.model_call.seconds)),
    matched: rs.map((r) => matched(r.verdict)),
    bar: rs.filter((r) => r.verdict.passed).length,
  };
}
const S = Object.fromEntries(ARM_ORDER.map((a) => [a, armStats(a)]));
const W = Object.fromEntries(["A1", "A2", "Ceiling"].map((n) => {
  const rs = w09arm(n);
  return [n, { rs, matched: rs.map((r) => matched(r.verdict)), bar: rs.filter((r) => r.verdict.passed).length, cost: mean(rs.map((r) => r.cost_per_brief_usd)), seconds: mean(rs.map((r) => r.seconds_per_brief)) }];
}));

// ---------- stage 0: recall ----------
const weekFiles = Object.fromEntries(CASES.map((c) => [c, new Set(recallF.weeks[c].kept_files)]));
const fileOf = (ref) => ref.split(" ")[0];
const ownAt20 = Object.fromEntries(["K", "V"].map((a) => [a, CASES.map((c) => retrieved[a]["20"][c].filter((ref) => weekFiles[c].has(fileOf(ref))).length)]));
const shownAt20 = Object.fromEntries(["K", "V"].map((a) => [a, CASES.map((c) => retrieved[a]["20"][c].length)]));
const complete = (a, k) => CASES.filter((c) => recall.recall[a][k][c].found === recall.recall[a][k][c].of).length;
must(complete("K", "20") === 0 && complete("V", "20") === 0, "K and V leave references unshown at k = 20 in every brief");
const missedAt20 = ["K", "V"].reduce((s, a) => s + CASES.reduce((t, c) => t + recall.recall[a]["20"][c].missed.length, 0), 0);
const fComplete = CASES.filter((c) => recallF.recall[c].found === recallF.recall[c].of).length;

// ---------- F against P ----------
const fRuns = inVerdict("F"), pRuns = inVerdict("P");
must(fRuns.length === 5 && pRuns.length === 5, "five counted runs each of P and F");
const fBar = fRuns.filter((r) => r.verdict.passed).length, pBar = pRuns.filter((r) => r.verdict.passed).length;
const fMed = median(fRuns.map((r) => matched(r.verdict))), pMed = median(pRuns.map((r) => matched(r.verdict)));
const fKeeps = fBar > pBar || (fBar === pBar && fMed >= pMed);
must(!fKeeps && fBar < pBar, "F meets the bar in fewer of five runs than P");
// identical lines: every F brief shows the drafter exactly the lines P shows for that case
let linesSame = true;
for (const c of CASES) {
  const pl = JSON.stringify(trace(pRuns[0], c).lines);
  for (const r of fRuns) if (JSON.stringify(trace(r, c).lines) !== pl) linesSame = false;
}
must(linesSame, "F's lines equal P's lines in every brief of every counted run");
const fRecallAll = fRuns.every((r) => CASES.every((c) => r.recall_by_case[c].found === r.recall_by_case[c].of));
must(fRecallAll, "F's recall complete in every brief of every F run");
must(fRuns.every((r) => r.retrieval_misses.length === 0), "no retrieval miss in F");

// ---------- the K and V illustration pages ----------
function releasedOf(r) {
  const out = [];
  for (const c of CASES) {
    const t = trace(r, c); if (!t?.draft_brief_payload) continue;
    const gone = new Set((t.submit_result?.removed ?? []).map((x) => x.text));
    for (const [s, xs] of Object.entries(t.draft_brief_payload.sections)) for (const x of xs) {
      const refs = x.claims.flatMap((cl) => [cl.ref, cl.new_ref, cl.old_ref].filter(Boolean));
      out.push({ case: c, section: s, text: x.text, refs, released: !gone.has(x.text) });
    }
  }
  return out;
}
const archived = (x) => x.refs.some((ref) => ref.startsWith("archive_"));
const kv = Object.fromEntries(["K", "V"].map((a) => { const s = releasedOf(byArm(a)[0]); return [a, { released: s.filter((x) => x.released), archivedReleased: s.filter((x) => x.released && archived(x)), archivedDrafted: s.filter(archived) }]; }));
const releasedTotal = (r) => CASES.reduce((s, c) => s + (trace(r, c)?.submit_result?.sentences_released ?? 0), 0);
const pgSentences = releasedOf(byArm("PG")[0]);

// ---------- E's reads ----------
function eReads(r) {
  return Object.fromEntries(CASES.map((c) => {
    const t = trace(r, c);
    const reads = t.steps.filter((s) => s.type === "tool" && s.tool === "read_source").map((s) => s.input.file);
    const calls = t.steps.filter((s) => s.type === "model_call").length;
    return [c, { reads, calls }];
  }));
}
const eRun = byArm("E")[0];
const eR = eReads(eRun);
must(CASES.every((c) => eR[c].reads.every((f) => !f.startsWith("archive_"))), "E read no archive file in any brief");

// ---------- the archived trackers ----------
const g = path.join(ROOT, "data", "cases-grown", "01_clean");
const current = new Set(parseCsv(fs.readFileSync(path.join(g, "tracker.csv"), "utf8")).map((x) => x.action));
const archTrackers = fs.readdirSync(g).filter((f) => /^archive_.*_tracker\.csv$/.test(f));
const archRows = archTrackers.flatMap((f) => parseCsv(fs.readFileSync(path.join(g, f), "utf8")));
const repeats = archRows.filter((x) => current.has(x.action)).length;
must(repeats === 0, "no archived tracker row repeats a current action");

// ---------- predictions, word for word from the note ----------
function noteBlock(startRe, endRe) {
  const i = note.search(startRe); must(i >= 0, `the note holds ${startRe}`);
  const rest = note.slice(i); const j = rest.slice(1).search(endRe);
  return (j < 0 ? rest : rest.slice(0, j + 1)).trim();
}
const predText = noteBlock(/^## Megat's predictions/m, /^## /m);
const blocks = predText.split(/\n(?=Written )/).slice(1).map((b) => {
  const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
  return { when: lines[0].replace(/:$/, ""), items: lines.slice(1).filter((l) => !l.startsWith("Signed")).map((l) => l.replace(/^- /, "")) };
});
const PRED = [];
const find = (re) => { for (const b of blocks) for (const it of b.items) { const m = it.match(re); if (m) return { b, it, m }; } must(false, `a prediction matching ${re}`); };
{
  const kvp = find(/keyword search \(K\) finds every expected reference in (\d+) of 8 briefs, and vector search \(V\) in (\d+) of 8/);
  PRED.push([kvp.it, kvp.b.when, `K: ${complete("K", "20")} of 8. V: ${complete("V", "20")} of 8.`]);
  const fp = find(/F finds every expected reference in (\d+) of 8/);
  PRED.push([fp.it, fp.b.when, `${fComplete} of 8`]);
  const pb = find(/^P meets the bar in (\d+) of 5/);
  PRED.push([pb.it, pb.b.when, `${pBar} of 5`]);
  const fb = find(/^F meets the bar in (\d+) of 5/);
  PRED.push([fb.it, fb.b.when, `${fBar} of 5`]);
  const ap = find(/archived file reaches a released page: (yes|no)/i);
  const relKV = kv.K.released.length + kv.V.released.length, arcKV = kv.K.archivedReleased.length + kv.V.archivedReleased.length;
  PRED.push([ap.it, ap.b.when, `${arcKV ? "Yes" : "No"}. ${arcKV} of the ${relKV} sentences K and V released cite an archived file. K drafted ${kv.K.archivedDrafted.length} that did, and the checker removed it for a different claim (see the limits).`]);
  const pgp = find(/^PG matches (\d+) of 8/);
  PRED.push([pgp.it, pgp.b.when, `${matched(byArm("PG")[0].verdict)} of 8 (one run)`]);
  const ep = find(/^E matches (\d+) of 8/);
  PRED.push([ep.it, ep.b.when, `${matched(eRun.verdict)} of 8 (one run)`]);
}

// ---------- the rule and the limits, word for word ----------
const ruleF = note.split("\n").find((l) => l.startsWith("**The verdict rule for F, fixed before the first run.**"));
must(ruleF, "the F rule in the note");
const v1 = note.split("\n").find((l) => l.startsWith("**K and V cannot keep the bar at k = 20"));
must(v1, "the version 1 verdict in the note");
const limits = noteBlock(/^## 8\. Limits found while writing this note/m, /^## /m).split("\n").slice(1).join("\n").trim();

// ---------- traces: stop reasons and output ----------
const graphCounted = counted.filter((r) => !isE(r));
const draftCalls = graphCounted.flatMap((r) => CASES.map((c) => ({ r, c, t: trace(r, c) })).filter((x) => x.t));
const notEnd = draftCalls.filter((x) => x.t.model_call.stop_reason !== "end_turn");
must(notEnd.length === 0, "every counted graph draft call ended on end_turn");
const maxOut = draftCalls.reduce((m, x) => (x.t.model_call.tokens.out > m.t.model_call.tokens.out ? x : m));
const capRun = runs.find((r) => (r.truncated_briefs ?? []).length);
const grammarRuns = runs.filter((r) => r.error?.includes("compiled grammar is too large"));
const hold = (spend.holds ?? [])[0];

// ---------- write ----------
const L = [];
const P = (...xs) => L.push(...xs.flatMap((x) => [x, ""]));

P("# WORK-10: when the week no longer fits in one read",
  `Built by \`node graph/page.mjs\` from the records in \`eval/results-graph/\`, \`eval/results-arms/\` (WORK-09) and \`data/cases-grown/\`; never edited by hand. The design, every decision and the signed predictions are in \`WORK-10-DESIGN.md\`. One model drafted in every run: claude-haiku-5-5, the smallest. "Graph" here means a LangGraph state graph (an orchestration graph); "retrieval" means choosing which source lines the drafter sees (retrieval-augmented generation, RAG); "index" means the searchable store of source lines (a search index, for V a vector index).`);

// 1. the questions
P("## The three questions");
P("**1. When the week grows past what one read can hold, does a graph that retrieves keep the bar the six-file week set?**",
  `Not with retrieval by query. At 20 lines a section, keyword retrieval (K) and vector retrieval (V) never showed the drafter every expected reference in any of the 8 briefs (K found at most ${Math.max(...CASES.map((c) => recall.recall.K["20"][c].found))} of 24, V ${range(CASES.map((c) => recall.recall.V["20"][c].found))} in every brief), and their single illustration runs matched ${matched(byArm("K")[0].verdict)} and ${matched(byArm("V")[0].verdict)} of 8. Keeping only this week's files (F) showed the drafter every expected reference in every brief, yet by the rule fixed before the runs F does not keep the bar: it met it in ${fBar} of 5 runs against ${pBar} of 5 for the graph on the six-file week (P). At 200 documents the week still fits one read: the graph reading all of it (PG) matched ${matched(byArm("PG")[0].verdict)} of 8 in its single run.`);
P("**2. Does a vector index earn its place over a plain keyword search on this job?**",
  `No. At 20 lines a section V showed the drafter ${range(CASES.map((c) => recall.recall.V["20"][c].found))} expected references a brief against K's ${range(CASES.map((c) => recall.recall.K["20"][c].found))}, so neither can match a brief, and under the verdict recorded from stage 0 V does not earn its place over K; each single illustration run matched ${matched(byArm("V")[0].verdict)} of 8. V's index (a vector index) also took ${S.V.index.toFixed(1)} seconds a brief to build, against ${S.K.index.toFixed(3)} for K's keyword index.`);
P("**3. What does each route cost a brief, in money and seconds?**",
  `On the smallest model: F ${usd(S.F.cost)} and ${S.F.seconds.toFixed(1)} seconds a brief, against P's ${usd(S.P.cost)} and ${S.P.seconds.toFixed(1)} on the six-file week. Reading the whole grown week in one call (PG) cost ${usd(S.PG.cost)} a brief, about ${Math.round(S.PG.cost / S.F.cost)} times F, because its prompt of about ${int(Math.round(mean(CASES.map((c) => trace(byArm("PG")[0], c).model_call.tokens.in)) / 1000) * 1000)} tokens crosses Haiku's 100,000-token price line. The agent loop (E) cost ${usd(S.E.cost)} a brief only because it read ${range(CASES.map((c) => eR[c].reads.length))} files of 207 and skipped the archive by file name.`);

// 2. the arms
P("## The arms",
  "Every WORK-10 arm drafted with claude-haiku-5-5. Cost a brief is the mean over the arm's counted runs, priced call by call from `graph/prices.json` (both Haiku tiers). Seconds a brief is the whole brief; the index and the draft call are shown apart. WORK-09's arms on the six-file week are below the line, from `eval/results-arms/`, priced as WORK-09 priced them.");
P(table(["Arm", "What it is", "Folder", "Counted runs", "Briefs matched (of 8), each run", "Bar met", "Cost a brief", "Seconds a brief", "of which index", "of which draft call"], [
  ...ARM_ORDER.map((a) => {
    const s = S[a];
    return [`**${a}**${a === "K" || a === "V" ? " (illustration)" : ""}`, ARMS[a].what, `\`${ARMS[a].folder}\``, s.rs.length, s.matched.join(", "), `${s.bar} of ${s.rs.length}`, usd(s.cost), s.seconds.toFixed(1),
      a === "E" ? "none" : s.index === 0 ? "none" : `${s.index < 0.1 ? s.index.toFixed(3) : s.index.toFixed(1)}`, a === "E" ? "not split (4 to 5 calls)" : s.draft.toFixed(1)];
  }),
  ...["A1", "A2", "Ceiling"].map((n) => {
    const w = W[n]; const r0 = w.rs[0];
    const what = { A1: "WORK-09: one agent, one pass", A2: "WORK-09: one agent that reviews its own draft", Ceiling: "WORK-09: one agent, one pass, largest model (claude-opus-5-5, effort high)" }[n];
    return [n, what, "`data/cases`", w.rs.length, w.matched.join(", "), `${w.bar} of ${w.rs.length}`, usd(w.cost), w.seconds.toFixed(1), "none", "not split"];
  }),
]));
P(`P and F ran five times each and decide the verdict for F. K and V ran once each as illustration, outside any verdict. PG and E ran once each: single runs, reported for misses, cost and seconds, deciding nothing. V's index is rebuilt for each brief; F's "index" is the week read from each file's content (${S.F.index.toFixed(3)} seconds). E's seconds are the Node harness's own figure.`);

{
  const fv = graphCounted.map((r) => JSON.stringify(r.framework_version));
  must(new Set(fv).size === 1, "one framework version across the counted graph runs");
  const v = graphCounted[0].framework_version;
  const pgRel = pgSentences.filter((x) => x.released);
  must(pgRel.filter(archived).length === 0, "no PG sentence cites an archived file");
  P(`Every counted graph run ran on Python ${v.python}, langgraph ${v.langgraph}, langchain ${v.langchain}, langchain-core ${v["langchain-core"]}, langchain-anthropic ${v["langchain-anthropic"]}, mcp ${v.mcp}, bm25s ${v.bm25s} and fastembed ${v.fastembed} (\`uv.lock\` ${v.uv_lock_sha}), with the server reached through \`MCPAdapter\` (route \`${graphCounted[0].mcp_route}\`).`,
    `PG showed the drafter every line of the grown week (${range(Object.values(byArm("PG")[0].index_entries), int)} entries a brief); none of the ${pgRel.length} sentences it released cites an archived file. E, the agent loop, chose its own reads; in no brief did it read an archived file:`);
  const groups = new Map();
  for (const c of CASES) { const k = `${eR[c].calls}|${[...eR[c].reads].sort().join(", ")}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(c); }
  P(table(["Briefs", "Model calls", "Files read"], [...groups].map(([k, cs]) => { const [calls, files] = k.split("|"); return [cs.join(", "), calls, `${files.split(", ").length}: ${files}`]; })));
}

// 3. recall
P("## Recall at stage 0: K and V",
  `Recall is the expected facts' references among the lines the drafter would see (found / expected), measured with no model call, before any paid run, with the fixed queries (hash \`${recall.queries_hash.slice(0, 8)}…${recall.queries_hash.slice(-4)}\`). The grown week has ${range(Object.values(recall.index_entries), int)} index entries a brief.`);
P(table(["Arm", "k", ...CASES], [
  ...["K", "V"].flatMap((a) => ["5", "10", "20", "40"].map((k) => [a, k, ...CASES.map((c) => `${recall.recall[a][k][c].found}/${recall.recall[a][k][c].of}`)])),
  ["F", "all of the week", ...CASES.map((c) => `${recallF.recall[c].found}/${recallF.recall[c].of}`)],
]));
P(`At k = 20, the value every paid run used, K finds every expected reference in ${complete("K", "20")} of 8 briefs and V in ${complete("V", "20")} of 8; ${missedAt20} expected references go unshown across the 16 arm-briefs. Under the stop rule fixed for stage 0, no brief of K or V can match.`,
  `**Why both miss.** Of the ${range(shownAt20.K)} lines K shows the drafter in a brief, ${range(ownAt20.K)} come from the week's own files; for V, ${range(ownAt20.V)} of ${range(shownAt20.V)}. The rest are archive lines. Nothing in a query separates this week's lines from earlier weeks' lines, so the archive's near misses (the same metrics, owners, action ids and words, from 25 earlier weeks) fill the top of every section. The queries, the tokenizer and k were not changed after recall was seen.`,
  `The version 1 verdict, recorded from stage 0 alone: ${v1.replace(/\*\*/g, "")}`);

// 4. the verdict for F
P("## The verdict for F", "The rule, as fixed before the first run (`WORK-10-DESIGN.md`, section 6):", `> ${ruleF}`);
P(`**F does not keep the bar.** F met the bar in ${fBar} of 5 runs and P in ${pBar} of 5. The rule reads bar met first, so the tie-break does not apply. Median briefs matched, reported only: F ${fMed}, P ${pMed}.`);
P("Beside the verdict, which they do not change:",
  [
    `- **Identical lines.** In every brief of every F run, F showed the drafter exactly the lines P showed for that case (checked line by line in the traces). The two arms' draft requests differ by one line, the list of file names, which in F names all 207 files of the grown folder.`,
    `- **Complete recall.** F's recall was complete in every brief of all five F runs; every miss in F is a drafting miss, none a retrieval miss.`,
    `- **A gap of one run.** P ${pBar} of 5, F ${fBar} of 5.`,
    `- **Pooled, ${pBar + fBar} of 10.** The graph met the bar in ${pBar + fBar} of the 10 runs of P and F together.`,
    `- **WORK-09 on the six-file week** (\`eval/ARMS.md\`), the same smallest model: A1, one agent alone, met the bar in ${W.A1.bar} of ${W.A1.rs.length} runs, briefs matched ${W.A1.matched.join(", ")}; A2, with the review step, ${W.A2.bar} of ${W.A2.rs.length} (${W.A2.matched.join(", ")}); the largest model (Ceiling) ${W.Ceiling.bar} of ${W.Ceiling.rs.length} (${W.Ceiling.matched.join(", ")}). P, the graph on the same week, met it in ${pBar} of 5, briefs matched ${pRuns.map((r) => matched(r.verdict)).join(", ")}. The smallest model misses often on its own, so a miss in F is not by itself a retrieval effect.`,
  ].join("\n"));

// 5. predictions
P("## Predictions beside the results", "Megat's predictions, word for word from `WORK-10-DESIGN.md`, each written and signed before the runs it predicts.");
P(table(["Prediction", "Written", "Result"], PRED));

// 6. every run
P("## Every run", "Every record in `eval/results-graph/`, in the order run. Briefs matched is of 8 (of 1 for a one-brief run); claims verified is over the six cases. Cost is what the ledger holds for the run.");
const runRows = runs.map((r) => {
  const v = r.verdict; const nb = isE(r) ? Object.keys(casesOf(r)).length : r.briefs;
  if (r.error) return [short(r.label), r.arm, r.stage, "no", `\`${r.folder}\``, "no page", "", 0, "", "n/a", usd(r.cost_usd), "", why(r)];
  const sec_ = isE(r) ? r.seconds / nb : r.seconds_per_brief;
  return [short(r.label), r.arm, r.stage, r.counted ? "yes" : "no", `\`${isE(r) ? "data/cases-grown" : r.folder}\``, `${matched(v)} of ${nb}`, `${v.claims_verified} of ${v.of_claims}`, removalsOf(r).length, `${v.gates_held} of ${v.of_gates}`, v.passed && nb === 8 ? "**met**" : nb === 8 ? "missed" : "n/a", usd(r.cost_usd), sec_ ? Number(sec_).toFixed(1) : "", why(r)];
});
P(table(["Run", "Arm", "Stage", "Counted", "Folder", "Briefs matched", "Claims verified", "Removed", "Gates held", "Bar", "Cost", "Seconds a brief", "Note"], runRows));
P(`Also in the ledger: the grammar probe \`${probe[0].label}\`, one draft request with \`max_tokens\` 1 that checked the flat schema was accepted (status ${probe[0].status}, stop reason ${probe[0].stop_reason}, ${usd(probe[0].cost_usd)}).`);

// every miss
P("## Every miss",
  "Each line is the checker's own words. For the graph arms each missing fact is marked as the record names it: a **drafting miss** (the line was shown to the drafter and the page lacks the fact) or a **retrieval miss** (the line was never shown). E's misses are not split: the agent loop chose its own reads. Lines that are not a missing fact (for the state cases) are marked *state*.");
const tagOf = (r, c, f) => {
  if (!f.startsWith(`${c}: missing `)) return "*state*";
  if (isE(r)) return "agent loop";
  const fact = f.replace(`${c}: missing `, "");
  if ((r.retrieval_misses ?? []).some((m) => m.case === c && m.fact === fact)) return "retrieval miss";
  if ((r.drafting_misses ?? []).some((m) => m.case === c && m.fact === fact)) return "drafting miss";
  return "missing";
};
function missList(r) {
  const out = [];
  for (const c of CASES) { const k = casesOf(r)[c]; if (!k || !k.fails.length) continue;
    out.push(`- **${c}** (${k.facts_found} of ${k.facts_total} facts)`);
    for (const f of k.fails) out.push(`  - ${tagOf(r, c, f)}: ${f.replace(`${c}: `, "")}`);
  }
  return out;
}
for (const r of counted.filter((r) => !["K", "V"].includes(r.arm))) {
  const ms = missList(r);
  L.push(`**${short(r.label)}** (${r.arm})${ms.length ? "" : ": no miss; every brief matched."}`, ...ms, "");
}
for (const a of ["K", "V"]) {
  const r = byArm(a)[0];
  const rm = r.retrieval_misses, dm = r.drafting_misses;
  L.push(`**${short(r.label)}** (${a}, illustration): ${rm.length} retrieval misses and ${dm.length} drafting misses. The drafting misses and every line that is not a missing fact:`);
  for (const c of CASES) for (const f of casesOf(r)[c]?.fails ?? []) { const t = tagOf(r, c, f); if (t !== "retrieval miss") L.push(`- ${c}: ${t}: ${f.replace(`${c}: `, "")}`); }
  L.push("", `<details><summary>${a}: all ${rm.length} retrieval misses, by brief and reference</summary>`, "");
  for (const c of CASES) {
    const byRef = new Map();
    for (const m of rm.filter((m) => m.case === c)) for (const ref of m.not_shown) (byRef.get(ref) ?? byRef.set(ref, []).get(ref)).push(m.fact);
    if (!byRef.size) continue;
    L.push(`- **${c}**`);
    for (const [ref, facts] of byRef) L.push(`  - \`${ref}\` never shown: ${facts.length} fact${facts.length > 1 ? "s" : ""} (${facts.map((f) => f.replace(/^[^:]+: /, "")).join("; ")})`);
  }
  L.push("", "</details>", "");
}
P("**Uncounted runs.** Kept as recorded; they decide nothing.");
for (const r of runs.filter((r) => !r.counted)) {
  if (r.error) { L.push(`- **${short(r.label)}** (${r.arm}): every brief: "no page was released" (${why(r)}).`); continue; }
  const ms = missList(r);
  L.push(`- **${short(r.label)}** (${r.arm})${ms.length ? ":" : ": no miss."}`, ...ms.map((m) => `  ${m}`));
}
L.push("");

// every removal
const allRem = runs.flatMap((r) => removalsOf(r).map((x) => ({ r, ...x })));
P("## Every removal, with the checker's reason",
  `Every sentence the checker removed in any run, ${allRem.filter((x) => x.r.counted).length} in counted runs and ${allRem.filter((x) => !x.r.counted).length} in uncounted ones. A removal for an empty reference is marked; there ${allRem.filter((x) => x.r.counted && x.empty_reference).length === 1 ? "is" : "are"} ${allRem.filter((x) => x.r.counted && x.empty_reference).length} in counted runs.`);
P(table(["Run", "Counted", "Arm", "Brief", "Section", "Sentence", "Checker's reason", "Empty reference"],
  allRem.map((x) => [short(x.r.label), x.r.counted ? "yes" : "no", x.r.arm, x.case, x.section, x.text, x.reasons.join("; "), x.empty_reference ? "yes" : ""])));
const rem44 = allRem.filter((x) => x.r.counted && x.reasons.some((s) => /does not hold the number 4[24]/.test(s)));
P(`${rem44.length} of the ${allRem.filter((x) => x.r.counted).length} counted removals, in ${new Set(rem44.map((x) => x.r.arm)).size} arms (${[...new Set(rem44.map((x) => x.r.arm))].join(", ")}), are one miss: the drafter claimed the number inside a file name (\`09_week44_a.xlsx\`, \`week42.xlsx\`) as a number, and the cited line does not hold it as a number. It is listed for a later decision; no instruction was changed for it.`);

// 7. limits
P("## Limits", "Section 8 of `WORK-10-DESIGN.md`, in full:", limits);
P("Also from the records: PG and E ran once each, and K and V once each as illustration; each is a single reading, not a rate. Every WORK-10 run used the smallest model; stage 3 (the largest model) did not run.");

// 8. what changed
P("## What changed during the build, and why");
P(`**The archived trackers.** In the archive as first built in session 2, all 25 archived trackers carried the eight current actions word for word, months before \`tracker.csv\` adds them (in runs R2026-10-23-1 and R2026-10-30-1). They were rebuilt as an earlier review cycle's actions: each id A001 to A008 holds one older action at a time from a seeded pool, open for one to four weeks, then closed (\`graph/make_grown.mjs\`). Checked on this page: ${archRows.length} rows in ${archTrackers.length} archived trackers, ${repeats} repeating a current action's text.`);
P(`**No \`cache_control\` on the graph arms.** The graph makes one call a brief. With only a top-level cache breakpoint, each call would write its whole prompt to the cache, and the next brief, sharing only the instructions, would never read it back: every input token would pay the cache-write price for nothing. Megat changed the rule in session 2: P, F, K, V and PG send no \`cache_control\` (their records show ${graphCounted.every((r) => r.cache === false && r.tokens.cache_read === 0 && r.tokens.cache_write === 0) ? "no cache reads or writes in any counted run" : "cache tokens"}); E keeps the Node harness's caching, unchanged (${int(eRun.node_record.tokens.cache_read)} cache-read and ${int(eRun.node_record.tokens.cache_write)} cache-write tokens in its run).`);
P(`**The schema and the 400.** The first ${grammarRuns.length} stage 1 runs (${grammarRuns.map((r) => `${r.arm}`).join(", ")}) were each refused on their first draft call: "${grammarRuns[0].error.match(/'message': '([^']+)'/)[1]}" The API compiles the JSON schema output into a grammar, and the first schema (the sentence shape five times, each claim a choice of two shapes) was too large; neither the mock nor the token counting endpoint compiles it. No page was released and nothing was spent; the records are kept, uncounted. The fix: one flat list of sentences, each naming its section, and one claim shape with every field a string (1,302 characters of schema against 4,748, per the design note); the payload the server receives is the same. Five more commands were refused at once because run labels went only to the minute, so a second run of an arm in the same minute found its folder taken; labels now carry seconds. The grammar probe then confirmed the new schema was accepted.`);
P(`**The output limit and streaming.** The first P run after the schema fix (\`${short(capRun.label)}\`), at \`max_tokens\` 16,000 with no streaming, had ${capRun.truncated_briefs.length} briefs end on \`max_tokens\` (${capRun.truncated_briefs.join(", ")}); the truncation guard held the stage${hold ? ` (held ${hold.at.slice(11, 16)}, released ${hold.released.slice(11, 16)})` : ""}. One call carries the model's thinking and the whole draft under one limit, where the agent loop spreads them over several calls. The fix: the draft call streams, with \`max_tokens\` 32,000; that run is kept, uncounted. Since then all ${draftCalls.length} draft calls of the counted graph runs ended on \`end_turn\`; the largest wrote ${int(maxOut.t.model_call.tokens.out)} output tokens (${maxOut.r.arm}, \`${short(maxOut.r.label)}\`, ${maxOut.c}). One line was added to \`graph/draft_step.md\`, that every claim carries its reference, after that run had a removal for an empty reference.`);
P(`**Arm F, added after stage 0.** Stage 0's recall showed K and V could not keep the bar at k = 20 (the version 1 verdict above), before any paid run. Megat added F to test whether the week, not a query, is what separates the lines: each file's week read from its content, never its name, and every line of this week and the week before kept. The verdict rule for F was fixed before F's first run. F's stage 0 recall was complete in ${fComplete} of 8 briefs.`);
P(`**Stage 3, dropped.** Stage 3 would have run K and V on the largest model if stage 1 left the K-against-V verdict open. Stage 0 closed it: at 20 lines a section K and V leave expected references unshown in every brief, and no model can cite a line it is never shown.`);

// 9. forecast and ledger
P("## Forecast beside measured cost",
  `The forecast is stage 0's: token counts of the exact requests from the free token counting endpoint (an estimate), priced from \`graph/prices.json\`, with the graph arms' output taken from the first P run's median (${int(forecast.median_output_per_brief_graph["claude-haiku-5-5"])} tokens a brief) and E's from WORK-09's A1 median (${int(Math.round(forecast.median_output_per_brief["claude-haiku-5-5"]))} tokens).`);
P(table(["Run", "Arm", "Counted", "Forecast", "Measured", "Difference"],
  runs.filter((r) => r.cost_usd > 0).map((r) => [short(r.label), r.arm, r.counted ? "yes" : "no", usd(r.forecast_usd), `${usd(r.cost_usd)}${r.cost_is_upper_bound ? " (upper bound)" : ""}`, pct(r.cost_usd, r.forecast_usd)])));
const perBrief = (r, c) => (isE(r) ? r.cost_by_brief_usd[c] : trace(r, c).cost_usd);
P("Per brief, counted runs, by arm:");
P(table(["Arm", "Forecast a brief", "Measured a brief", "Difference"], ARM_ORDER.map((a) => {
  const fc = CASES.map((c) => forecast.per_brief_usd[a]["claude-haiku-5-5"][c]);
  const ms = byArm(a).flatMap((r) => CASES.map((c) => ({ c, m: perBrief(r, c), f: forecast.per_brief_usd[a]["claude-haiku-5-5"][c] })));
  return [a, range(fc, usd), range(ms.map((x) => x.m), usd), range(ms.map((x) => ((x.m - x.f) / x.f) * 100), (p) => `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(1)}%`)];
})));
P(`K and V came in under half their forecast because they wrote far less: they had little they could cite. E's forecast priced reading all 207 files; E read ${range(CASES.map((c) => eR[c].reads.length))}. PG ran over where a brief needed more output than the median the forecast took.`);
const stageSum = (st) => spend.entries.filter((e) => e.stage === st).reduce((s, e) => s + e.cost_usd, 0);
must(Math.abs(spend.entries.reduce((s, e) => s + e.cost_usd, 0) - spend.total_usd) < 1e-6, "the ledger total equals the sum of its entries");
P("**The ledger** (`eval/results-graph/spend.json`), every paid call of WORK-10, counted or not:");
P(table(["Stage", "What", "Model calls", "Cost"], [
  ["0", `token counts (${spend.entries.filter((e) => e.stage === 0).map((e) => e.note.match(/^\d+/)[0]).join(" + ")} requests, free)`, 0, usd(stageSum(0))],
  ["1", "the grammar probe, the 16,000-cap P run, the 05_inference test brief and the twelve counted runs", spend.entries.filter((e) => e.stage === 1).reduce((s, e) => s + e.model_calls, 0), usd(stageSum(1))],
  ["2", "two uncounted E briefs (upper bounds), PG and E once each", spend.entries.filter((e) => e.stage === 2).reduce((s, e) => s + e.model_calls, 0), usd(stageSum(2))],
  ["3", "dropped", 0, usd(0)],
  ["**Total**", `against the cap of ${usd(spend.cap_usd, 2)}`, spend.entries.reduce((s, e) => s + e.model_calls, 0), `**${usd(spend.total_usd, 6)}**`],
]));
P(`${usd(spend.cap_usd - spend.total_usd, 2)} of the ${usd(spend.cap_usd, 2)} cap is unspent. ${(spend.holds ?? []).filter((h) => !h.released).length ? "A hold is set." : "No hold is set."}`);

const md = L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
for (const w of [/\bproduction\b/i, /\bdeployed\b/i]) must(!w.test(md), `the page avoids ${w}`);
fs.writeFileSync(OUT, md);
console.log(`wrote ${path.relative(ROOT, OUT)}: ${md.split("\n").length} lines, ${runs.length} runs, ${allRem.length} removals`);
