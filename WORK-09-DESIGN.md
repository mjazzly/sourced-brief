# WORK-09 design note: a second agent, tested for its place

Status: approved by Megat on 12 Nov 2026, every open decision as recommended except decision 2, which Megat set to five runs each of A1, A2 and B and three of the ceiling. Written against `WORK-09-BRIEF.md`, `README.md` (v1.3), `eval/CASES.md`, `eval/EXEMPLAR.md`, `skill/SKILL.md` v1.3 and `eval/run_eval.js` as committed at bf9fef4.

## 1. The question

Does a second agent lift the smallest model to the bar on the same eight briefs and the same checker, and does it cost less a brief than the largest model alone?

What is on record for the smallest model (claude-haiku-5-5), four counted runs on v1.2 and v1.3:

| Run | Version | Result | The miss |
|---|---|---|---|
| B202610301207-haiku-5-5 | v1.2 | 3 of 6, state 0 of 2, 275 of 289 | What moved file sentences cited at the header or map lines (decision_log.csv lines 5 and 8) instead of the reconcile lines (7 and 10); 44 claimed from the file name; the line chosen varied between runs |
| S202610301543-haiku-5-5 | v1.2 | 5 of 6, state 1 of 2, 287 of 289 | 06_confidential: the 09_week44_a.xlsx sentence at decision_log.csv line 7 removed |
| S202610301625-haiku-5-5 | v1.3 | 6 of 6, state 1 of 2, 289 of 289 | state_b: the same sentence at decision_log.csv line 7 removed in the second clean run, so the two pages differ by one sentence |

Every recorded miss on v1.2 and v1.3 sits in one sentence shape: the What moved reconcile sentence. The checker's reason for the last removal is absent from this repo: the results record keeps the count of removed sentences, and the run folder that held `unsourced.md` was written by the scorecard outside this repo. Section 6 fixes that for WORK-09 by copying every removal reason into the trace.

## 2. The arms

All arms use the same server, cases, expected fact lists, fixed gate answer and checker. Nothing in `lib/`, `server.js`, `eval/check.js`, `eval/expected/` or `data/` changes. `skill/SKILL.md` stays v1.3; the arm skills are built from it by the harness at run time.

| Arm | `--arm` | What runs | Model | Drafter's instructions |
|---|---|---|---|---|
| A1 | `one` | one agent, one pass | claude-haiku-5-5 | `skill/SKILL.md` v1.3 as it stands |
| A2 | `review` | one agent; it reviews its own draft against the checklist before `draft_brief` | claude-haiku-5-5 | v1.3 with step 5 replaced by the A2 step (section 4) and the checklist appended |
| B | `reviewer` | a drafter plus a reviewer agent in a fresh conversation, called once through `review_draft` | claude-haiku-5-5 for both | v1.3 with step 5 replaced by the B step (section 4) and the checklist appended |
| Ceiling | `one` | one agent, one pass | claude-opus-5-5, effort high | `skill/SKILL.md` v1.3 as it stands |

**What makes the comparison fair.** The checklist (section 3) is one file, `arms/checklist.md`, and the harness inserts the same bytes into three places: the A2 drafter's skill, the B drafter's skill and the B reviewer's instructions. A2 and B drafters get the same skill text apart from the one step that says who runs the checklist and which tool carries the result. Both submit their draft to a harness tool once and get a short reply; both then call `draft_brief` once. What remains different between A2 and B is the fresh context: in A2 the agent that wrote the draft finds the faults; in B an agent that has never seen the drafting does.

**One change at a time.** A2 against A1 measures the review step. B against A2 measures the fresh context. The ceiling is the cost to beat. Arm C (section 10) changes a different part and waits for Megat's word.

## 3. The review checklist (`arms/checklist.md`, the same words in A2 and B)

Every item restates a rule from `skill/SKILL.md` v1.3; the right column names it, so a reader can confirm that the checklist adds no knowledge the drafter lacks.

