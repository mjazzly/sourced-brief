// Writes eval/EXEMPLAR.md from every results file in eval/results. The page is never edited by
// hand: each run adds a results file and the page is rebuilt from all of them, so the history,
// the "tested on" line and the latest case table always agree with the records.
import fs from "node:fs";
import path from "node:path";

const fmtInt = (n) => (n == null ? "" : Number(n).toLocaleString("en-GB"));
const money = (n) => (n == null ? "not recorded" : `US$${Number(n).toFixed(3)}`);
const perBrief = (r) => (r.cost_usd == null ? "not recorded" : `US$${(r.cost_usd / r.briefs).toFixed(4)}`);

export function loadResults(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => (a.started_at || a.date).localeCompare(b.started_at || b.date));
}
const score = (v) => `${v.cases_matched} of ${v.of_cases} cases, state ${v.state_matched} of ${v.of_state}, ${v.claims_verified} of ${v.of_claims} claims verified, ${v.unsourced_caught} sentence${v.unsourced_caught === 1 ? "" : "s"} removed, ${v.gates_held} of ${v.of_gates} gates held`;

export function writePage(resultsDir, outPath, header) {
  const all = loadResults(resultsDir);
  const counted = all.filter((r) => r.counted);
  const latest = counted[counted.length - 1];
  const L = [];
  L.push("# Sourced Brief", "");
  L.push("Writes the weekly status brief from six sources (the action tracker, the merged table and its decision log, four answered questions, two short documents and last week's brief), and every sentence carries its source: the file and the row, line or answer id it came from. The model reads the sources and drafts the page in five fixed sections with a claim on every number, name, date, quote and status; the code checks each claim against its source, removes any sentence that fails and lists it with the reason, and releases the page only with what passed. Four gates: two sources that disagree are shown side by side and never resolved quietly; a section with nothing to cite reads \"No source this week\"; a source marked confidential is declined and named as declined; a number no source states is never computed.", "");
  L.push(`**Owner:** Megat Jazly. **Current version:** ${header.version}. **Limits:** one synthetic week from a seeded generator; six source files in the shapes of the three earlier builds; one brief per week folder; no external system connected.`, "");
  if (latest) L.push(`**Tested on:** ${latest.model}${latest.effort ? ` (effort ${latest.effort})` : ""}, ${latest.date}, automated harness run: ${score(latest.verdict)}${latest.verdict.passed ? ", bar met" : ", bar not met"}. ${fmtInt(latest.model_calls)} model calls over ${latest.briefs} briefs, ${fmtInt(latest.total_input)} input tokens, ${fmtInt(latest.tokens.output)} output tokens, ${money(latest.cost_usd)} (${perBrief(latest)} a brief).`, "");
  const caught = counted.reduce((n, r) => n + (r.verdict?.unsourced_caught || 0), 0);
  if (counted.length) L.push(`**Sentences removed by the checker:** ${caught} across ${counted.length} recorded runs, every one listed in unsourced.md with its reason; what each run found says why they were removed.`, "");
  L.push("**The bar:** all six cases match and both state cases match, against expected fact lists written before the first run. A miss is named by its case, section, fact and value, never rounded up.", "");
  L.push("## Run history", "");
  L.push("| Date | Run | Version | Model | Cases | State | Claims verified | Sentences removed | Gates held | Counted | Model calls | Tokens in / out | Cost | Cost a brief |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of all) {
    const v = r.counted && r.verdict;
    L.push(`| ${r.date} | ${r.label} | ${r.skill_version} | ${r.model}${r.effort ? ` ${r.effort}` : ""} | ${v ? `${v.cases_matched} of ${v.of_cases}` : "not counted"} | ${v ? `${v.state_matched} of ${v.of_state}` : "not counted"} | ${v ? `${v.claims_verified} of ${v.of_claims}` : "not counted"} | ${v ? v.unsourced_caught : "not counted"} | ${v ? `${v.gates_held} of ${v.of_gates}` : "not counted"} | ${r.counted ? "yes" : "no"} | ${fmtInt(r.model_calls)} | ${fmtInt(r.total_input)} / ${fmtInt(r.tokens?.output)} | ${money(r.cost_usd)} | ${perBrief(r)} |`);
  }
  L.push("");
  const notes = all.filter((r) => r.note);
  if (notes.length) { L.push("## What each run found", ""); for (const r of notes) L.push(`- **${r.label}:** ${r.note}`); L.push(""); }
  if (latest) {
    L.push(`## Latest counted run, case by case (${latest.label})`, "");
    L.push("| Case | Expected | Result | Facts | Why not, if not |", "|---|---|---|---|---|");
    for (const c of Object.values(latest.cases)) L.push(`| ${c.name} | ${c.group === "state" ? "state" : c.gate ? `every fact, gate ${c.gate}` : "every fact"} | ${c.match ? "Match" : "**Miss**"} | ${c.facts_total ? `${c.facts_found} of ${c.facts_total}` : ""} | ${c.fails.slice(0, 4).join("; ")}${c.fails.length > 4 ? `; and ${c.fails.length - 4} more` : ""} |`);
    L.push("");
  }
  L.push("## How a harness run works", "");
  L.push("One command copies each case's week folder into an empty folder, starts the tool server on it, and asks for the brief in a fresh conversation with the skill and the five tools and nothing else. When the model stops on the disagreement, the harness answers with the same fixed message every run. The clean week is run a second time for State B, and a third time with one new document for State A. The checker compares every released claim with the expected fact list, which the model never sees: the section, the kind, the reference and the value; the numbers and strings that must be absent; the gate in the log; the section that must read \"No source this week\"; the file named as declined. This page is rebuilt from every recorded run.", "");
  L.push("Rerun after any change to the skill, the checker or the server: `node eval/run_eval.js --model <model id>`.");
  fs.writeFileSync(outPath, L.join("\n") + "\n");
  return outPath;
}
