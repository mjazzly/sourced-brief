# Sourced Brief, v1.3

Every week someone writes the status brief: one page, read in three minutes, pulled from six places (the action tracker, the merged table and its decision log, a few answered questions, two short documents and last week's brief). It takes an afternoon, and afterwards nobody can tell which sentence came from where. This build writes that page, and **every sentence carries its source**: the file and the row, line or answer id it came from. The model reads the sources and drafts the page in five fixed sections with a claim on every number, name, date, quote and status; the code checks each claim against its source before the page is released, removes any sentence that fails and lists it with the reason, and releases the page only with what passed. Where two sources disagree the page shows both and never picks one quietly.

The model reads and writes; the code checks and releases. The four gates are enforced in `lib/check.js` and `lib/store.js`, so the model cannot skip one:

1. **Disagreement.** An action id appears in a document with a date different from its tracker due date. A date claim on either source fails unless the sentence cites both; the page carries both values with both references in What needs a decision.
2. **No source.** A section with nothing to cite reads "No source this week." and nothing else.
3. **Confidential.** A file whose first line says confidential is declined before any other line is read, named as declined on the page, and cannot be cited.
4. **Arithmetic.** A number no source states (a rate from two counts, a difference between weeks, a count of rows) fails coverage and the sentence is removed; the inputs stay, with their references.

Every sentence also passes two tests: nothing checkable may remain uncovered by a claim (a number, a number written as a word, a date, an action id, a name), and every claimed value must appear in the text. The model drafts once; the removed sentences go to `unsourced.md`.

Synthetic data only. Every week folder under `data/cases/` comes from `scripts/make_week.js`, a seeded generator, and the expected fact lists in `eval/expected/` come from the same run of it. Nothing in the data places the firm in a country: branches are place types, people have neutral names, amounts carry no currency.

## Files

| Path | What it is |
|---|---|
| `server.js` | The tool server the desktop app (or the harness) runs. Five tools. |
| `lib/check.js` | The claim checker: nine claim kinds, the coverage and presence tests, the disagreement rule. |
| `lib/store.js` | The state, the stops, the release: the page, `unsourced.md`, `claims.csv`, `run_log.csv`. |
| `lib/sources.js` | Reads the week folder; parses references; finds dates, numbers, periods and names. |
| `scripts/make_week.js` | The truth generator. Writes every case's week folder, `data/week/` and every expected fact list from one seed. |
| `data/week/` | The clean week, for the desktop app. Once the server has run, also `brief_<week>.md`, `unsourced.md`, `claims.csv`, `run_log.csv`. |
| `data/cases/` | One week folder per case; the harness copies from here and never writes here. |
| `skill/SKILL.md` | The instructions the model gets, and nothing else. Keep it the same as the copy in your Claude account. |
| `eval/CASES.md` | The case set and the decisions taken before the first run. |
| `eval/expected/` | One expected fact list per case, written by the generator. |
| `eval/run_eval.js` | The harness: one command, eight briefs, blind, recorded. |
| `eval/check.js` | The case checker: every expected fact against the released claims; the must-not lists; the gates; the state comparisons. Names a miss by case, section, fact and value. |
| `eval/answers.txt` | The one fixed answer the harness gives at the one stop that has one, the same every run. |
| `eval/results/` | One record per counted run: model, calls, tokens, cost, verdict, every case. |
| `eval/EXEMPLAR.md` | The living record, rebuilt from `eval/results/` after every run. |
| `eval/prices.json` | The price table the cost is computed from, with its source and date. |

## Run it

Needs Node 20 or later.

```
npm install
node scripts/make_week.js         # regenerates data/ and eval/expected from the seed (already committed)
node eval/run_eval.js --mock      # proves the plumbing with a scripted stand-in; no API call; never recorded
```

### Rerun every brief with one command (the harness)

```
node eval/run_eval.js --model claude-haiku-5-5
node eval/run_eval.js --model claude-opus-5-5 --effort high
```

It copies each case's week folder into an empty folder under `eval/runs/`, starts this server on it, and asks for the brief in a fresh conversation with the skill and the tools and nothing else, eight times: the six cases, the clean week again (State B) and the clean week with one new document (State A). When the model stops on the disagreement, it sends the fixed answer from `eval/answers.txt`. Then it checks every released page against `eval/expected/`, writes `eval/results/<label>.json` with the tokens and the cost, and rebuilds `eval/EXEMPLAR.md`. The `data/` folder in this repo is never touched.

It needs an Anthropic API key in a file called `.env` in this folder (see `.env.example`). Use a dedicated key with a low spend limit and delete it when you are done.

- `--model` picks the model, so the same briefs can be run on a smaller tier to see whether it still passes.
- `--effort high` sets the effort level where the model offers one.
- `--only 02_disagreement` runs one brief and shows the calls; never recorded.
- `--page-only` rebuilds the page from the recorded runs.
- `--max-calls` caps the model calls on one brief (default 30).

### Connect it to the Claude desktop app

1. In Terminal, run `which node` and copy the path it prints.
2. Claude desktop app, Settings, Developer, Edit Config. Add this inside `"mcpServers"` (replace both paths with yours):

```json
"sourced-brief": {
  "command": "/path/from/which/node",
  "args": ["/path/to/sourced-brief/server.js"]
}
```

3. Quit and reopen the desktop app. In a new chat, the tools menu should list `sourced-brief` with five tools. Add the skill from `skill/SKILL.md` to your account and say "Write this week's brief."

### Start a new week

Put the week's six files in a folder and point `SOURCED_BRIEF_DATA` at it, or delete `brief_<week>.md`, `unsourced.md`, `claims.csv` and `run_log.csv` from `data/week/` to draft the sample week again. One brief is released per week folder.

## WORK-09: a second agent, tested for its place

Does a second agent lift the smallest model to the bar on the same eight briefs and the same checker, and does it cost less a brief than the largest model alone? Four arms, all on the same server, cases, expected fact lists, fixed gate answer and checker. The design, the reviewer's instructions in full and the review checklist are in `WORK-09-DESIGN.md`; the words the agents get live in `arms/`.

| Arm | Flag | What runs | Runs |
|---|---|---|---|
| A1 | `--arm one`, smallest model | one agent, one pass, the skill as it stands | 5 |
| A2 | `--arm review` | one agent that goes through the review checklist on its own draft and records it with `record_review` before `draft_brief` | 5 |
| B | `--arm reviewer` | a drafter that sends its draft once to `review_draft`, where a reviewer agent in a fresh conversation reads the same sources and returns findings | 5 |
| Ceiling | `--arm one`, largest model, effort high | one agent, one pass | 3 |

With `--arm`, a run is recorded in `eval/results-arms/<label>.json` with a trace per brief in `eval/results-arms/<label>/`, and `eval/ARMS.md` is rebuilt; `eval/results/` and `eval/EXEMPLAR.md` are untouched. Without `--arm`, the harness runs and records as it does for v1.3.

| Path | What it is |
|---|---|
| `arms/checklist.md` | The review checklist: the same bytes in the A2 drafter, the B drafter and the B reviewer. |
| `arms/review_step.md`, `arms/reviewer_step.md` | The tool line and step 5 that replace step 5 of the skill for A2 and for B. |
| `arms/reviewer.md` | The reviewer's instructions; the checklist goes in at `{{CHECKLIST}}`. |
| `eval/arms.js` | Builds each arm's instructions and harness tools; the change matcher; the trace. |
| `eval/arms_page.js` | Builds `eval/ARMS.md` and applies the verdict rule once every arm has its runs. |
| `eval/review_effect.js` | The before-review check: runs the unchanged checker on each A2 and B draft as it stood before review and names every sentence the review broke or fixed. |
| `eval/results-arms/` | One record per counted arm run, and its eight traces. |
| `eval/ARMS.md` | The arms page, rebuilt from `eval/results-arms/` after every run. |

Prove the plumbing first (no API call, never recorded). Each mock also checks that the reviewer's copied tables match `skill/SKILL.md` and that the checklist is carried whole in all three places:

```
node eval/run_eval.js --mock --arm one
node eval/run_eval.js --mock --arm review
node eval/run_eval.js --mock --arm reviewer
```

The real runs, 18 in all, in this order, so the arms take turns and a change in the API over the hours of running falls on every arm alike. Each needs the key in `.env`:

```
node eval/run_eval.js --arm one --model claude-haiku-5-5
node eval/run_eval.js --arm review --model claude-haiku-5-5
node eval/run_eval.js --arm reviewer --model claude-haiku-5-5
node eval/run_eval.js --arm one --model claude-opus-5-5 --effort high
node eval/run_eval.js --arm one --model claude-haiku-5-5
node eval/run_eval.js --arm review --model claude-haiku-5-5
node eval/run_eval.js --arm reviewer --model claude-haiku-5-5
node eval/run_eval.js --arm one --model claude-opus-5-5 --effort high
node eval/run_eval.js --arm one --model claude-haiku-5-5
node eval/run_eval.js --arm review --model claude-haiku-5-5
node eval/run_eval.js --arm reviewer --model claude-haiku-5-5
node eval/run_eval.js --arm one --model claude-opus-5-5 --effort high
node eval/run_eval.js --arm one --model claude-haiku-5-5
node eval/run_eval.js --arm review --model claude-haiku-5-5
node eval/run_eval.js --arm reviewer --model claude-haiku-5-5
node eval/run_eval.js --arm one --model claude-haiku-5-5
node eval/run_eval.js --arm review --model claude-haiku-5-5
node eval/run_eval.js --arm reviewer --model claude-haiku-5-5
```

`node eval/run_eval.js --arms-page` rebuilds `eval/ARMS.md` from the records without running anything. `node eval/review_effect.js` reruns the before-review check on every recorded A2 and B run (or `node eval/review_effect.js <label>` on one) and prints each sentence broken or fixed by review, with its reason; it also confirms that the checker, run again on each submitted draft, removes exactly what the run recorded. `eval/ARMS.md` carries the same counts per arm and marks every miss and removal the review introduced. A run that ends on a missed bar exits with code 1, as every harness run does; the next command still runs.

**The verdict rule, fixed before the first run:** B earns its place only if it meets the bar in more of its five runs than A2 and its median cost a brief stays below the ceiling's median over its three runs. If A2 meets the bar in as many of five runs as B, or more, the second agent is folded, and the review step stays in the skill only if A2 meets the bar in more of five runs than A1. Ties go to the arm with fewer parts. If neither A2 nor B meets the bar in any run, the page says so and names every miss.

## WORK-10: when the week no longer fits in one read

The same job and the same checker on a week grown from six files to about two hundred, in Python on LangGraph, with the existing tool server unchanged behind it. The design and every decision are in `WORK-10-DESIGN.md`. All new code is in `graph/`; nothing in `lib/`, `server.js`, `eval/check.js`, `eval/run_eval.js`, `eval/expected/`, `data/cases/`, `data/week/`, `skill/SKILL.md`, `arms/` or the WORK-09 records changes.

**The grown week.** `node graph/make_grown.mjs` copies each `data/cases/<case>` folder byte for byte into `data/cases-grown/<case>` and writes 200 archive files beside the six: 25 earlier weeks of project, supplier, meeting and risk notes, released briefs, and tracker, answers and decision log snapshots, with near misses on purpose (the same metrics with older values, older actions under the same ids). `node graph/prove_grown.mjs` proves, before any model call, that the archive fires no gate the six-file case does not fire: the six files identical, the archive's shape, the declined lists, every tracker date claim, every expected sentence through the checker, a forbidden scan, and a scripted stand-in through the real server meeting the bar.

**The graph** (`graph/sb_graph.py`): sources (list and read every file through the server's tools), retrieve (build the index, pick the lines), draft (one model call, JSON schema output), record_stops (the server's `stop` tool), wait (a LangGraph `interrupt()` on a disagreement; the runner plays the person with the fixed answer in `eval/answers.txt`), submit (`draft_brief` once), record. The server is reached over MCP with `langchain.mcp.MCPAdapter`, one `server.js` process and one session a brief. The index has one entry per line or row with its reference in the server's grammar; K searches it with BM25 (`bm25s`), V with a local embedding model (`fastembed`, `BAAI/bge-small-en-v1.5`, in `graph/models/`, no key) in `InMemoryVectorStore`. The five section queries are fixed and hashed in `graph/queries.json`.

**The arms:** P the graph reading every entry of `data/cases`; PG every entry of `data/cases-grown`; E the Node harness as it stands, run on the grown week in a scratch copy of the repo; K and V the top 20 lines a section of the grown week. `graph/check_case.mjs` is the one checker (it imports `eval/check.js`) and the only reader of `eval/expected/` in a run; it also names each miss a retrieval miss or a drafting miss, and measures recall in stage 0.

```bash
cd graph && uv sync                                   # Python 3.12 and the pinned packages, from uv.lock
uv run run.py --arm P --mock                          # no API call: a local stand-in; never recorded (also PG, K, V, E)
uv run run.py stage0                                  # recall and the captured requests; no API call
uv run run.py stage0 --count                          # adds the token counts (free endpoint) and the forecast
uv run run.py --arm K --model claude-haiku-5-5 --stage 1
```

Each paid run is priced call by call from `graph/prices.json` (both Haiku 5.5 tiers) and entered in the spend ledger `eval/results-graph/spend.json`, capped at US$8.00; a run whose forecast would pass the cap is refused, and one whose cost passes twice its forecast holds its stage. Records go to `eval/results-graph/<label>.json` with a trace per brief.

**The results page** is `eval/GRAPH.md`, rebuilt from the records with `node graph/page.mjs`.

The stage 0 request captures (`eval/results-graph/stage0/requests/` and `recount-*/`) are not committed: `uv run run.py stage0` rebuilds them (`--arm F` for arm F's, `--recount` for the recount, which calls the free token counting endpoint), and their token counts are in `eval/results-graph/forecast.json`.

## Limits

One synthetic week folder; six source files in the shapes of the three earlier builds; five fixed sections; the disagreement rule reads an action id and a date on one document line; a name is any two capitalised words; one brief per week folder; a number is checked as present at its source, not for what the sentence uses it to count; no chart, no export, no external system connected.

Found in WORK-09: the v1.3 results records keep the count of removed sentences and drop the checker's reason, and the run folders that held `unsourced.md` sit outside this repo, so the reason for the last smallest model State B removal is unknown here (the arm traces keep every reason); the v1.3 transcript cuts each tool result at 4,000 characters (the arm traces keep them whole); the reviewer's reads go through the same server and add read lines to `run_log.csv`, which the checker does not score; the review checklist restates the skill, so it can catch only a fault the skill already describes; five runs per small model arm separate arms by whole runs out of five, and a one run difference is weak evidence; the arms page first linked a miss to a finding by matching text alone, so a removal the review caused read as a fault the review named (A2 run W202611121907, finding F5), and the page now marks every removal whose sentence passed the checker before review as introduced after review; the before-review check judges sentences with the claim checker and does not run the case checker on the draft before review, so it says which removals the review caused and cannot say which runs would have met the bar without review; it pairs each sentence after review with one before review by exact text, then by order within its section, so a reordered section can pair two unrelated sentences.