```
## REVIEW CHECKLIST

Go through the draft one sentence at a time, in section order. For every claim, open its source
with read_source and look at the row or line the reference names before you decide. A finding
names one sentence and one fault. Where a sentence passes every check, it gets no finding.

1. Shape. The sentence copies the fixed shape for its section and source item, with only the
   values changed.
2. One sentence per source item, and nothing else. Every source item named in the shape table
   has its sentence: each tracker row closed this week, each reconcile row of the latest
   normaliser run, each open tracker row, each answer block, each "Decision needed:" line, each
   disagreement, each open action with owner "not stated", each "Open question:" line, each
   number asked for that no source states. No sentence stands outside the shape table: no
   summary, no connective sentence, no sentence about a row held or a file title.
3. The reference. Each claim cites the file and the row, line or answer id the shape names for
   it: a tracker row by action id, an answer block by answer id, every other file by line
   number, counted from the first line of the file with blank lines included. A reconcile
   sentence cites the reconcile line for that file, for the file name and for every count. A
   change claim cites this week's block and the line of last week's brief for the same metric
   and period.
4. The value is at the reference. Each claimed value appears on the referenced row or line as
   the claim kind needs: the action word for word, the owner, the date, the number, the quoted
   words.
5. What is claimed is written. Every claimed value is written in the sentence as claimed.
6. What is written is claimed. Every number in the sentence (a number written as a word, two
   upward, included), every date, every action id, every name (any two capitalised words) and
   every quoted phrase carries a claim.
7. The claims are the shape's claims. The sentence carries the claim kinds its shape lists, and
   no others: no status claim in What is due, one number per count in a reconcile sentence.
8. The text. No run id, answer id or reference inside the text other than the action id the
   shape asks for. No dashes. Values as the source writes them: a tracker date as 2026-11-03, a
   document date as the document writes it, the metric and the period as a reader would say
   them.
9. The gates. An action with a disagreement appears in What needs a decision only, with both
   dates and both references, and nowhere else. Nothing comes from a declined file. No number
   is computed and nothing is counted. A section with nothing to cite is an empty list.

Each finding has four fields:
- section: the section key (what_moved, what_is_due, what_changed, decisions, open_questions)
- sentence: the sentence's text exactly as drafted, or "missing" for a source item with no
  sentence
- fault: the number and name of the check it fails (for example "3. The reference"), and in one
  sentence what is wrong, naming the file and the row, line or answer id you looked at
- fix: in one sentence, the change that would make it pass (the reference to cite, the claim to
  add or remove, the word to change, or the source item the missing sentence is for)
```

| Item | The rule in SKILL.md v1.3 it restates |
|---|---|
| 1 | OUTPUT: "Copy the shape; change only the values." |
| 2 | Step 3, "one sentence per source item, in the fixed shape below. Write nothing else", and the shape table rows |
| 3 | INPUTS AND TOOLS, the "Referenced as" column and "Line numbers count from the first line of the file, blank lines included"; shape table, "all at the reconcile line" and "change (new at the block, old at last week's line)" |
| 4 | The claim kinds table, column "the code checks" |
| 5, 6 | Step 4 and RULES AND STYLE, "What you claim, you write; what you write, you claim." |
| 7 | The shape table, column Claims, and "no status claim" |
| 8 | Step 4, "Write no run id, answer id or reference into the text"; RULES AND STYLE, "No dashes"; OUTPUT, values as the source writes them |
| 9 | Step 2, WHEN TO STOP AND WHAT TO DECLINE, gates 1 to 4 |

## 4. The drafter's step for A2 and for B, in full

In both arm skills, steps 1 to 4 and 6 stay word for word; step 5 is replaced; the checklist from section 3 is appended at the end of the file, after the VERSION LOG; the version line reads `v1.3-review` or `v1.3-reviewer`; the tools line in INPUTS AND TOOLS gains one bullet.

**A2, the tools bullet:**

> - `record_review(sections, findings)`: puts your draft and your review findings on the record before the submission. Call it once, after the review and before `draft_brief`. It returns a short receipt; it checks nothing.

**A2, step 5:**

> 5. **Review the draft, then submit it.** Call `stop` where a gate applies (reasons below). Hold the whole draft as `sections` with all five keys, then go through the REVIEW CHECKLIST at the end of this file on it yourself, one sentence at a time, opening the source for every claim. Call `record_review` once with the draft as it stood before your changes and every finding, in the four fields the checklist gives (an empty list when every sentence passes). Then change what the findings show to be wrong, and **call `draft_brief` once** with `sections` as a JSON object (never as a string) holding all five keys. Pass `[]` for a section with nothing to cite.

**B, the tools bullet:**

> - `review_draft(sections)`: sends your draft to a reviewer, an agent that reads the same sources with `list_sources` and `read_source`, goes through the REVIEW CHECKLIST at the end of this file on your draft, and returns its findings in the four fields the checklist gives. The reviewer writes no sentences and cannot submit. Call it once, before `draft_brief`. A second call is refused.

**B, step 5:**

