// The claim checker. Every sentence the model drafts carries one or more claims, each with a source
// reference; this file tests each claim against the source and then tests the sentence itself: every
// number, date, action id and name in the text must be covered by a claim, and every claimed value
// must appear in the text. A sentence that fails on any count is removed from the page and listed
// with the reason. Runs inside the server at release time and inside the eval; never reads the
// expected results.
import { resolveRef, refIsBracket, findDates, normDate, numberTokens, wordTokens, wordValue, periodDigitTokens, sameNumber, normPeriod, normWords, ACTION_ID_RE, NAME_RE, ID_TOKEN_RE } from "./sources.js";

export const SECTIONS = ["what_moved", "what_is_due", "what_changed", "decisions", "open_questions"];
export const TITLES = { what_moved: "What moved", what_is_due: "What is due", what_changed: "What changed in the numbers", decisions: "What needs a decision", open_questions: "Open questions" };
export const KINDS = ["number", "text", "owner", "status", "date", "period", "metric", "run_id", "change"];
export const NO_SOURCE = "No source this week.";

const ci = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const includesCi = (hay, needle) => ci(needle) !== "" && ci(hay).includes(ci(needle));
const ISO = /\b\d{4}-\d{2}-\d{2}(?:T[\d:]+)?\b/g;
const stripDates = (s) => String(s).replace(ISO, " ");
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NUMBER_WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/gi;
const looksNumeric = (v) => /^-?[\d,]+(?:\.\d+)?%?$/.test(String(v).trim());

// The numbers a csv row offers to a number claim. An answer block offers its value and the rows it
// was computed over; any other row offers every number outside its ids, run ids and timestamps.
function rowNumbers(file, row) {
  const toks = (t) => { let x = String(t || ""); for (const d of findDates(x, 2026)) x = x.replace(d.raw, " "); x = stripDates(x).replace(ID_TOKEN_RE, " "); return [...numberTokens(x), ...wordTokens(x), ...periodDigitTokens(x)].map((k) => k.value); };
  if (file.name === "answers.csv") return [row.value, row.rows_over].filter((v) => v !== "" && v != null).map(Number).concat(toks(row.lineage));
  if (file.name === "tracker.csv") return toks(row.action);   // an action's own numbers; never a date, a due note or a line number
  const skip = new Set(["run_id", "at", "time", "added_run", "closed_run", "answer_id", "record_id", "action_id", "transcript", "source_line", "__line"]);
  return Object.entries(row).filter(([k]) => !skip.has(k)).flatMap(([, v]) => toks(v));
}

// Document lines that give a different date for the same action id. A date on the same line as an
// action id is read as that action's date.
function disagreements(sources, actionId, due) {
  const out = [];
  for (const f of Object.values(sources.files)) {
    if (f.kind !== "md" || f.declined) continue;
    f.lines.forEach((line, i) => {
      if (!new RegExp(`\\b${actionId}\\b`).test(line)) return;
      for (const d of findDates(line, sources.year)) if (d.iso !== due) out.push({ ref: `${f.name} line ${i + 1}`, iso: d.iso, raw: d.raw });
    });
  }
  return out;
}

const ok = (covered, refs) => ({ ok: true, covered, refs });
const bad = (reason, refs = []) => ({ ok: false, reason, refs });

