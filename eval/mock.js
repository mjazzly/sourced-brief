// A scripted stand-in for the model, used only to test the harness itself (--mock). For each case it
// reads every source, stops where the case has a gate, and submits the expected sentences as its
// draft, plus the planted trap where the case has one, so the removal path is exercised too. It
// proves the plumbing (tools, gates, the fixed answer, the checker, the page) and says nothing about
// a model. Mock runs are never recorded.
import { SECTIONS } from "../lib/check.js";
const STOP_TEXT = {
  disagreement: "tracker.csv A005 is due 2026-11-04; project_note.md gives 6 November for the same action.",
  no_source: "No document this week carries a decision line and no source disagrees with another, so What needs a decision has nothing to cite.",
  arithmetic: "The project note asks for the Q3 returns rate; the answer blocks give orders and returns for Q3 and no block gives the rate.",
  confidential: "supplier_note.md is marked confidential on its first line and was declined.",
};
export class MockModel {
  constructor() { this.n = 0; this.queue = []; this.phase = 0; }
  setCase(c, files) { this.case = c; this.files = files; this.phase = 0; }
  draft() {
    const all = [...(this.case.sentences || []), ...(this.case.mock_extra || [])];
    return { sections: Object.fromEntries(SECTIONS.map((k) => [k, all.filter((s) => s.section === k).map(({ text, claims }) => ({ text, claims }))])) };
  }
  plan(phase) {
    const c = this.case, call = (name, input) => [name, input];
    if (phase === 1) {
      const q = [call("list_sources", {}), ...this.files.map((f) => call("read_source", { file: f }))];
      if (c.gate) q.push(call("stop", { reason: c.gate, text: STOP_TEXT[c.gate] }));
      if (c.gate !== "disagreement") q.push(call("draft_brief", this.draft()));   // the disagreement waits for the reader's answer
      return q;
    }
    if (phase === 2 && c.gate === "disagreement") return [call("draft_brief", this.draft())];
    return [];
  }
  async create(req) {
    const phase = req.messages.filter((m) => m.role === "user" && typeof m.content === "string").length;
    if (phase !== this.phase) { this.phase = phase; this.queue = this.plan(phase); }
    if (!this.queue.length) return { stop_reason: "end_turn", content: [{ type: "text", text: "Mock: done with this brief." }], usage: null };
    const [name, input] = this.queue.shift();
    return { stop_reason: "tool_use", usage: null, content: [{ type: "tool_use", id: `mock_${++this.n}`, name, input }] };
  }
}