> 5. **Have the draft reviewed, then submit it.** Call `stop` where a gate applies (reasons below). Call `review_draft` once with the whole draft as `sections`, a JSON object holding all five keys. For each finding, open the source it names and decide: change the sentence where the source shows the finding is right, and keep it where the source shows it is wrong. Then **call `draft_brief` once** with `sections` as a JSON object (never as a string) holding all five keys. Pass `[]` for a section with nothing to cite.

A1 and the ceiling get `skill/SKILL.md` v1.3 untouched, byte for byte.

## 5. The reviewer, in full

### How `review_draft` runs

1. The drafter calls `review_draft(sections)`. The harness reads `sections` the way the server does (a JSON string is parsed into the object).
2. The harness opens a new conversation with the reviewer's instructions below as the system prompt, the reviewer's three tools, and one user message: `Review this draft.` followed by the draft as indented JSON. Nothing else goes in: no drafter messages, no stop text, no checker output, no expected list, no case id.
3. The reviewer's `list_sources` and `read_source` calls go through the same server connection as the drafter's, on the same case folder. The server logs each read in `run_log.csv` as it does for the drafter; the checker reads only the gate, stop and unsourced lines, so the extra read lines change no score. The trace marks which agent made each call.
4. The reviewer ends by calling `return_findings(findings)`, a harness tool. Its findings go back to the drafter as the `review_draft` result, as JSON. If the reviewer ends its turn without calling it, or reaches its call cap (15 model calls), the drafter receives `{"status": "NO_REVIEW", "reason": "..."}`, and the trace records it as a miss of the reviewer.
5. A second `review_draft` call, or one after `draft_brief`, returns an error: `review_draft takes one call per brief`.
6. The reviewer cannot call `stop`, `draft_brief`, `set_case` or `review_draft`; those tools are absent from its list.

The reviewer runs on the same model as the drafter, with no effort setting (as A1), prompt caching on, `max_tokens` 16000.

### The reviewer's tools

- `list_sources`, `read_source(file)`: the server's own tools, with the server's own descriptions.
- `return_findings(findings)`: harness tool. Description: "Returns your findings to the drafter and ends the review. Call it once, last. findings is a list; each finding has section, sentence, fault and fix as the checklist gives them. Pass [] when every sentence passes." Schema: `findings`, an array of objects with four required strings `section` (one of the five keys), `sentence`, `fault`, `fix`.

### The reviewer's instructions (`arms/reviewer.md`)

The harness builds the reviewer's system prompt from `arms/reviewer.md`, which holds the text below with one marker, `{{CHECKLIST}}`, replaced by the bytes of `arms/checklist.md`. The INPUTS, OUTPUT and claim kinds parts are copied from `skill/SKILL.md` v1.3 with "you" changed to "the drafter" where the drafter is meant; the mock run fails if any copied table row differs from SKILL.md, so the two files cannot drift apart unseen.