// One claim against its source. `sentence` is the whole sentence (for the disagreement rule, which
// needs the other claims in it).
export function checkClaim(c, sources, sentence) {
  if (!c || typeof c !== "object") return bad("claim is not an object");
  if (!KINDS.includes(c.kind)) return bad(`claim kind "${c.kind}" is not one of ${KINDS.join(", ")}`);
  if (c.kind === "change") {
    const n = resolveRef(sources, c.new_ref), o = resolveRef(sources, c.old_ref);
    if (n.error) return bad(`new_ref: ${n.error}`); if (o.error) return bad(`old_ref: ${o.error}`);
    if (c.new_value == null || c.old_value == null) return bad("a change claim needs new_value and old_value");
    const nn = n.row ? rowNumbers(n.file, n.row) : numberTokens(stripDates(n.text)).map((t) => t.value);
    const on = o.row ? rowNumbers(o.file, o.row) : numberTokens(stripDates(o.text)).map((t) => t.value);
    if (!nn.some((x) => sameNumber(x, c.new_value))) return bad(`${n.ref} does not hold the number ${c.new_value}${n.file.name === "answers.csv" ? ` (its value is ${n.row.value})` : ""}`, [n.ref, o.ref]);
    if (!on.some((x) => sameNumber(x, c.old_value))) return bad(`${o.ref} does not hold the number ${c.old_value}`, [n.ref, o.ref]);
    if (c.metric != null && n.row && n.file.name === "answers.csv" && normWords(c.metric) !== normWords(n.row.metric)) return bad(`${n.ref} is the metric ${n.row.metric}, not ${c.metric}`, [n.ref, o.ref]);
    return ok([c.new_value, c.old_value, ...(c.metric ? [c.metric] : [])], [n.ref, o.ref]);
  }
  const r = resolveRef(sources, c.ref);
  if (r.error) return bad(r.error);
  const v = c.value;
  if (v == null || String(v).trim() === "") return bad(`${c.kind} claim on ${r.ref} has no value`, [r.ref]);
  const refs = [r.ref];
  const tracker = () => (r.file.name === "tracker.csv" && r.row ? r.row : null);
  const answer = () => (r.file.name === "answers.csv" && r.row ? r.row : null);
  switch (c.kind) {
    case "number": {
      const lineNums = (t) => [...numberTokens(stripDates(t)), ...wordTokens(t), ...periodDigitTokens(t)].map((x) => x.value);
      const nums = r.row ? rowNumbers(r.file, r.row) : lineNums(r.text);
      const n = looksNumeric(v) ? v : wordValue(v);
      if (n == null) return bad(`"${v}" is not a number`, refs);
      if (!nums.some((x) => sameNumber(x, n))) return bad(`${r.ref} does not hold the number ${v}${answer() ? ` (its value is ${r.row.value})` : ""}`, refs);
      return ok([v], refs);
    }
    case "text":
      if (!includesCi(r.text, v)) return bad(`"${v}" does not appear in ${r.ref}`, refs);
      return ok([v], refs);
    case "owner": {
      const t = tracker(); if (!t) return bad("an owner claim must reference a tracker row", refs);
      if (ci(t.owner) !== ci(v)) return bad(`${r.ref} names the owner as "${t.owner}", not "${v}"`, refs);
      return ok([v], refs);
    }
    case "status": {
      const t = tracker(); if (!t) return bad("a status claim must reference a tracker row", refs);
      const s = ci(v);
      if (s === "closed this week") {
        if (t.status !== "closed") return bad(`${r.ref} is ${t.status}, not closed`, refs);
        if (t.closed_run !== sources.latestRun) return bad(`${r.ref} was closed in run ${t.closed_run}, not this week (${sources.latestRun})`, refs);
      } else if (s === "open" || s === "closed") { if (t.status !== s) return bad(`${r.ref} is ${t.status}, not ${s}`, refs); }
      else return bad(`status must be "open", "closed" or "closed this week", not "${v}"`, refs);
      return ok([v], refs);
    }
    case "date": {
      const iso = normDate(v, sources.year);
      if (!iso) return bad(`"${v}" is not one date`, refs);
      const others = (sentence?.claims || []).filter((x) => x !== c && x.kind === "date");
      const t = tracker();
      if (t) {
        if (t.due !== iso) return bad(`${r.ref} is due ${t.due}, not ${iso}`, refs);
        const dis = disagreements(sources, t.action_id, t.due);
        const uncited = dis.filter((d) => !others.some((x) => resolveRef(sources, x.ref).ref === d.ref && normDate(x.value, sources.year) === d.iso));
        if (uncited.length) return { ...bad(`disagreement: ${r.ref} says ${t.due} and ${uncited[0].ref} says ${uncited[0].iso}; a sentence must cite both or neither`, refs), gate: "disagreement", detail: `${r.ref} ${t.due} against ${uncited[0].ref} ${uncited[0].iso}` };
        return ok([v], refs);
      }
      if (r.file.name === "answers.csv") return bad("a date claim cannot reference an answer block", refs);
      const ds = findDates(r.text, sources.year);
      if (!ds.some((d) => d.iso === iso)) return bad(`${r.ref} does not hold the date ${iso}`, refs);
      const tr = sources.files["tracker.csv"];
      for (const id of new Set(String(r.text).match(ACTION_ID_RE) || [])) {
        const row = tr && !tr.declined ? tr.byId[id] : null;
        if (!row || !row.due || row.due === iso) continue;
        const cited = others.some((x) => resolveRef(sources, x.ref).ref === `tracker.csv ${id}` && normDate(x.value, sources.year) === row.due);
        if (!cited) return { ...bad(`disagreement: ${r.ref} says ${iso} for ${id} and tracker.csv ${id} says ${row.due}; a sentence must cite both or neither`, refs), gate: "disagreement", detail: `${r.ref} ${iso} against tracker.csv ${id} ${row.due}` };
      }
      return ok([v], refs);
    }
    case "period": {
      const a = answer(); if (!a) return bad("a period claim must reference an answer block", refs);
      if (normPeriod(v) !== normPeriod(a.period)) return bad(`${r.ref} covers ${a.period}, not ${v}`, refs);
      return ok([v], refs);
    }
    case "metric": {
      const a = answer(); if (!a) return bad("a metric claim must reference an answer block", refs);
      if (normWords(v) !== normWords(a.metric)) return bad(`${r.ref} is the metric ${a.metric}, not "${v}"`, refs);
      return ok([v], refs);
    }
    case "run_id": {
      const a = answer(); if (!a) return bad("a run_id claim must reference an answer block", refs);
      if (String(v) !== a.answer_id) return bad(`${r.ref} is answer ${a.answer_id}, not ${v}`, refs);
      return ok([v], refs);
    }
  }
  return bad(`claim kind "${c.kind}" is not checked`, refs);
}

