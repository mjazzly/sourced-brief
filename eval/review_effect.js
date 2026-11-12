// The before-review check. For every A2 and B brief, the unchanged claim checker (lib/check.js) is run
// on the draft as it stood before review and on the draft as submitted, against the same case folder
// the run used. Each sentence after review is paired with its sentence before review by the change
// matcher in eval/arms.js (same text first, then order within the section). Then:
//
//   broken by review  a sentence the checker removed after review whose sentence before review passed,
//                     or a sentence added after review that the checker removed
//   fixed by review   a sentence the checker would have removed before review whose sentence after
//                     review passed
//
// A sentence that fails both before and after review counts as neither, and so does a failing
// sentence the drafter dropped (the checker would have removed it anyway). The check judges
// sentences only: it does not run the case checker (eval/check.js) on the draft before review, so it
// cannot say which runs would have met the bar without review. It also checks that the checker, run
// again on the submitted draft, removes exactly what the run recorded.
//
//   node eval/review_effect.js                    every arm run in eval/results-arms
//   node eval/review_effect.js <label> [...]      only these runs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDraft } from "../lib/check.js";
import { loadSources } from "../lib/sources.js";
import { matchChanges } from "./arms.js";

const key = (section, text) => `${section}|${String(text ?? "").trim()}`;

// The case folder each brief was run on, as eval/run_eval.js picks it.
function folders(root) {
  const dir = path.join(root, "eval", "expected"), out = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const e = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    out[e.case] = e.rule === "only_new_document" ? e.case : e.based_on || e.case;
  }
  return out;
}

// One brief: the trace of an A2 or B brief whose review ran. Returns null when there was no review.
export function briefEffect(trace, sources) {
  const before = trace.review?.draft_before, after = trace.submitted;
  if (!before || !after) return null;
  const verdict = (sections) => new Map(checkDraft(sections, sources).map((s) => [`${s.section}#${s.n}`, s]));
  const B = verdict(before), A = verdict(after);
  const pos = (sections, section, s) => `${section}#${(sections[section] || []).indexOf(s) + 1}`;
  const broken = [], fixed = [];
  for (const c of matchChanges(before, after, trace.review.findings)) {
    const b = c.before ? B.get(pos(before, c.section, c.before)) : null;
    const a = c.after ? A.get(pos(after, c.section, c.after)) : null;
    const refs = [...new Set([c.before, c.after].flatMap((s) => s?.claims || []).flatMap((x) => [x.ref, x.new_ref, x.old_ref]).filter(Boolean))];
    if (a && !a.ok && (!b || b.ok)) broken.push({ section: c.section, text: a.text, reasons: a.reasons, change: c.change, before: b?.text ?? null, findings: c.findings, refs });
    if (b && !b.ok && a && a.ok) fixed.push({ section: c.section, text: b.text, reasons: b.reasons, change: c.change, after: a.text, findings: c.findings });
  }
  const rechecked = [...A.values()].filter((s) => !s.ok).map((s) => key(s.section, s.text)).sort();
  const recorded = (trace.checker?.removed || []).map((s) => key(s.section, s.text)).sort();
  return { broken, fixed, recheck_matches: JSON.stringify(rechecked) === JSON.stringify(recorded) };
}

// One run: { case id: briefEffect } for every brief with a review, read from the run's traces.
export function runEffect(record, dir, root) {
  if (!record.review) return null;
  const F = folders(root), out = {};
  for (const id of Object.keys(record.review)) {
    const f = path.join(dir, record.label, `${id}.trace.json`);
    if (!fs.existsSync(f)) continue;
    const e = briefEffect(JSON.parse(fs.readFileSync(f, "utf8")), loadSources(path.join(root, "data", "cases", F[id] || id)));
    if (e) out[id] = e;
  }
  return out;
}

export const isBroken = (effect, caseId, section, text) => (effect?.[caseId]?.broken || []).find((s) => key(s.section, s.text) === key(section, text)) || null;

// ---------- the command ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(root, "eval", "results-arms"), only = process.argv.slice(2);
  const records = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((r) => r.counted && r.review && (!only.length || only.includes(r.label))).sort((a, b) => a.started_at.localeCompare(b.started_at));
  const byArm = {};
  let mismatch = 0;
  for (const r of records) {
    const eff = runEffect(r, dir, root), t = (byArm[r.arm_name] ||= { runs: 0, briefs: 0, broken: 0, fixed: 0 });
    t.runs++;
    console.log(`${r.label} (${r.arm_name})`);
    for (const [id, e] of Object.entries(eff)) {
      t.briefs++; t.broken += e.broken.length; t.fixed += e.fixed.length;
      if (!e.recheck_matches) { mismatch++; console.log(`  ${id}: the checker run again on the submitted draft does not remove what the run recorded`); }
      for (const s of e.broken) console.log(`  ${id}: broken by review, ${s.section} (${s.change}${s.findings.length ? `, after ${s.findings.join(", ")}` : ", no finding on it"}): "${s.text}" Reason: ${s.reasons.join("; ")}`);
      for (const s of e.fixed) console.log(`  ${id}: fixed by review, ${s.section} (${s.change}${s.findings.length ? `, after ${s.findings.join(", ")}` : ", no finding on it"}): "${s.text}" Reason before review: ${s.reasons.join("; ")}`);
    }
  }
  console.log("");
  for (const [arm, t] of Object.entries(byArm)) console.log(`${arm}: ${t.runs} runs, ${t.briefs} briefs reviewed, ${t.broken} sentences broken by review, ${t.fixed} fixed by review`);
  console.log(mismatch ? `${mismatch} briefs where the checker run again does not match the record` : "The checker run again on every submitted draft removes exactly what each run recorded.");
  process.exitCode = mismatch ? 1 : 0;
}