```
# Sourced Brief: the reviewer

## CONTEXT

Every week an assistant drafts a one page status brief from a week folder of source files. Every
sentence carries its source: the file and the row, line or answer id it came from. The drafter
writes the sentences with a claim on every number, name, date, quote and status. After the
drafter submits, the code checks each claim against its source, removes any sentence that fails
and lists it with the reason, and releases the page with what passed. The drafter submits once.
A removed sentence stays removed.

## YOUR ROLE

You are the reviewer: an agent that reads the drafter's draft before it is submitted and finds
the sentences that would fail. You read the same sources with the same tools. You return
findings, one per sentence and fault, and the drafter decides what to change. You write no
sentences and no rewritten sentences of your own; a fix says in one sentence what to change. You
cannot submit the brief and you cannot stop it. There is no answer key anywhere, by design. Do
not look for expected results and do not ask for them.

## INPUTS AND TOOLS

The week folder holds up to seven source files:

| File | What it is | Referenced as |
|---|---|---|
| `tracker.csv` | the action tracker: one row per action with owner, due date, status, the run that added it and the run that closed it | `tracker.csv A007` (by action id) |
| `decision_log.csv` | the normaliser's decision log: one row per decision, with a reconcile row per file merged (rows read, merged, held) | `decision_log.csv line 9` |
| `merged.csv` | the merged table the normaliser wrote | `merged.csv line 12` |
| `answers.csv` | the answer blocks: one row per answered question with metric, period, value, the rows it was computed over and its answer id | `answers.csv D202610300900-Q03` (by answer id) |
| `project_note.md`, `supplier_note.md`, any other `.md` | short documents; some lines start with "Decision needed:" or "Open question:" | `project_note.md line 7` |
| `brief_previous.md` | last week's released brief, in the same five sections | `brief_previous.md line 14` |

Line numbers count from the first line of the file, blank lines included; `read_source` shows
them. Tools:

- `list_sources`: every file, how it is referenced, and any file declined as confidential, with
  the week ending date and the latest tracker run id, which decide what "this week" means. Call
  it first.
- `read_source(file)`: the file in full, as numbered lines or as rows with their ids. A declined
  file is refused.
- `return_findings(findings)`: returns your findings to the drafter and ends the review. Call it
  once, last.

## THE DRAFT

The draft arrives as `sections`, an object with the five keys `what_moved`, `what_is_due`,
`what_changed`, `decisions`, `open_questions`, each a list of sentences. A sentence is
`{ "text": "...", "claims": [...] }`. The code appends the references to the text on release, so
a sentence's text holds no reference.

**The fixed shapes**, one per source item. The drafter copies the shape and changes only the
values.

| Section | One sentence for | Text | Claims |
|---|---|---|---|
| what_moved | each tracker row closed this week | `<action>, <owner>: closed this week.` | text (the action, word for word), owner, status "closed this week" |
| what_moved | each reconcile row of the latest normaliser run | `<file>: <n> rows read, <n> merged.` or `<file>: <n> rows read, <n> merged, <n> held.` | text (the file name), one number per count; all at the reconcile line |
| what_is_due | each open tracker row, in due date order, except an action with a disagreement, which goes to decisions only | `<action id> <action>, <owner>, due <due>.` or `<action id> <action>, owner not stated, due <due>.` | text (the action), owner (the name, or "not stated"), date (the due); no status claim |
| what_changed | each answer block with a line in last week's brief | `<Metric>, <period>: <value>; unchanged from last week.` or `<Metric>, <period>: <value>; last week <old value>.` | metric, period, change (new at the block, old at last week's line) |
| what_changed | each answer block with no line in last week's brief | `<Metric>, <period>: <value>.` | metric, period, number |
| decisions | each "Decision needed:" line | `"<the whole line>"` | text (the whole line) |
| decisions | each disagreement | `<action id> due date: the tracker says <date>; the <document> says <date>.` | date at the tracker row, date at the document line |
| open_questions | each open action with owner "not stated" | `<action id> <action>: owner not stated.` | text (the action), owner "not stated" |
| open_questions | each "Open question:" line | `"<the whole line>"` | text (the whole line) |
| open_questions | each number asked for that no source states | `<what was asked> was asked for, but no source states it; <metric> <value> and <metric> <value> are given.` | text (the words of the ask) at the document line, a number per value at its block |

The metric and the period are written as a reader would say them (Returns rate; Q3 2026,
September 2026); the code reads both. Values are written as the source writes them: an action
word for word, a tracker date as 2026-11-03, a document date as the document writes it, a number
with or without thousands separators.

**Claim kinds:**

| kind | reference | value | the code checks |
|---|---|---|---|
| `number` | any | the number as written (4,210 or 4210; 8.15% or 8.15) | equals the answer block's value, rows computed over or a number in its lineage, or a number on the referenced line |
| `text` | any | words as written | they appear verbatim on the referenced line or row |
| `owner` | tracker row | the owner's name, or "not stated" | equals the row's owner; "not stated" is written in the sentence as "owner not stated" |
| `status` | tracker row | "closed this week" | the row is closed and its closed run is the latest |
| `date` | tracker row or a document line | the date as written | equals the row's due date, or appears on the line; a date another source disputes must be cited with its partner in the same sentence |
| `period` | answer block | the period as written | equals the block's period |
| `metric` | answer block | the metric as written | equals the block's metric |
| `change` | `new_ref` and `old_ref` | `new_value`, `old_value`, `metric` | both numbers hold at their references |

Four sentences as examples:

{ "text": "Send the spend export for the last twelve months, Sofia Lindqvist: closed this week.",
  "claims": [ { "kind": "text", "ref": "tracker.csv A001", "value": "Send the spend export for the last twelve months" },
              { "kind": "owner", "ref": "tracker.csv A001", "value": "Sofia Lindqvist" },
              { "kind": "status", "ref": "tracker.csv A001", "value": "closed this week" } ] }
{ "text": "A002 Send the draft category taxonomy, Aiden Brooks, due 2026-11-03.",
  "claims": [ { "kind": "text", "ref": "tracker.csv A002", "value": "Send the draft category taxonomy" },
              { "kind": "owner", "ref": "tracker.csv A002", "value": "Aiden Brooks" },
              { "kind": "date", "ref": "tracker.csv A002", "value": "2026-11-03" } ] }
{ "text": "Returns rate, Q3 2026: 8.15%; last week 7.92%.",
  "claims": [ { "kind": "metric", "ref": "answers.csv D202610300900-Q03", "value": "Returns rate" },
              { "kind": "period", "ref": "answers.csv D202610300900-Q03", "value": "Q3 2026" },
              { "kind": "change", "metric": "Returns rate", "new_ref": "answers.csv D202610300900-Q03", "new_value": "8.15%", "old_ref": "brief_previous.md line 15", "old_value": "7.92%" } ] }
{ "text": "A005 due date: the tracker says 2026-11-04; the project note says 6 November.",
  "claims": [ { "kind": "date", "ref": "tracker.csv A005", "value": "2026-11-04" },
              { "kind": "date", "ref": "project_note.md line 5", "value": "6 November" } ] }

**Every sentence also passes two tests.** Everything checkable in the text carries a claim: every
number (a number written as a word, two upward, included, claimed with the word as its value),
every date, every action id, every person's or company's name (any two capitalised words count as
a name), every quoted phrase. Every claimed value is written in the text. A sentence that misses
one either way is removed whole.

**The four gates.** Where two sources give different values for one fact, the page carries both
in decisions with both references and states neither as a fact; that action appears nowhere else.
A section with nothing to cite is an empty list and reads "No source this week." on the page. A
file declined as confidential is cited nowhere. A number no source states (a rate from two counts,
a difference between two weeks, a count of rows or actions) is never computed and never counted.

## STEPS, IN ORDER

1. Call `list_sources`, then `read_source` on every readable file.
2. Go through the checklist below on the draft, one sentence at a time, in section order. Then
   check item 2 of the checklist against the sources: every source item has its sentence.
3. Call `return_findings` once with every finding. Pass [] when every sentence passes.

## STYLE

One finding per sentence and fault; two faults in one sentence are two findings. Copy the
sentence's text exactly as drafted. Name the file and the row, line or answer id you looked at.
Plain sentences, no dashes. Report only what the source shows; where you did not open the source,
make no finding.

{{CHECKLIST}}
```