// Everything in the text that must be covered by a claim, after the covered strings are removed.
function uncovered(text, covered, refs, year) {
  let s = String(text).replace(refIsBracket, " ");
  for (const r of refs) { const id = r.split(/\s+/)[1]; if (id && id !== "line") s = s.split(id).join(" "); }
  const left = [];
  // ids first (run ids, answer ids), so a claimed number never eats into one
  for (const m of s.match(ID_TOKEN_RE) || []) if (!covered.some((v) => String(v) === m)) left.push(`id ${m}`);
  s = s.replace(ID_TOKEN_RE, " ");
  const cut = (t) => { s = s.slice(0, t.index) + " ".repeat(t.raw.length) + s.slice(t.index + t.raw.length); };
  for (const v of covered) {
    const str = String(v);
    if (ci(str) === "not stated") { s = s.replace(new RegExp(NO_OWNER.source, "gi"), " "); continue; }
    const num = looksNumeric(str) ? str : wordValue(str);
    if (num != null) { const t = [...numberTokens(s), ...wordTokens(s), ...periodDigitTokens(s)].find((x) => sameNumber(x.value, num)); if (t) cut(t); continue; }
    const iso = normDate(str, year);
    if (iso) { const d = findDates(s, year).find((x) => x.iso === iso); if (d) cut(d); }
    s = s.replace(new RegExp(escapeRe(str).replace(/\s+/g, "\\s+"), "gi"), " ");
  }
  for (const d of findDates(s, year)) { left.push(`date ${d.raw}`); s = s.replace(d.raw, " "); }
  for (const id of new Set(s.match(ACTION_ID_RE) || [])) left.push(`action id ${id}`);
  s = s.replace(ACTION_ID_RE, " ");
  for (const t of numberTokens(s)) left.push(`number ${t.raw}`);
  for (const m of s.matchAll(NUMBER_WORDS)) left.push(`number word ${m[0]}`);
  for (const m of s.matchAll(NAME_RE)) left.push(`name ${m[0]}`);
  return left;
}

