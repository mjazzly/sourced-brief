#!/usr/bin/env node
// The tool server. The desktop app (or the eval harness) starts it over stdio. Five tools: the model
// reads the week's sources, stops where it must, and submits one draft whose every sentence carries
// its claims; the code checks every claim, removes what fails and releases the page. Every rule
// lives in lib/check.js and lib/store.js.
//
//   SOURCED_BRIEF_DATA    the week folder (default: ./data/week). Holds the six inputs; the outputs are written beside them.
//   SOURCED_BRIEF_RUN_ID  the run id (default: B + date and time).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Store, STOP_REASONS } from "./lib/store.js";
import { KINDS, SECTIONS } from "./lib/check.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.SOURCED_BRIEF_DATA || path.join(ROOT, "data", "week");
const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
const runId = process.env.SOURCED_BRIEF_RUN_ID || `B${local.slice(0, 16).replace(/[-:T]/g, "")}`;
const store = await Store.open(dataDir, runId);

const server = new McpServer({ name: "sourced-brief", version: "1.2.0" });
const text = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
const guard = (fn) => async (args) => { try { return text(await fn(args ?? {})); } catch (e) { return { isError: true, content: [{ type: "text", text: `error: ${e.message}` }] }; } };

const val = z.union([z.string(), z.number()]);
const claim = z.object({
  kind: z.enum(KINDS).describe("number, text, owner, status, date, period, metric, run_id, or change"),
  ref: z.string().optional().describe("the source reference: tracker.csv A007, answers.csv D202610300900-Q03, project_note.md line 9 (every kind but change)"),
  value: val.optional().describe("the value as written in the sentence: the number, the quoted text, the owner's name, open or closed or closed this week, the date, the period, the metric name"),
  metric: z.string().optional().describe("change only: the metric name as written"),
  new_ref: z.string().optional().describe("change only: the reference of this week's value"), new_value: val.optional().describe("change only: this week's value as written"),
  old_ref: z.string().optional().describe("change only: the reference of last week's value"), old_value: val.optional().describe("change only: last week's value as written"),
});
const sentence = z.object({ text: z.string().describe("one sentence, with no reference written into it; the code appends the references"), claims: z.array(claim).describe("every number, name, date, quote, period and status in the sentence, each with its source") });
const sectionsSchema = z.object(Object.fromEntries(SECTIONS.map((k) => [k, z.array(sentence).describe(`sentences for ${k}; [] when there is no source this week`)])));

server.tool("list_sources", "The files in the week folder, how each is referenced (by action id, by answer id, or by line number), and any file declined because its first line is marked confidential. Read this first.", {}, guard(() => store.listSources()));
server.tool("read_source", "One source file in full: a document or last week's brief as numbered lines; the tracker or the answer blocks as rows with their ids; the decision log or the merged table as numbered lines. A file marked confidential on its first line is refused and nothing past that line is returned.", { file: z.string().describe("a file name from list_sources") }, guard((a) => store.readSource(a.file)));
server.tool("stop", "Records a stop for a reason the code wants on the record before the draft: disagreement (two sources give different values for one fact), no_source (a required section has nothing to cite), confidential (a source was declined), arithmetic (a number the brief would need to compute that no source states). Returns what to do next. Then say so to the reader in one or two sentences.", { reason: z.enum(STOP_REASONS), text: z.string().describe("what was found, in one or two sentences, naming the sources") }, guard((a) => store.stop(a.reason, a.text)));
const asObject = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
server.tool("draft_brief", "The one submission of the week's brief: five sections, each a list of sentences, each sentence with its claims. The code checks every claim against its source, tests that every number, name, date and action id in the sentence is covered by a claim, removes any sentence that fails, writes it to unsourced.md with the reason, and releases the page. A second call is refused: one draft per week.", { sections: z.preprocess(asObject, sectionsSchema) }, guard((a) => store.draftBrief(a.sections)));
server.tool("set_case", "Names the case the next log lines belong to. The harness calls this; in a chat you may leave it.", { case_id: z.string() }, guard((a) => store.setCase(a.case_id)));

await server.connect(new StdioServerTransport());
