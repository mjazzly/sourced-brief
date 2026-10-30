// The state and the rules behind the tools. The model reaches this file only through server.js.
// The week folder holds the six inputs; the server writes four files beside them:
//   brief_<week>.md   the released page: every sentence that passed, with its references
//   unsourced.md      every sentence removed, with the reason
//   claims.csv        every claim checked: section, sentence, kind, reference, value, result, reason
//   run_log.csv       one line per step: load, declined, read, stop, draft, gate, unsourced, release
import fs from "node:fs";
import path from "node:path";
import { loadSources, esc } from "./sources.js";
import { checkDraft, SECTIONS, TITLES, NO_SOURCE } from "./check.js";

const LOG_COLS = ["time", "run_id", "case_id", "step", "reason", "detail"];
const CLAIM_COLS = ["run_id", "case_id", "section", "sentence", "claim", "kind", "ref", "value", "result", "reason"];
export const STOP_REASONS = ["disagreement", "no_source", "confidential", "arithmetic"];
const now = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); };

export class Store {
  static async open(dir, runId) {
    const s = new Store(dir, runId);
    s.sources = loadSources(dir);
    if (!fs.existsSync(s.logPath)) fs.writeFileSync(s.logPath, LOG_COLS.join(",") + "\n");
    if (!fs.existsSync(s.claimsPath)) fs.writeFileSync(s.claimsPath, CLAIM_COLS.join(",") + "\n");
    s.log("load", "", `${s.sources.read.length} sources read, ${s.sources.declined.length} declined; week ending ${s.sources.weekEnding}, latest tracker run ${s.sources.latestRun}`);
    for (const f of s.sources.declined) s.log("gate", "confidential", `${f} declined: its first line is marked confidential; nothing past that line was read`);
    return s;
  }
  constructor(dir, runId) {
    this.dir = dir; this.runId = runId; this.caseId = "";
    this.logPath = path.join(dir, "run_log.csv"); this.claimsPath = path.join(dir, "claims.csv");
  }
  get pagePath() { return path.join(this.dir, `brief_${this.sources.weekEnding}.md`); }
  get released() { return fs.existsSync(this.pagePath); }
  log(step, reason, detail) { fs.appendFileSync(this.logPath, [now(), this.runId, this.caseId, step, reason, detail].map(esc).join(",") + "\n"); }

  setCase(caseId) { this.caseId = String(caseId || ""); return { status: "OK", case_id: this.caseId }; }

  listSources() {
    const files = Object.values(this.sources.files).map((f) => f.declined
      ? { file: f.name, status: "DECLINED", reason: "its first line is marked confidential; nothing from it can be read or cited" }
      : { file: f.name, status: "READABLE", referenced_by: f.byId ? Object.keys(f.byId).length ? `${f.name} <${Object.keys(f.rows[0] || {})[0]}>` : "id" : `${f.name} line N`, lines: f.lineCount, rows: f.kind === "csv" ? f.rows.length : undefined });
    return { week_ending: this.sources.weekEnding, latest_tracker_run: this.sources.latestRun, sources: files, released: this.released, note: "A reference is written one way per file: tracker.csv by action id (tracker.csv A007), answers.csv by answer id (answers.csv D202610300900-Q03), every other file by line number (project_note.md line 9). Line numbers count from the first line of the file, blank lines included." };
  }

  readSource(file) {
    const f = this.sources.files[file];
    if (!f) throw new Error(`${file} is not in the week folder; list_sources names the files`);
    if (f.declined) { this.log("declined", "confidential", `${file} asked for and refused`); return { status: "DECLINED", file, reason: "its first line is marked confidential; nothing from it can be read or cited. Name it as declined on the page." }; }
    this.log("read", "", file);
    if (f.byId) {
      const idc = Object.keys(f.rows[0] || {})[0];
      return { file, referenced_by: `${file} <${idc}>`, rows: f.rows.map((r) => { const { __line, ...rest } = r; return { ref: `${file} ${r[idc]}`, ...rest }; }) };
    }
    return { file, referenced_by: `${file} line N`, lines: f.lines.map((l, i) => `${i + 1}: ${l}`) };
  }

