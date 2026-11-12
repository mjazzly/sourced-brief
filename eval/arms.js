// The WORK-09 arms: how each arm's instructions and harness tools are built, the change matcher
// and the trace. The design and every word the agents get are in WORK-09-DESIGN.md; the words
// themselves live in arms/ and reach the agents only through this file.
//
//   one       A1 (smallest model) or the ceiling (largest model): skill/SKILL.md v1.3, untouched
//   review    A2: one agent reviews its own draft with the checklist, records it with record_review
//   reviewer  B: the drafter calls review_draft once; a reviewer agent in a fresh conversation
//             goes through the same checklist and returns findings with return_findings
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SECTIONS, TITLES } from "../lib/check.js";

export const ARMS = ["one", "review", "reviewer"];
export const REVIEWER_MAX_CALLS = 15;
export const SMALLEST = "claude-haiku-5-5";
export const LARGEST = "claude-opus-5-5";
// The runs each arm gets before the verdict rule is applied (WORK-09-DESIGN.md, decision 2).
export const PLANNED = { A1: 5, A2: 5, B: 5, Ceiling: 3 };

export function armName(arm, model, effort) {
  if (arm === "one" && model === SMALLEST && !effort) return "A1";
  if (arm === "one" && model === LARGEST && effort === "high") return "Ceiling";
  if (arm === "review" && model === SMALLEST && !effort) return "A2";
  if (arm === "reviewer" && model === SMALLEST && !effort) return "B";
  if (model && String(model).startsWith("mock")) return { one: "A1", review: "A2", reviewer: "B" }[arm];
  return `${arm} on ${model}${effort ? ` ${effort}` : ""}`;
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

// ---------- instructions ----------
function steps(file) {
  const t = fs.readFileSync(file, "utf8");
  const m = /^@@tool\n([\s\S]*?)\n@@step\n([\s\S]*?)\n?$/.exec(t);
  if (!m) throw new Error(`${file}: expected @@tool and @@step parts`);
  return { tool: m[1].trim(), step: m[2].trim() };
}
function replaceOnce(text, find, by, what) {
  const i = text.indexOf(find);
  if (i < 0 || text.indexOf(find, i + 1) >= 0) throw new Error(`building the arm skill: ${what} not found exactly once in skill/SKILL.md`);
  return text.slice(0, i) + by + text.slice(i + find.length);
}
// The drafter's instructions for an arm, built from skill/SKILL.md (the body, frontmatter removed).
export function loadArm(arm, root, skillBody, skillVersion) {
  if (!ARMS.includes(arm)) throw new Error(`--arm must be one of ${ARMS.join(", ")}`);
  const checklist = fs.readFileSync(path.join(root, "arms", "checklist.md"), "utf8");
  const reviewerText = fs.readFileSync(path.join(root, "arms", "reviewer.md"), "utf8");
  const out = { arm, checklist, checklistSha: sha(checklist), reviewerSha: null, reviewerSystem: null, drafterTools: [] };
  if (arm === "one") return { ...out, system: skillBody, skillVersion, checklistSha: null };
  const s = steps(path.join(root, "arms", `${arm}_step.md`));
  let body = skillBody;
  body = replaceOnce(body, `Version: ${skillVersion},`, `Version: ${skillVersion}-${arm},`, "the version line");
  const draftBullet = /^- `draft_brief\(sections\)`:.*$/m.exec(body);
  if (!draftBullet) throw new Error("building the arm skill: the draft_brief tool bullet was not found");
  body = replaceOnce(body, draftBullet[0], `${draftBullet[0]}\n${s.tool}`, "the draft_brief tool bullet");
  const step5 = /^5\. \*\*Call `stop` where a gate applies\*\*.*$/m.exec(body);
  if (!step5) throw new Error("building the arm skill: step 5 was not found");
  body = replaceOnce(body, step5[0], s.step, "step 5");
  body = `${body.trimEnd()}\n\n${checklist.trimEnd()}`;
  out.system = body; out.skillVersion = `${skillVersion}-${arm}`;
  if (arm === "review") out.drafterTools = [RECORD_REVIEW];
  if (arm === "reviewer") {
    out.drafterTools = [REVIEW_DRAFT];
    if (!reviewerText.includes("{{CHECKLIST}}")) throw new Error("arms/reviewer.md has no {{CHECKLIST}} marker");
    out.reviewerSystem = reviewerText.replace("{{CHECKLIST}}", checklist.trimEnd()).trimEnd();
    out.reviewerSha = sha(reviewerText);
  }
  return out;
}

// The checks the mock runs: every copied table row and example line in arms/reviewer.md is in
// skill/SKILL.md word for word, and the checklist bytes sit unchanged in every place they go.
export function checkCopies(root, skillBody, skillVersion) {
  const fails = [];
  const reviewer = fs.readFileSync(path.join(root, "arms", "reviewer.md"), "utf8");
  const skillLines = new Set(skillBody.split("\n"));
  const copied = reviewer.split("\n").filter((l) => /^\|/.test(l) || /^\{ "text"/.test(l) || /^\s+"claims"/.test(l) || /^\s+\{ "kind"/.test(l));
  for (const l of copied) if (!skillLines.has(l)) fails.push(`arms/reviewer.md carries a line that differs from skill/SKILL.md: ${l.slice(0, 100)}`);
  if (copied.length < 30) fails.push(`arms/reviewer.md: only ${copied.length} copied lines found; expected the three tables and four examples`);
  const checklist = fs.readFileSync(path.join(root, "arms", "checklist.md"), "utf8").trimEnd();
  const a2 = loadArm("review", root, skillBody, skillVersion), b = loadArm("reviewer", root, skillBody, skillVersion);
  for (const [name, text] of [["A2 drafter", a2.system], ["B drafter", b.system], ["B reviewer", b.reviewerSystem]]) if (!text.includes(checklist)) fails.push(`the checklist is not carried whole in the ${name}'s instructions`);
  // A2 and B drafters differ in the version tag, the tool bullet and step 5 only.
  const strip = (t, arm) => { const s = steps(path.join(root, "arms", `${arm}_step.md`)); return t.replace(`-${arm},`, ",").replace(`\n${s.tool}`, "").replace(s.step, "<step 5>"); };
  if (strip(a2.system, "review") !== strip(b.system, "reviewer")) fails.push("the A2 and B drafter instructions differ outside the version tag, the tool bullet and step 5");
  return fails;
}

// ---------- harness tools ----------
const sentenceSchema = { type: "object", properties: { text: { type: "string" }, claims: { type: "array", items: { type: "object" } } }, required: ["text", "claims"] };
const sectionsSchema = { type: "object", properties: Object.fromEntries(SECTIONS.map((k) => [k, { type: "array", items: sentenceSchema }])), required: SECTIONS, description: "the whole draft: the five section keys, each a list of sentences with their claims, as draft_brief takes it" };
const findingSchema = { type: "object", properties: { section: { type: "string", enum: SECTIONS }, sentence: { type: "string" }, fault: { type: "string" }, fix: { type: "string" } }, required: ["section", "sentence", "fault", "fix"] };
export const RECORD_REVIEW = { name: "record_review", description: "Puts your draft as it stood before the review, and your review findings, on the record before the submission. Call it once, after the review and before draft_brief. It returns a short receipt and checks nothing.", input_schema: { type: "object", properties: { sections: sectionsSchema, findings: { type: "array", items: findingSchema, description: "every finding, each with section, sentence, fault and fix as the checklist gives them; [] when every sentence passes" } }, required: ["sections", "findings"] } };
export const REVIEW_DRAFT = { name: "review_draft", description: "Sends your whole draft to a reviewer, an agent that reads the same sources, goes through the review checklist on your draft and returns its findings (section, sentence, fault, fix). The reviewer writes no sentences and cannot submit. Call it once, before draft_brief; a second call is refused.", input_schema: { type: "object", properties: { sections: sectionsSchema }, required: ["sections"] } };
export const RETURN_FINDINGS = { name: "return_findings", description: "Returns your findings to the drafter and ends the review. Call it once, last. findings is a list; each finding has section, sentence, fault and fix as the checklist gives them. Pass [] when every sentence passes.", input_schema: { type: "object", properties: { findings: { type: "array", items: findingSchema } }, required: ["findings"] } };

const asObject = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
export function readSections(v) {
  const s = asObject(v);
  if (!s || typeof s !== "object" || Array.isArray(s)) return { error: "sections must be an object with the five section keys" };
  const missing = SECTIONS.filter((k) => !Array.isArray(s[k]));
  if (missing.length) return { error: `sections is missing ${missing.join(", ")} (each a list; [] for a section with nothing to cite)` };
  return { sections: s };
}
export function readFindings(v) {
  const f = asObject(v);
  if (!Array.isArray(f)) return { error: "findings must be a list ([] when every sentence passes)" };
  for (const [i, x] of f.entries()) {
    if (!x || typeof x !== "object") return { error: `finding ${i + 1} is not an object` };
    for (const k of ["section", "sentence", "fault", "fix"]) if (typeof x[k] !== "string" || !x[k].trim()) return { error: `finding ${i + 1} has no ${k}` };
    if (!SECTIONS.includes(x.section)) return { error: `finding ${i + 1}: section must be one of ${SECTIONS.join(", ")}` };
  }
  return { findings: f.map((x, i) => ({ id: `F${i + 1}`, section: x.section, sentence: x.sentence, fault: x.fault, fix: x.fix })) };
}

// ---------- what the drafter changed after the review ----------
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function matchChanges(before, after, findings) {
  const changes = [];
  for (const k of SECTIONS) {
    const B = before?.[k] || [], A = after?.[k] || [], usedA = new Set(), pairs = [];
    B.forEach((b, i) => { const j = A.findIndex((a, jj) => !usedA.has(jj) && a?.text === b?.text); if (j >= 0) { usedA.add(j); pairs[i] = j; } });
    const freeA = A.map((_, j) => j).filter((j) => !usedA.has(j));
    B.forEach((b, i) => { if (pairs[i] == null && freeA.length) pairs[i] = freeA.shift(); });
    B.forEach((b, i) => {
      const a = pairs[i] == null ? null : A[pairs[i]];
      changes.push({ section: k, before: b, after: a, change: a == null ? "dropped" : same(a, b) ? "kept" : "changed", findings: [] });
    });
    for (const j of freeA) changes.push({ section: k, before: null, after: A[j], change: "added", findings: [] });
  }
  for (const f of findings || []) {
    const c = changes.find((c) => c.section === f.section && c.before && c.before.text === f.sentence);
    if (c) { c.findings.push(f.id); f.outcome = c.change; }
    else if (/^missing$/i.test(f.sentence.trim())) f.outcome = changes.some((c) => c.section === f.section && c.change === "added") ? "added" : "none";
    else f.outcome = "unmatched";
  }
  return changes;
}

// ---------- the trace ----------
export function removedFrom(draftResultText) {
  try {
    const r = JSON.parse(draftResultText);
    const key = (title) => Object.keys(TITLES).find((k) => TITLES[k] === title) || title;
    return { released: r.sentences_released, removed: (r.removed || []).map((s) => ({ section: key(s.section), text: s.text, reasons: s.reasons })), page: r.page };
  } catch { return null; }
}
export function buildTrace({ label, arm, armLabel, caseId, title, drafterModel, reviewerModel, drafterVersion, reviewerSha, brief, result, page }) {
  const t = brief.totals;
  return {
    label, arm, arm_name: armLabel, case: caseId, title,
    agents: { drafter: { model: drafterModel, instructions: drafterVersion }, ...(reviewerModel ? { reviewer: { model: reviewerModel, instructions: `arms/reviewer.md ${reviewerSha}` } } : {}) },
    steps: brief.steps,
    review: brief.review,
    submitted: brief.submitted || null,
    checker: brief.checker ? { released: brief.checker.released, removed: brief.checker.removed, page: brief.checker.page || page } : { released: 0, removed: [], page: page || "" },
    result: result ? { match: result.match, facts_found: result.facts_found, facts_total: result.facts_total, fails: result.fails, gate: result.gate, gate_held: result.gate_held } : null,
    totals: { model_calls: t.calls, tokens_in: t.tokens_in, tokens_out: t.tokens_out, cost_usd: t.cost_usd, seconds: Math.round(brief.seconds * 10) / 10 },
  };
}
export const sectionsCount = (s) => SECTIONS.reduce((n, k) => n + (s?.[k]?.length || 0), 0);
