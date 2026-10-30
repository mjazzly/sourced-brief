# Sourced Brief, v1.2

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

## Limits

One synthetic week folder; six source files in the shapes of the three earlier builds; five fixed sections; the disagreement rule reads an action id and a date on one document line; a name is any two capitalised words; one brief per week folder; a number is checked as present at its source, not for what the sentence uses it to count; no chart, no export, no external system connected.
