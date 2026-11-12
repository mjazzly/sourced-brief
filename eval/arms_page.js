// Writes eval/ARMS.md from every record in eval/results-arms. The page is never edited by hand: the
// question, the verdict rule and the predictions are copied from WORK-09-DESIGN.md, every number
// comes from the records, and the verdict line is written by the rule once every arm has its runs.
// The counts of sentences broken and fixed by review come from the before-review check in
// eval/review_effect.js, which runs the unchanged checker on each draft as it stood before review.
import fs from "node:fs";
import path from "node:path";
import { TITLES } from "../lib/check.js";
import { PLANNED } from "./arms.js";
import { runEffect, isBroken } from "./review_effect.js";

const ORDER = ["A1", "A2", "B", "Ceiling"];
const WHAT = { A1: "one agent, one pass, smallest model", A2: "one agent that reviews its own draft, smallest model", B: "a drafter and a reviewer agent, smallest model for both", Ceiling: "one agent, one pass, largest model at effort high" };
const fmtInt = (n) => (n == null ? "" : Number(n).toLocaleString("en-GB"));
const usd = (n, d = 4) => (n == null ? "not recorded" : `US$${Number(n).toFixed(d)}`);
const median = (xs) => { const a = xs.filter((x) => x != null).sort((p, q) => p - q); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const briefsMatched = (r) => r.verdict.cases_matched + r.verdict.state_matched;
const sectionOf = (s) => Object.keys(TITLES).find((k) => s.includes(`${TITLES[k]}:`) || s.includes(`${k} |`) || s.includes(`${k}|`));

function noteSection(root, n) {
  const f = path.join(root, "WORK-09-DESIGN.md");
  if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, "utf8");
  const i = t.search(new RegExp(`^## ${n}\\. `, "m")); if (i < 0) return null;
  const body = t.slice(t.indexOf("\n", i) + 1);
  const j = body.search(/^## \d+\. /m);
  return (j < 0 ? body : body.slice(0, j)).trim();
}

// "| A1 | 3 of 5. |" in section 9 gives A1 "3 of 5".
function predictionsFrom(text) {
  if (!text) return null;
  const out = {};
  for (const m of text.matchAll(/^\| *(A1|A2|B|Ceiling) *\| *(\d+ of \d+)/gm)) out[m[1]] = m[2];
  return Object.keys(out).length ? out : null;
}

export function loadArmRuns(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((r) => r.counted).sort((a, b) => a.started_at.localeCompare(b.started_at));
}

// Each arm's runs in the order they were made; the first PLANNED[arm] count toward the verdict.
export function groupArms(runs) {
  const g = {};
  for (const r of runs) (g[r.arm_name] ||= []).push(r);
  const out = {};
  for (const [name, rs] of Object.entries(g)) {
    const plan = PLANNED[name] ?? 0, used = plan ? rs.slice(0, plan) : [], extra = plan ? rs.slice(plan) : rs;
    out[name] = { name, plan, all: rs, used, extra,
      bar: used.filter((r) => r.verdict.passed).length,
      cost: median(used.map((r) => r.cost_per_brief_usd)), seconds: median(used.map((r) => r.seconds_per_brief)) };
  }
  return out;
}

export function applyRule(G) {
  const short = ORDER.filter((a) => (G[a]?.used.length || 0) < PLANNED[a]);
  if (short.length) return { ready: false, lines: [`The verdict waits for every arm's runs: ${ORDER.map((a) => `${a} ${G[a]?.used.length || 0} of ${PLANNED[a]}`).join(", ")}.`] };
  const a1 = G.A1.bar, a2 = G.A2.bar, b = G.B.bar, L = [];
  const costLine = `B's median cost a brief is ${usd(G.B.cost)} against the ceiling's ${usd(G.Ceiling.cost)}.`;
  if (b > a2 && G.B.cost != null && G.Ceiling.cost != null && G.B.cost < G.Ceiling.cost) {
    L.push(`**B earns its place.** B met the bar in ${b} of 5 runs and A2 in ${a2} of 5. ${costLine}`);
    return { ready: true, outcome: "B earns its place", lines: L };
  }
  if (b > a2) L.push(`**B does not earn its place on cost.** B met the bar in ${b} of 5 runs and A2 in ${a2} of 5. ${costLine}`);
  else L.push(`**The second agent is folded.** A2 met the bar in ${a2} of 5 runs and B in ${b} of 5${a2 === b ? "; a tie goes to the arm with fewer parts" : ""}.`);
  L.push(a2 > a1 ? `**The review step stays in the skill.** A2 met the bar in ${a2} of 5 runs and A1 in ${a1} of 5.` : `**The review step does not stay in the skill.** A2 met the bar in ${a2} of 5 runs and A1 in ${a1} of 5${a2 === a1 ? "; a tie goes to the arm with fewer parts" : ""}.`);
  if (a2 === 0 && b === 0) L.push("**Neither A2 nor B met the bar in any of its five runs.** Every miss is named below by case, section, fact and value.");
  return { ready: true, outcome: b > a2 ? "B not kept on cost" : "second agent folded", lines: L };
}

// A miss whose sentence passed the checker before review and was removed after it: the review caused it.
function brokenFor(fail, broken) {
  const key = sectionOf(fail), q = (/"([^"]+)"/.exec(fail) || [])[1], ref = ((/\(([^)]+line \d+|[^)]+ [A-Z]\d+[^)]*)\)/.exec(fail) || [])[1] || (/\| ([^|]+)$/.exec(fail) || [])[1] || "").trim();
  const bare = (x) => String(x).toLowerCase().replace(/,/g, "");
  return (broken || []).find((s) => (!key || s.section === key) && ((q && bare(s.text).includes(bare(q))) || (ref && s.refs.includes(ref)))) || null;
}
const introduced = (s) => `introduced after review; the sentence passed the checker before review, and the drafter ${s.change === "added" ? "added it" : "changed it"} after review, ${s.findings.length ? `acting on ${s.findings.join(", ")}` : "with no finding on it"}`;

