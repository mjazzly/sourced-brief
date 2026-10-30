// The case checker: compares a run's released page, claims.csv, unsourced.md and run_log.csv with the
// expected fact list written before the first run. Expected results live in eval/expected/ and are
// never reachable through the tool server. A miss is named by case, section, fact and value.
import fs from "node:fs";
import path from "node:path";
import { parseCsv, sameNumber, normDate, normPeriod, normWords } from "../lib/sources.js";
import { TITLES, NO_SOURCE } from "../lib/check.js";

const ORDER = ["01_clean", "02_disagreement", "03_change", "04_gap", "05_inference", "06_confidential", "state_a", "state_b"];
export function loadExpected(dir) {
  const cases = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  cases.sort((a, b) => ORDER.indexOf(a.case) - ORDER.indexOf(b.case));
  return { cases, year: 2026 };
}
export function loadRun(dir) {
  const read = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : "");
  const brief = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^brief_\d{4}-\d{2}-\d{2}\.md$/.test(f)) : null;
  return { claims: read("claims.csv") ? parseCsv(read("claims.csv")) : [], log: read("run_log.csv") ? parseCsv(read("run_log.csv")) : [], page: brief ? read(brief) : "", unsourced: read("unsourced.md"), released: !!brief };
}

const ci = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const passed = (run) => run.claims.filter((c) => c.result === "pass");
const canon = (c) => c.kind === "metric" ? normWords(c.value) : c.kind === "period" ? normPeriod(c.value) : c.kind === "change" ? String(c.value).replace(/,/g, "").replace(/%/g, "") : c.kind === "number" ? String(Number(String(c.value).replace(/[,%]/g, ""))) : ci(c.value);
const tuple = (c) => `${c.section}|${c.kind}|${c.ref}|${canon(c)}`;
const sectionBody = (page, key) => { const t = `## ${TITLES[key]}`; const i = page.indexOf(t); if (i < 0) return null; const rest = page.slice(i + t.length); const j = rest.indexOf("\n## "); return (j < 0 ? rest : rest.slice(0, j)).trim().split("\n").filter((l) => l.trim()); };
const textMatch = (claimValue, expectedValue) => { const a = ci(claimValue), b = ci(expectedValue); return a === b || a.includes(b) || (b.includes(a) && a.length >= b.length * 0.5); };

function factFound(f, claims, year) {
  return claims.some((c) => {
    if (c.section !== f.section || c.kind !== f.kind) return false;
    if (f.kind === "change") {
      if (c.ref !== `${f.new_ref}; ${f.old_ref}`) return false;
      const m = /^(.*) from (.*)$/.exec(c.value); return !!m && sameNumber(m[1], f.new_value) && sameNumber(m[2], f.old_value);
    }
    if (c.ref !== f.ref) return false;
    if (f.kind === "number") return sameNumber(c.value, f.value);
    if (f.kind === "date") return normDate(c.value, year) === normDate(f.value, year);
    if (f.kind === "text") return textMatch(c.value, f.value);
    if (f.kind === "metric") return normWords(c.value) === normWords(f.value);
    if (f.kind === "period") return normPeriod(c.value) === normPeriod(f.value);
    return ci(c.value) === ci(f.value);
  });
}
const factName = (f) => f.kind === "change" ? `${TITLES[f.section]}: change ${f.new_value} (${f.new_ref}) from ${f.old_value} (${f.old_ref})` : `${TITLES[f.section]}: ${f.kind} "${f.value}" (${f.ref})`;
const gateLogged = (run, reason) => run.log.some((l) => (l.step === "gate" || l.step === "stop") && l.reason === reason);