  stop(reason, text) {
    if (!STOP_REASONS.includes(reason)) throw new Error(`reason must be one of ${STOP_REASONS.join(", ")}`);
    this.log("stop", reason, text);
    const next = {
      disagreement: "Carry both values with both references in What needs a decision, and give neither as a fact anywhere else on the page. Ask the reader only if the brief cannot be written without choosing.",
      no_source: "Pass [] for that section in draft_brief; the page will read \"No source this week.\" there. Write nothing into it.",
      confidential: "Do not cite the file. The sources line of the page names it as declined.",
      arithmetic: "Give the inputs with their references and say that no source states the derived number. Do not compute it.",
    }[reason];
    return { status: "STOPPED", reason, recorded: text, next };
  }

  draftBrief(sections) {
    if (this.released) throw new Error(`the brief for the week ending ${this.sources.weekEnding} is already released (${path.basename(this.pagePath)}); one draft per week`);
    const checked = checkDraft(sections, this.sources);   // throws on a malformed draft; nothing is written then
    this.log("draft", "", `${checked.length} sentences, ${checked.reduce((n, s) => n + s.claims.length, 0)} claims`);
    const released = checked.filter((s) => s.ok), removed = checked.filter((s) => !s.ok);
    // claims
    const lines = [];
    for (const s of checked) s.claims.forEach((c, i) => lines.push([this.runId, this.caseId, s.section, s.n, i + 1, c.kind, c.ref, c.value, s.ok ? "pass" : c.ok ? "removed with sentence" : "fail", c.reason].map(esc).join(",")));
    fs.appendFileSync(this.claimsPath, lines.join("\n") + (lines.length ? "\n" : ""));
    // gates and removals
    for (const s of removed) {
      for (const g of s.gates) this.log("gate", g.gate, g.detail);
      const why = s.reasons[0].startsWith("unsourced") ? "unsourced" : s.reasons[0].startsWith("no source") ? "no source" : s.reasons[0].startsWith("disagreement") ? "disagreement" : "claim failed";
      this.log("unsourced", why, `[${s.section}] ${s.text}: ${s.reasons.join(" | ")}`);
    }
    const empty = SECTIONS.filter((k) => !released.some((s) => s.section === k));
    for (const k of empty) this.log("gate", "no_source", `${TITLES[k]}: no sentence with a source this week`);
    // the page
    const L = [`# Weekly brief, week ending ${this.sources.weekEnding}`, `Sources read: ${this.sources.read.join(", ")}. Declined: ${this.sources.declined.length ? this.sources.declined.map((f) => `${f} (marked confidential)`).join(", ") : "none"}.`, ""];
    for (const k of SECTIONS) {
      L.push(`## ${TITLES[k]}`);
      const ss = released.filter((s) => s.section === k);
      if (!ss.length) L.push(`- ${NO_SOURCE}`); else for (const s of ss) L.push(`- ${s.text} [${s.refs.join("; ")}]`);
      L.push("");
    }
    L.push(removed.length ? `Removed: ${removed.length} sentence${removed.length === 1 ? "" : "s"} without a source, listed in unsourced.md.` : "Removed: none.");
    fs.writeFileSync(this.pagePath, L.join("\n") + "\n");
    const U = [`# Removed from the brief, week ending ${this.sources.weekEnding}`, ""];
    if (!removed.length) U.push("Nothing was removed."); else for (const s of removed) { U.push(`- [${TITLES[s.section]}] ${s.text}`); for (const r of s.reasons) U.push(`  ${r}`); }
    fs.writeFileSync(path.join(this.dir, "unsourced.md"), U.join("\n") + "\n");
    this.log("release", "", `${released.length} sentences released, ${removed.length} removed, ${empty.length} sections with no source`);
    return {
      status: "RELEASED", page_file: path.basename(this.pagePath), week_ending: this.sources.weekEnding,
      sentences_released: released.length, sentences_removed: removed.length, sections_with_no_source: empty.map((k) => TITLES[k]),
      claims_checked: checked.reduce((n, s) => n + s.claims.length, 0), claims_passed: released.reduce((n, s) => n + s.claims.length, 0),
      removed: removed.map((s) => ({ section: TITLES[s.section], text: s.text, reasons: s.reasons })),
      page: L.join("\n"),
    };
  }
}
