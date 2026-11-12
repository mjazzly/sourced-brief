// A scripted stand-in for the model, used only to test the harness itself (--mock). For each case it
// reads every source, stops where the case has a gate, and submits the expected sentences as its
// draft, plus the planted trap where the case has one, so the removal path is exercised too. It
// proves the plumbing (tools, gates, the fixed answer, the checker, the page) and says nothing about
// a model. Mock runs are never recorded.
//
// WORK-09 arms (--arm review, --arm reviewer): the draft before review carries one planted fault,
// the first What moved sentence cited at the decision log line above its reconcile line. In A2 the
// stand-in records a finding on it and one on the trap; in B a scripted reviewer reads two files
// and returns the same findings. The stand-in drafter then fixes the reference and keeps the trap,
// so the checker still removes the trap: a finding acted on, a finding left alone, a removal.
import { SECTIONS } from "../lib/check.js";
const STOP_TEXT = {
  disagreement: "tracker.csv A005 is due 2026-11-04; project_note.md gives 6 November for the same action.",
  no_source: "No document this week carries a decision line and no source disagrees with another, so What needs a decision has nothing to cite.",
  arithmetic: "The project note asks for the Q3 returns rate; the answer blocks give orders and returns for Q3 and no block gives the rate.",
  confidential: "supplier_note.md is marked confidential on its first line and was declined.",
};
const copy = (o) => JSON.parse(JSON.stringify(o));
export class MockModel {
  constructor(arm = null) { this.arm = arm; this.n = 0; this.queue = []; this.phase = 0; this.rqueue = []; }
  setCase(c, files) { this.case = c; this.files = files; this.phase = 0; }
  draft() {
    const all = [...(this.case.sentences || []), ...(this.case.mock_extra || [])];
    return { sections: Object.fromEntries(SECTIONS.map((k) => [k, all.filter((s) => s.section === k).map(({ text, claims }) => ({ text, claims }))])) };
  }
  // The draft before review, with the planted fault, and the findings on it.
  review() {
    const before = copy(this.draft().sections), findings = [];
    const s = before.what_moved.find((x) => x.claims.some((c) => /^decision_log\.csv line \d+$/.test(c.ref || "")));
    if (s) {
      const line = Number(/line (\d+)$/.exec(s.claims.find((c) => /^decision_log\.csv/.test(c.ref || "")).ref)[1]);
      for (const c of s.claims) if (c.ref === `decision_log.csv line ${line}`) c.ref = `decision_log.csv line ${line - 1}`;
      findings.push({ section: "what_moved", sentence: s.text, fault: `3. The reference: the claims cite decision_log.csv line ${line - 1}, which is not the reconcile row for this file; the reconcile row is line ${line}.`, fix: `Cite decision_log.csv line ${line} for the file name and every count.` });
    }
    for (const t of this.case.mock_extra || []) findings.push({ section: t.section, sentence: t.text, fault: "9. The gates: no answer block states this rate; it would be computed from two counts.", fix: "Remove the sentence; the open question already carries both counts with their blocks." });
    return { before, findings };
  }
  submit() {
    const q = [];
    if (this.arm === "review") { const r = this.review(); q.push(["record_review", { sections: r.before, findings: r.findings }]); }
    if (this.arm === "reviewer") q.push(["review_draft", { sections: this.review().before }]);
    q.push(["draft_brief", this.draft()]);
    return q;
  }
  plan(phase) {
    const c = this.case, call = (name, input) => [name, input];
    if (phase === 1) {
      const q = [call("list_sources", {}), ...this.files.map((f) => call("read_source", { file: f }))];
      if (c.gate) q.push(call("stop", { reason: c.gate, text: STOP_TEXT[c.gate] }));
      if (c.gate !== "disagreement") q.push(...this.submit());   // the disagreement waits for the reader's answer
      return q;
    }
    if (phase === 2 && c.gate === "disagreement") return this.submit();
    return [];
  }
  async create(req, agent = "drafter") {
    if (agent === "reviewer") {
      if (req.messages.length === 1) this.rqueue = [["list_sources", {}], ["read_source", { file: "decision_log.csv" }], ["read_source", { file: "answers.csv" }], ["return_findings", { findings: this.review().findings }]];
      if (!this.rqueue.length) return { stop_reason: "end_turn", content: [{ type: "text", text: "Mock reviewer: done." }], usage: null };
      const [name, input] = this.rqueue.shift();
      return { stop_reason: "tool_use", usage: null, content: [{ type: "tool_use", id: `mock_${++this.n}`, name, input }] };
    }
    const phase = req.messages.filter((m) => m.role === "user" && typeof m.content === "string").length;
    if (phase !== this.phase) { this.phase = phase; this.queue = this.plan(phase); }
    if (!this.queue.length) return { stop_reason: "end_turn", content: [{ type: "text", text: "Mock: done with this brief." }], usage: null };
    const [name, input] = this.queue.shift();
    return { stop_reason: "tool_use", usage: null, content: [{ type: "tool_use", id: `mock_${++this.n}`, name, input }] };
  }
}