function findingFor(fail, findings) {
  const key = sectionOf(fail), q = (/"([^"]+)"/.exec(fail) || [])[1], ref = (/\(([^)]+line \d+|[^)]+ [A-Z]\d+[^)]*)\)/.exec(fail) || [])[1] || (/\| ([^|]+)$/.exec(fail) || [])[1];
  const hit = (findings || []).find((f) => (!key || f.section === key) && ((q && f.sentence.toLowerCase().includes(q.toLowerCase())) || (ref && f.fault.includes(ref.trim()))));
  return hit ? `${hit.id} named it; the drafter's sentence was ${hit.outcome || "unmatched"}` : "no finding named it";
}

export function writeArmsPage(dir, outPath, root) {
  const runs = loadArmRuns(dir), G = groupArms(runs), rule = applyRule(G);
  const effect = new Map(runs.map((r) => [r.label, runEffect(r, dir, root)]));
  const tally = (rs, part) => rs.reduce((n, r) => n + Object.values(effect.get(r.label) || {}).reduce((m, e) => m + e[part].length, 0), 0);
  const L = [];
  L.push("# WORK-09: a second agent, tested for its place", "");
  L.push("Does a second agent lift the smallest model to the bar on the same eight briefs and the same checker, and does it cost less a brief than the largest model alone? Every arm runs the same tool server, cases, expected fact lists, fixed gate answer and checker as the sourced brief v1.3. The design, the reviewer's instructions in full and the checklist are in WORK-09-DESIGN.md. This page is rebuilt from eval/results-arms after every run.", "");
  L.push("## The verdict", "", ...rule.lines, "");
  const predicted = predictionsFrom(noteSection(root, 9));
  if (predicted) {
    L.push("## Predictions beside the results", "", "Megat's predictions were signed before the first run; the full lines are at the foot of this page.", "");
    L.push("| Arm | Predicted bar met | Bar met |", "|---|---|---|");
    for (const a of ORDER) { const g = G[a]; L.push(`| ${a} | ${predicted[a] || "no prediction"} | ${g ? `${g.bar} of ${g.used.length}` : `0 of ${PLANNED[a]} run`} |`); }
    L.push("");
  }
  L.push("## The arms", "");
  L.push("| Arm | What runs | Runs | Bar met | Briefs matched of 8, run by run | Claims verified | Sentences removed | Review findings | Sentences changed after review | Broken by review | Fixed by review | Median cost a brief | Median seconds a brief |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const a of [...ORDER, ...Object.keys(G).filter((k) => !ORDER.includes(k))]) {
    const g = G[a];
    if (!g) { L.push(`| ${a} | ${WHAT[a] || ""} | 0 of ${PLANNED[a]} | | | | | | | | | | |`); continue; }
    const rs = g.plan ? g.used : g.all, reviewed = rs.some((r) => r.review);
    const sumF = rs.reduce((n, r) => n + Object.values(r.review || {}).reduce((m, x) => m + (x.findings?.length || 0), 0), 0);
    const sumC = rs.reduce((n, r) => n + Object.values(r.review || {}).reduce((m, x) => m + (x.sentences_changed || 0), 0), 0);
    L.push(`| ${a} | ${WHAT[a] || "outside the plan"} | ${g.plan ? `${g.used.length} of ${g.plan}` : `${g.all.length}, outside the verdict`} | ${g.plan ? `${g.bar} of ${g.used.length}` : `${rs.filter((r) => r.verdict.passed).length} of ${rs.length}`} | ${rs.map(briefsMatched).join(", ")} | ${fmtInt(rs.reduce((n, r) => n + r.verdict.claims_verified, 0))} of ${fmtInt(rs.reduce((n, r) => n + r.verdict.of_claims, 0))} | ${rs.reduce((n, r) => n + r.verdict.unsourced_caught, 0)} | ${reviewed ? sumF : ""} | ${reviewed ? sumC : ""} | ${reviewed ? tally(rs, "broken") : ""} | ${reviewed ? tally(rs, "fixed") : ""} | ${usd(g.plan ? g.cost : median(rs.map((r) => r.cost_per_brief_usd)))} | ${(g.plan ? g.seconds : median(rs.map((r) => r.seconds_per_brief))) ?? ""} |`);
  }
  L.push("");
  L.push("Broken by review counts the sentences the checker removed after review whose sentence in the draft before review passed it. Fixed by review counts the sentences the checker would have removed before review that passed after it. Both come from the unchanged checker run again on the draft each A2 and B drafter recorded before review; `node eval/review_effect.js` reruns the check and names every sentence.", "");
  L.push("## Every run", "");
  L.push("| Date | Run | Arm | Model | Cases | State | Briefs matched | Claims verified | Sentences removed | Gates held | Bar | Model calls (drafter / reviewer) | Tokens in / out | Cost | Cost a brief | Seconds a brief | In the verdict |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of runs) {
    const v = r.verdict, g = G[r.arm_name], inVerdict = g?.used.includes(r);
    const calls = r.by_agent ? `${r.by_agent.drafter?.model_calls ?? ""} / ${r.by_agent.reviewer ? r.by_agent.reviewer.model_calls : "none"}` : fmtInt(r.model_calls);
    L.push(`| ${r.date} | ${r.label} | ${r.arm_name} | ${r.model}${r.effort ? ` ${r.effort}` : ""} | ${v.cases_matched} of ${v.of_cases} | ${v.state_matched} of ${v.of_state} | ${briefsMatched(r)} of 8 | ${v.claims_verified} of ${v.of_claims} | ${v.unsourced_caught} | ${v.gates_held} of ${v.of_gates} | ${v.passed ? "met" : "missed"} | ${calls} | ${fmtInt(r.total_input)} / ${fmtInt(r.tokens?.output)} | ${usd(r.cost_usd, 3)} | ${usd(r.cost_per_brief_usd)} | ${r.seconds_per_brief ?? ""} | ${inVerdict ? "yes" : "no, beyond the plan"} |`);
  }
  if (!runs.length) L.push("| | No arm run is recorded yet. | | | | | | | | | | | | | | | |");
  L.push("");
  L.push("## Every miss and every removal", "");
  let any = false;
  for (const r of runs) {
    const lines = [];
    for (const c of Object.values(r.cases)) {
      if (c.match) continue;
      const findings = r.review?.[c.id]?.findings, broken = effect.get(r.label)?.[c.id]?.broken;
      const why = (f) => { const b = brokenFor(f, broken); return b ? introduced(b) : findingFor(f, findings); };
      for (const f of c.fails) lines.push(`- ${f}${r.review ? `. Review: ${r.review[c.id]?.ran ? why(f) : `no review (${r.review[c.id]?.status || "not run"})`}.` : ""}`);
    }
    for (const [id, rem] of Object.entries(r.removed || {})) for (const s of rem) lines.push(`- ${id}: removed by the checker from ${TITLES[s.section] || s.section}: "${s.text}" Reason: ${s.reasons.join("; ")}${isBroken(effect.get(r.label), id, s.section, s.text) ? ". Introduced after review: the sentence passed the checker before review." : ""}`);
    if (lines.length) { any = true; L.push(`**${r.label}** (${r.arm_name}, bar ${r.verdict.passed ? "met" : "missed"})`, "", ...lines, ""); }
  }
  if (!any) L.push(runs.length ? "No run has a miss or a removal." : "No arm run is recorded yet.", "");
  const ruleText = noteSection(root, 8), predictions = noteSection(root, 9);
  L.push("## The verdict rule, fixed before the first run", "", ruleText || "See WORK-09-DESIGN.md, section 8.", "");
  L.push("## Megat's predictions, signed before the first run", "", predictions || "See WORK-09-DESIGN.md, section 9.", "");
  fs.writeFileSync(outPath, L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n");
  return outPath;
}