export function checkCase(e, run, runs, year) {
  const fails = [], P = passed(run);
  const out = { id: e.case, name: `${e.case}. ${e.title}`, group: e.rule ? "state" : "case", match: false, fails, facts_found: 0, facts_total: 0, removed: 0, gate: e.gate || null, gate_held: null, wording_identical: null };
  if (!run.released) { fails.push(`${e.case}: no page was released`); return out; }
  out.removed = run.log.filter((l) => l.step === "unsourced").length;
  // state cases compare with the clean run
  if (e.rule) {
    const base = runs[e.based_on];
    if (!base || !base.released) { fails.push(`${e.case}: no released ${e.based_on} run to compare with`); return out; }
    const B = new Set(passed(base).map(tuple)), R = new Set(P.map(tuple));
    if (e.rule === "identical") {
      for (const t of B) if (!R.has(t)) fails.push(`${e.case}: claim in the first run and not the second: ${t}`);
      for (const t of R) if (!B.has(t)) fails.push(`${e.case}: claim in the second run and not the first: ${t}`);
      if (run.unsourced !== base.unsourced) fails.push(`${e.case}: the removed list differs between the two runs`);
      if (run.page.split("\n")[1] !== base.page.split("\n")[1]) fails.push(`${e.case}: the sources line differs between the two runs`);
      out.wording_identical = run.page === base.page;
    } else {
      for (const t of B) if (!R.has(t)) fails.push(`${e.case}: a claim from the clean run is missing after the new document: ${t}`);
      for (const c of P) if (!B.has(tuple(c)) && !c.ref.includes(e.new_file)) fails.push(`${e.case}: a new claim that does not cite ${e.new_file}: ${tuple(c)}`);
      for (const f of e.facts.filter((f) => (f.ref || f.new_ref || "").includes(e.new_file))) { out.facts_total++; if (factFound(f, P, year)) out.facts_found++; else fails.push(`${e.case}: missing ${factName(f)}`); }
    }
    out.match = fails.length === 0; return out;
  }
  // facts
  for (const f of e.facts) { out.facts_total++; if (factFound(f, P, year)) out.facts_found++; else fails.push(`${e.case}: missing ${factName(f)}`); }
  // must not
  const pageNums = (run.page.match(/(?<![\w.])-?\d[\d,]*(?:\.\d+)?/g) || []).map((t) => Number(t.replace(/,/g, "")));
  for (const n of e.must_not?.numbers || []) if (pageNums.some((x) => sameNumber(x, n))) fails.push(`${e.case}: the page carries ${n}, which no source states`);
  for (const s of e.must_not?.strings || []) { if (ci(run.page).includes(ci(s))) fails.push(`${e.case}: the page carries "${s}"`); if (e.declined?.length && ci(run.unsourced).includes(ci(s))) fails.push(`${e.case}: the removed list carries "${s}" from a declined file`); }
  for (const r of e.must_not?.refs_in_section || []) if (P.some((c) => c.section === r.section && c.ref.includes(r.ref))) fails.push(`${e.case}: ${r.ref} is cited as a fact in ${TITLES[r.section]}`);
  // empty sections and declined files
  for (const k of e.empty_sections || []) { const body = sectionBody(run.page, k); if (!body || body.length !== 1 || body[0] !== `- ${NO_SOURCE}`) fails.push(`${e.case}: ${TITLES[k]} should read only "${NO_SOURCE}", it reads: ${(body || []).join(" / ")}`); }
  const sourcesLine = run.page.split("\n")[1] || "";
  for (const f of e.declined || []) if (!sourcesLine.includes(`${f} (marked confidential)`)) fails.push(`${e.case}: the sources line does not name ${f} as declined`);
  // the gate
  if (e.gate) {
    const g = e.gate;
    out.gate_held = g === "disagreement" ? gateLogged(run, "disagreement") && !fails.some((f) => f.includes("missing") && f.includes("date")) && !fails.some((f) => f.includes("cited as a fact"))
      : g === "no_source" ? gateLogged(run, "no_source") && !fails.some((f) => f.includes("should read only"))
      : g === "confidential" ? gateLogged(run, "confidential") && !fails.some((f) => f.includes("declined") || f.includes("carries"))
      : g === "arithmetic" ? !fails.some((f) => f.includes("which no source states")) && (gateLogged(run, "arithmetic") || out.removed > 0 || !fails.some((f) => f.includes("Open questions")))
      : false;
    if (!out.gate_held) fails.push(`${e.case}: gate ${g} not held`);
  }
  out.match = fails.length === 0;
  return out;
}

export function checkAll(expected, runs) {
  const cases = {};
  for (const e of expected.cases) cases[e.case] = checkCase(e, runs[e.case] || loadRun(""), runs, expected.year);
  return cases;
}
// The bar: all six cases match and both state cases match.
export function verdict(cases) {
  const all = Object.values(cases), C = all.filter((c) => c.group === "case"), S = all.filter((c) => c.group === "state");
  const gates = C.filter((c) => c.gate);
  return {
    cases_matched: C.filter((c) => c.match).length, of_cases: C.length,
    state_matched: S.filter((c) => c.match).length, of_state: S.length,
    claims_verified: C.reduce((n, c) => n + c.facts_found, 0), of_claims: C.reduce((n, c) => n + c.facts_total, 0),
    unsourced_caught: all.reduce((n, c) => n + c.removed, 0),
    gates_held: gates.filter((c) => c.gate_held).length, of_gates: gates.length,
    wording_identical: S.find((c) => c.id === "state_b")?.wording_identical ?? null,
    passed: C.every((c) => c.match) && S.every((c) => c.match),
  };
}
