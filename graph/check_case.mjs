#!/usr/bin/env node
// WORK-10, decision 13: the one checker, called from Python. Imports loadExpected, loadRun,
// checkAll and verdict from eval/check.js unchanged and prints the result as JSON. This file is the
// only reader of eval/expected/ in WORK-10's runs, so the Python graph process never opens it: the
// case check, the retrieval and drafting misses, and stage 0's recall measure all happen here.
//
//   node graph/check_case.mjs <run folder> [--only <case>] [--retrieved <json>]
//       the run folder holds one folder per brief (01_clean ... state_b) after its page was released;
//       --retrieved {case: [references the drafter saw]} names each missing fact a retrieval miss
//       (a reference was never shown) or a drafting miss (every reference was shown)
//   node graph/check_case.mjs --recall <json>
//       {arm: {k: {case: [references]}}} -> for each arm, k and brief, the expected facts' references
//       among the retrieved ones, and every one missed, by section
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadExpected, loadRun, checkAll, verdict } from "../eval/check.js";
import { TITLES } from "../lib/check.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : null);
const expected = loadExpected(path.join(ROOT, "eval", "expected"));
const byCase = Object.fromEntries(expected.cases.map((e) => [e.case, e]));
const factsOf = (id) => { const e = byCase[id]; return e.facts || byCase[e.based_on]?.facts || []; };
const refsOf = (f) => (f.kind === "change" ? [f.new_ref, f.old_ref] : [f.ref]);
// the name eval/check.js gives a fact in its "missing" lines
const factName = (f) => f.kind === "change" ? `${TITLES[f.section]}: change ${f.new_value} (${f.new_ref}) from ${f.old_value} (${f.old_ref})` : `${TITLES[f.section]}: ${f.kind} "${f.value}" (${f.ref})`;
const out = (o) => process.stdout.write(JSON.stringify(o, null, 2) + "\n");

if (opt("recall")) {
  const R = JSON.parse(fs.readFileSync(opt("recall"), "utf8")), res = {};
  for (const [arm, byK] of Object.entries(R)) for (const [k, byBrief] of Object.entries(byK)) for (const [id, refs] of Object.entries(byBrief)) {
    const seen = new Set(refs), want = new Map();
    for (const f of factsOf(id)) for (const r of refsOf(f)) if (!want.has(r)) want.set(r, f.section);
    const missed = [...want].filter(([r]) => !seen.has(r)).map(([ref, section]) => ({ ref, section, title: TITLES[section] }));
    ((res[arm] ||= {})[k] ||= {})[id] = { found: want.size - missed.length, of: want.size, recall: want.size ? (want.size - missed.length) / want.size : 1, missed };
  }
  out({ recall: res });   // no process.exit: a piped stdout must drain before the process ends
} else main();

function main() {
const dir = argv[0];
if (!dir || !fs.existsSync(dir)) { console.error("usage: node graph/check_case.mjs <run folder> [--only <case>] [--retrieved <json>] | --recall <json>"); process.exitCode = 2; return; }
const only = opt("only");
const runs = {};
for (const e of expected.cases) if (fs.existsSync(path.join(dir, e.case))) runs[e.case] = loadRun(path.join(dir, e.case));
const cases = checkAll(expected, runs);
if (only) for (const id of Object.keys(cases)) if (id !== only) delete cases[id];
const result = { cases, verdict: verdict(cases) };
if (opt("retrieved")) {
  const seenBy = JSON.parse(fs.readFileSync(opt("retrieved"), "utf8"));
  result.retrieval_misses = []; result.drafting_misses = []; result.recall_by_case = {};
  for (const [id, c] of Object.entries(cases)) {
    const seen = new Set(seenBy[id] || []);
    const want = [...new Set(factsOf(id).flatMap(refsOf))], found = want.filter((r) => seen.has(r)).length;
    result.recall_by_case[id] = { found, of: want.length, recall: want.length ? found / want.length : 1 };
    for (const f of factsOf(id)) {
      if (!c.fails.includes(`${id}: missing ${factName(f)}`)) continue;
      const notShown = refsOf(f).filter((r) => !seen.has(r));
      (notShown.length ? result.retrieval_misses : result.drafting_misses).push({ case: id, section: f.section, fact: factName(f), refs: refsOf(f), not_shown: notShown });
    }
  }
}
out(result);
}