## 6. What gets recorded

`--arm` given on the command line (any of `one`, `review`, `reviewer`) writes to `eval/results-arms/` and never to `eval/results/`; `eval/EXEMPLAR.md` and the scorecard are untouched. With no `--arm`, the harness runs and records as it does at bf9fef4. (Decision 7.)

```
eval/results-arms/
  <label>.json                 the run record
  <label>/<case>.trace.json    one trace per brief, eight per run
eval/ARMS.md                   rebuilt from eval/results-arms/ after every run
```

Labels: `W<yyyymmddhhmm>-<arm>-<model tag>[-<effort>]`, for example `W202611131015-reviewer-haiku-5-5`.

### The run record (`<label>.json`)

Every field the v1.3 record has (verdict, cases, tokens, cost, calls, versions), plus:

- `arm`: `one`, `review` or `reviewer`; `arm_name`: A1, A2, B or Ceiling
- `drafter_model`, `reviewer_model` (null outside B), `effort`
- `skill_version` (`v1.3`, `v1.3-review`, `v1.3-reviewer`), `checklist_sha` and `reviewer_sha` (a hash of each file's bytes, so a run names the exact words it used)
- `by_agent`: model calls, tokens in and out and cost for the drafter and for the reviewer
- `seconds`: wall clock for the run; `seconds_per_brief`: the eight briefs' wall clock, each from the first model call to the last tool result; `seconds_by_brief`
- `review`: per brief, whether the review step ran (A2: `record_review` called; B: `review_draft` returned findings), the number of findings, and how many sentences changed after it

### The trace (`<case>.trace.json`)

One file per brief; the site scene is drawn from this file and from nothing else, so it carries the case result too.

```json
{
  "label": "W202611131015-reviewer-haiku-5-5", "arm": "reviewer", "case": "state_b", "title": "State B: identical inputs, identical page",
  "agents": { "drafter": { "model": "claude-haiku-5-5", "instructions": "v1.3-reviewer" }, "reviewer": { "model": "claude-haiku-5-5", "instructions": "arms/reviewer.md <sha>" } },
  "steps": [
    { "n": 1, "agent": "harness", "type": "message", "to": "drafter", "text": "Write this week's brief.", "at_s": 0.0 },
    { "n": 2, "agent": "drafter", "type": "model_call", "at_s": 0.1, "seconds": 2.4,
      "tokens": { "in": 6210, "out": 180, "cache_read": 0, "cache_write": 6100 }, "cost_usd": 0.00085,
      "text": "The tools are connected.", "tool_calls": ["list_sources"] },
    { "n": 3, "agent": "drafter", "type": "tool", "tool": "list_sources", "input": {}, "result": "...", "is_error": false, "at_s": 2.5, "seconds": 0.02 },
    { "n": 14, "agent": "drafter", "type": "tool", "tool": "review_draft", "input": { "sections": "..." }, "at_s": 31.0, "seconds": 22.7, "opens_review": 1 },
    { "n": 15, "agent": "reviewer", "type": "model_call", "review": 1, "...": "..." },
    { "n": 22, "agent": "reviewer", "type": "tool", "tool": "return_findings", "input": { "findings": ["..."] }, "review": 1 }
  ],
  "review": {
    "ran": true, "status": "FINDINGS",
    "draft_before": { "what_moved": ["..."], "what_is_due": ["..."], "what_changed": ["..."], "decisions": ["..."], "open_questions": ["..."] },
    "findings": [ { "id": "F1", "section": "what_moved", "sentence": "09_week44_a.xlsx: 12 rows read, 12 merged.", "fault": "3. The reference ...", "fix": "..." } ],
    "changes": [ { "section": "what_moved", "before": { "text": "...", "claims": ["..."] }, "after": { "text": "...", "claims": ["..."] }, "change": "changed", "findings": ["F1"] } ]
  },
  "submitted": { "what_moved": ["..."], "...": "..." },
  "checker": {
    "released": 21, "removed": [ { "section": "what_moved", "text": "...", "reasons": ["..."] } ],
    "page": "the released page, as written to brief_<week>.md"
  },
  "result": { "match": true, "facts_found": 48, "facts_total": 48, "fails": [], "gate": null, "gate_held": null },
  "totals": { "model_calls": { "drafter": 9, "reviewer": 8 }, "tokens_in": 0, "tokens_out": 0, "cost_usd": 0, "seconds": 0 }
}
```

- `steps` holds every model call and every tool call in order, each with its agent, tokens, seconds and cost; the model's own words in each call (`text`) are kept whole. Tool results are kept whole too (the v1.3 transcript cut them at 4,000 characters; the trace does not).
- `review.changes` is computed by the harness: each sentence of `draft_before` is matched to the submitted draft by section and position, then by text, and marked `kept`, `changed`, `dropped` or `added`; a finding is linked to a change when its `sentence` equals the `before` text. A finding whose sentence was kept is visible as such.
- `checker.removed` copies each `unsourced` line from `run_log.csv` with its reasons, so the reason for every removal stays in the repo.
- A1 and the ceiling write the same trace with `review` set to `{ "ran": false }`.

### `eval/ARMS.md`

Rebuilt from `eval/results-arms/` by code after every run, never edited by hand, in the README's plain style:

1. The question and the verdict rule, copied from section 8 of this note.
2. Megat's predictions, copied from section 9.
3. One row per arm: runs recorded of runs planned, bar met in n of N, briefs matched of 8 in each run (so the spread between runs shows), claims verified, sentences removed, review findings and sentences changed (A2 and B), median cost a brief, median seconds a brief.
4. Every miss, by run, case, section, fact and value, as `eval/check.js` names it; for B and A2, beside each miss, whether a finding named that sentence and whether the drafter changed it.
5. The verdict line, written by the code from the rule once A1, A2 and B have five runs each and the ceiling has three; until then it reads that the verdict waits, with the count each arm has.

## 7. The harness changes (step 2 of the build, after approval)

- `eval/run_eval.js`: the `--arm` flag; the arm skill is built in memory from `skill/SKILL.md` plus `arms/`; the harness tools (`record_review`, `review_draft`, `return_findings`) are added to the tool list and answered by the harness without reaching the server; a per call clock; the trace writer. With no `--arm`, the code path at bf9fef4 runs unchanged.
- `eval/arms.js` (new): the arm definitions, the reviewer loop, the change matcher, the trace writer.
- `eval/arms_page.js` (new): builds `eval/ARMS.md`; `node eval/run_eval.js --arms-page` rebuilds it from the records without running anything.
- `eval/mock.js`: the scripted stand-in learns the two new tools. In A2 and B the scripted draft before review carries one planted fault (the first What moved sentence cited at the wrong decision log line), and in 05_inference the planted trap as well. In A2 the scripted drafter calls `record_review` with a finding on each; in B a scripted reviewer calls `list_sources`, reads two files and returns the same findings through `return_findings`. The scripted drafter fixes the reference and keeps the trap, so the checker removes the trap. The mock thereby exercises a finding acted on, a finding left alone, a removal and the trace in both review arms. The mock run also fails when a copied table in `arms/reviewer.md` differs from `skill/SKILL.md`, or when the checklist bytes differ between the three places they go.
- `arms/checklist.md`, `arms/review_step.md`, `arms/reviewer_step.md`, `arms/reviewer.md` (new): the words in sections 3 to 5 of this note.
- `README.md`: a WORK-09 section with the commands and every limit found.

## 8. The verdict rule, fixed before the first run

A1, A2 and B run five times each; the ceiling runs three times (decision 2). The rule is applied once every arm has its runs, and compares A1, A2 and B on bar met in n of 5. The ceiling enters the rule through its median cost a brief over its three runs; its bar met in n of 3 is reported beside it. Ties go to the arm with fewer parts.

1. **B earns its place** only if it meets the bar in more of its five runs than A2 does, and B's median cost a brief over its five runs stays below the ceiling's median cost a brief over its three.
2. **If A2 meets the bar in as many of five runs as B, or more,** the second agent is folded. The review step stays in the skill only if A2 also meets the bar in more of five runs than A1 (decision 8).
3. **If neither A2 nor B meets the bar in any of its five runs,** the entry says so and names every miss by case, section, fact and value.
4. Every arm's briefs matched of 8 in each run, claims verified, sentences removed, cost and seconds are reported beside the bar, and none of them decides the verdict.

The cost half of rule 1 is close to certain to hold: two runs of the smallest model cost about a twentieth of one ceiling run. The bar half is the test.

## 9. Megat's predictions, signed before the first run

One line each, in Megat's words.

| Arm | Prediction (bar met in n of N, and why) |
|---|---|
| A1 | 3 of 5. |
| A2 | 4 of 5, because it has another round of checking that is focused on the checklist. |
| B | 5 of 5, because a fresh review that focuses only on reviewing is able to catch anything that was missed, since it has done no heavy work on the draft yet compared to the first agent. |
| Ceiling | 3 of 3, all will pass without any issue. |

Signed: Megat Jazly. Date: 12 Nov 2026.

## 10. Arm C, designed and held

A lead agent and one reader agent per readable source file, run in parallel, all on the smallest model. The lead calls `list_sources`; the harness then starts one reader per readable file in its own fresh conversation, with `read_source` for that one file and instructions to return every source item in that file as a sentence in its fixed shape with its claims (the same shape table). The lead receives the readers' sentences, reads the tracker and the documents itself to look for a disagreement (it spans two files, so no single reader sees it), calls `stop` where a gate applies, puts the sentences in section order and calls `draft_brief` once. Readers cannot call `stop` or `draft_brief`. Recorded with the same trace, with one agent name per reader. Arm C changes how the reading is split, a different part from A2 and B, so it is compared against A1. Built only on Megat's word after A1, A2 and B are recorded.

## 11. Cost and runs

Estimates from the recorded v1.3 runs (US$0.066 a run for the smallest model, US$1.667 for the ceiling) and a reviewer that reads every source once (about 8 model calls over 15,000 tokens of context a brief):

| Arm | A run | Runs | All runs |
|---|---|---|---|
| A1 | about US$0.07 | 5 | about US$0.35 |
| A2 | about US$0.08 | 5 | about US$0.40 |
| B | about US$0.15 | 5 | about US$0.75 |
| Ceiling | about US$1.70 | 3 | about US$5.10 |
| Total | | 18 | about US$6.60 |

The two extra runs of each small model arm add about US$0.60 in all. The real runs are Megat's, from Terminal with the `.env` key: 18 commands, one per line, given with the harness in the README's WORK-09 section. Each run takes one command of the shape below; the run order interleaves the arms, so a change in the API over the hours of running falls on every arm alike.

```
node eval/run_eval.js --arm one --model claude-haiku-5-5
node eval/run_eval.js --arm review --model claude-haiku-5-5
node eval/run_eval.js --arm reviewer --model claude-haiku-5-5
node eval/run_eval.js --arm one --model claude-opus-5-5 --effort high
```

## 12. Decisions, as taken by Megat on 12 Nov 2026

Every decision below was taken as recommended, except decision 2. Decision 2 as taken: five fresh runs each of A1, A2 and B, and three fresh runs of the ceiling. Megat's reason: the scorecard's eleven sweeps of the smallest model on v1.3 range from 4 to 8 of 8 briefs matched, so three runs cannot separate the arms, and two more runs of each small model arm cost well under US$1 in total. The v1.3 runs on record stay in `eval/results/` and out of the arms count.

The decisions as first put, with the recommendation first:

1. **Where it lives.** A `work-09` branch in this repo, merged to main only on Megat's word. Alternative: a new public repo.
2. **Runs per arm.** Three fresh runs of every arm, A1 and the ceiling included, for about US$6.00 in all. The two v1.3 runs on record (S202610301625) lack seconds and traces, and they ran under the scorecard, so they stay in `eval/results/` and out of the arms count. Alternative, as the brief puts it: count each as run one of its arm and run two more, about US$3.20 less, with no seconds or trace for those two rows.
3. **The reviewer's model.** The smallest, as the drafter, so the result isolates the fresh context. A larger reviewer is a later question.
4. **Arm C.** Held until A1, A2 and B are recorded.
5. **Scorecard.** The arms stay out of the sweep and out of CI until Megat decides otherwise.
6. **Entry name.** Working name WORK-09; Megat picks the public title.
7. **What `--arm one` writes.** Passing `--arm` (any value) records to `eval/results-arms/` with traces; leaving it out keeps the bf9fef4 behaviour and records to `eval/results/`. The brief's wording, "the default is `one`, with behaviour and records identical to today", would send the A1 and ceiling runs into `eval/results/` and rebuild `eval/EXEMPLAR.md`, which section 4 of the brief keeps untouched.
8. **A2 against A1.** The review step stays in the skill only if A2 meets the bar in more runs than A1. The brief's rule says the step stays when A2 matches B; this adds the test that the step itself earned its place.
9. **The checklist in B's drafter.** Both drafters (A2 and B) carry the checklist in their skill, so their instructions differ in one step only. Alternative: B's drafter goes without it and only the reviewer has it, which makes B differ from A2 in two parts.
10. **A recorded review in A2.** A2's drafter puts its draft and findings on the record with `record_review`, a harness tool that checks nothing, so A2 and B leave the same trace (the draft before, the findings, the changes) and take the same round trip. Alternative: A2 reviews in its own text with no tool, which leaves no draft before review to compare.
11. **How the reviewer returns findings.** Through `return_findings`, a third harness tool with a fixed schema, beside the two read tools the brief names. Free text parsed by the harness would add a parsing failure that would count against B and say nothing about the second agent.
12. **No nudge on a skipped review.** If a drafter in A2 or B calls `draft_brief` without the review, the harness sends nothing extra (the one "Submit the brief now" message stays the only nudge); the trace and ARMS.md record the skipped review against that brief.
13. **Words replayed to a visitor.** The trace keeps every agent's words exactly as written. If a finding or a model line carries a dash or other wording the site rules exclude, the site session shows it as recorded and marks it as the model's words; the record is never edited. Alternative: the site session leaves such a line out of the scene and keeps it behind the full record button.
14. **`WORK-09-BRIEF.md`.** Kept local and added to `.gitignore` beside `BRIEF.md`, as the earlier working brief is. Alternative: commit it with the design note.

## 13. Limits found while writing this note

- The v1.3 results record keeps the count of removed sentences and drops the checker's reason; the run folders that held `unsourced.md` are outside the repo. The reason for the S202610301625-haiku-5-5 State B removal is unknown from this repo. WORK-09's trace keeps every reason.
- The v1.3 transcript cuts each tool result at 4,000 characters. The WORK-09 trace keeps them whole.
- The checklist restates the skill and teaches nothing new, so it can only catch a fault the skill already describes. A miss the skill does not describe stays outside its reach in A2 and B alike.
- The smallest model's result on one run is noisy: the scorecard's eleven sweeps of it on v1.3 (Megat's figure, from records kept outside this repo) range from 4 to 8 of 8 briefs matched. Five runs per small model arm separate arms by whole runs out of five. A one run difference is reported as it is, and is weak evidence; ARMS.md shows the briefs matched of 8 in every run beside the bar, so the spread is visible.
- The ceiling's three runs are enough for its median cost a brief, the one number the rule reads from it; its bar met in n of 3 is reported and decides nothing.