const NO_OWNER = /\b(owner not stated|not stated|no owner(?: stated| named| given)?|no named owner)\b/i;
function valueInText(kind, v, text, year) {
  if (kind === "owner" && ci(v) === "not stated") return NO_OWNER.test(text);
  const n = looksNumeric(v) ? v : wordValue(v);
  if (n != null && (kind === "number" || looksNumeric(v))) return [...numberTokens(text), ...wordTokens(text), ...periodDigitTokens(text)].some((t) => sameNumber(t.value, n));
  const iso = kind === "date" ? normDate(v, year) : null;
  if (iso && findDates(text, year).some((d) => d.iso === iso)) return true;
  return includesCi(text, v);
}

// One sentence: its claims, its coverage, its verdict.
export function checkSentence(section, n, s, sources) {
  const text = String(s?.text ?? "").replace(refIsBracket, " ").replace(/\s+/g, " ").trim();
  const out = { section, n, text, claims: [], refs: [], ok: true, reasons: [], gates: [] };
  const claims = Array.isArray(s?.claims) ? s.claims : [];
  if (!text) { out.ok = false; out.reasons.push("empty sentence"); return out; }
  if (!claims.length) { out.ok = false; out.reasons.push("no source: the sentence carries no claim"); return out; }
  const covered = [];
  for (const c of claims) {
    const r = checkClaim(c, sources, { claims });
    const rec = { kind: c.kind, ref: c.kind === "change" ? `${c.new_ref}; ${c.old_ref}` : c.ref, value: c.kind === "change" ? `${c.new_value} from ${c.old_value}` : c.value, ok: r.ok, reason: r.ok ? "" : r.reason };
    out.claims.push(rec);
    for (const ref of r.refs || []) if (!out.refs.includes(ref)) out.refs.push(ref);
    if (!r.ok) { out.ok = false; out.reasons.push(r.reason); if (r.gate) out.gates.push({ gate: r.gate, detail: r.detail }); continue; }
    const values = c.kind === "change" ? [c.new_value, c.old_value] : [c.value];
    for (const v of values) if (!valueInText(c.kind, v, text, sources.year)) { out.ok = false; rec.ok = false; rec.reason = `the sentence does not carry the claimed value "${v}"`; out.reasons.push(rec.reason); }
    covered.push(...r.covered);
  }
  if (out.ok) {
    const left = uncovered(text, covered, out.refs, sources.year);
    if (left.length) { out.ok = false; out.reasons.push(`unsourced: ${left.join(", ")} (no claim covers it)`); }
  }
  return out;
}

// The whole draft: five sections, each a list of sentences. Returns the checked sentences in order.
export function checkDraft(sections, sources) {
  if (!sections || typeof sections !== "object") throw new Error("sections must be an object with the five section keys");
  const missing = SECTIONS.filter((k) => !(k in sections));
  if (missing.length) throw new Error(`sections missing: ${missing.join(", ")}. Every section is required; pass [] for a section with no source this week`);
  const extra = Object.keys(sections).filter((k) => !SECTIONS.includes(k));
  if (extra.length) throw new Error(`unknown sections: ${extra.join(", ")}`);
  const out = [];
  for (const k of SECTIONS) {
    const list = sections[k];
    if (!Array.isArray(list)) throw new Error(`section ${k} must be a list of sentences`);
    list.forEach((s, i) => out.push(checkSentence(k, i + 1, s, sources)));
  }
  return out;
}
