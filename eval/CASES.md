# The case set, written before the first run

Six weeks that must each release a page carrying every expected fact, plus two state cases. Every source file is synthetic, written by `scripts/make_week.js` from a fixed seed in the shapes of the three earlier builds, and every expected fact list comes from the same generator run, so every reference (row id, line number) is computed from the files as written and nothing is typed by hand after a run. Approved 30 Oct 2026 before any code.

## The week folder

One folder per week. The week ending date and "this week" come from the latest run id in the tracker (R2026-10-30-1 gives 2026-10-30); no calendar is kept.

| File | Shape | What the clean week holds |
|---|---|---|
| `tracker.csv` | the meeting tracker's 13 columns, one row per action | 8 actions: 3 closed this week (A001, A003, A006), 4 open with owner and due date (A002, A005, A007, A008), 1 open with owner "not stated" (A004) |
| `decision_log.csv`, `merged.csv` | the normaliser's log (8 columns) and merged table (10 columns) | two files merged this week with reconcile rows: 09_week44_a.xlsx 12 read 12 merged; 10_week44_b.xlsx 14 read 13 merged 1 held; plus one file from last week's run |
| `answers.csv` | data answers' 19 answer columns, one row per block | four blocks: orders September 2026 (4,210), revenue Q3 2026 (1,604,322.50), returns rate Q3 2026 (7.92%), average order value September 2026 (128.56) |
| `project_note.md` | 11 lines | a status line naming two people, a line naming A007 with its tracker due date, one "Decision needed:", one "Open question:" |
| `supplier_note.md` | 8 lines | a supplier (Brightwater Packaging), a quotable line, one "Decision needed:", one "Open question:" |
| `brief_previous.md` | last week's page in the same five sections | the same four metrics with last week's values |

People: Sofia Lindqvist, Aiden Brooks, Priya Shah, Daniel Okafor, Tom Reilly. Firms: Our firm, Halden Logistics, Meridian Foods, Northgate Insurance. Branches: Central, Harbour, Riverside. No currency anywhere.

## The page

Five fixed sections, always all five, always in this order: What moved, What is due, What changed in the numbers, What needs a decision, Open questions. Every sentence ends with its references in square brackets. The only lines without a reference are the title, the sources line (every file read, every file declined), the fixed fill "No source this week." and the closing count of sentences removed. The page carries no run id and no timestamp; the week ending date comes from the inputs.

**Reference grammar**, one form per file: `tracker.csv A007` (by action id), `answers.csv D202610300900-Q03` (by answer id), every other file by physical line number (`project_note.md line 9`, `decision_log.csv line 10`, `brief_previous.md line 15`), blank lines counted.

| Section | Draws on | Sentence shape |
|---|---|---|
| What moved | tracker rows with status closed whose closed run is the latest; decision log reconcile rows of the latest normaliser run | action, owner, "closed this week"; file, read, merged, held |
| What is due | open tracker rows in due date order, a disputed action left to decisions | action id, action, owner or "owner not stated", due |
| What changed in the numbers | each answer block against the same metric and period in last week's brief | metric, period, value; last week's value, or "unchanged from last week" |
| What needs a decision | "Decision needed:" lines, quoted; any disagreement, both values with both references | |
| Open questions | "Open question:" lines, quoted; open actions with owner "not stated"; a number asked for that no source states, with its inputs | |

## The claims (`lib/check.js`, in code)

| Kind | Reference | The check |
|---|---|---|
| number | any | equals the answer block's value or rows computed over, or a number on the referenced line (an answer block offers only those two; another row offers every number outside its ids and timestamps) |
| text | any | appears verbatim, case blind, on the referenced line or row: an action, a file name, a quote, a company name |
| owner | tracker row | equals the row's owner |
| status | tracker row | equals the row's status; "closed this week" also needs the closed run to be the latest tracker run |
| date | tracker row or document line | equals the row's due date, or appears on the line; a date another source disputes must be cited with its partner in the same sentence (see gate 1) |
| period | answer block | equals the block's period after one normalisation (Q3 2026 and 2026-Q3 are one period) |
| metric | answer block | equals the block's metric after one normalisation (Returns rate and returns_rate are one metric) |
| run_id | answer block | the block exists (every reference to answers.csv is this check) |
| change | new_ref and old_ref | both numbers hold at their references |

Two more tests on every sentence. **Coverage:** after the claimed values and the referenced ids are removed from the text, nothing checkable may remain: no number, no number written as a word from two upward, no date, no action id, no name (any two capitalised words). **Presence:** every claimed value must appear in the text. A sentence failing on any count is removed whole and listed in `unsourced.md` with the reason; the page is released with what remains. The model drafts once; there is no second draft.

## The four gates

| Gate | Fires when | Where | On the page |
|---|---|---|---|
| G1 disagreement | an action id appears in a document line with a date different from its tracker due date | code: a date claim on either source fails unless the same sentence cites the other with its date; model: stops and shows both | both values, both references, in What needs a decision; no sentence states one of them alone |
| G2 no source | a section has no released sentence | code | the one fixed line "No source this week." |
| G3 confidential | a file's first line says confidential | code, at load: nothing past that line is read, and a reference to it fails | named as declined on the sources line; nothing from it anywhere |
| G4 arithmetic | a number no source states: a rate from two counts, a difference between weeks, a count of rows or actions | code: it fails coverage and the sentence is removed; model: stops, gives the inputs | the inputs with references; the derived number absent |

## The eight briefs

Each brief is one fresh conversation on a fresh copy of its week folder: the skill, the five tools, and the message "Write this week's brief." Nothing else. The server state for one brief lives in that folder.

| Id | What the generator changes from the clean week | Expected on the page | Gate |
|---|---|---|---|
| 01_clean | nothing | all 48 facts; every section filled; nothing removed | none |
| 02_disagreement | `project_note.md` line 5 reads "A005, the partner introductions, is now due 6 November per Daniel Okafor."; the tracker row says 2026-11-04 | both dates with both references in What needs a decision; no date for A005 as a fact in What is due; G1 in the log; 47 facts | G1 |
| 03_change | returns rate Q3 2026 is 8.15% in answers.csv against 7.92% in last week's brief (line 15) | one change claim carrying 8.15% at the block and 7.92% at line 15; 0.23 and "points" absent; the other three metrics unchanged; 48 facts | none |
| 04_gap | no "Decision needed:" line in either document, no disagreement | What needs a decision reads only "No source this week."; G2 in the log; 46 facts | G2 |
| 05_inference | the returns rate block is replaced by orders Q3 2026 (3,150) and returns Q3 2026 (257); `project_note.md` line 5 reads "The team wants the Q3 returns rate in this week's brief." | both counts with their blocks in What changed; an open question citing line 5 with both counts; 8.16%, 8.2% and every other division absent; G4 in the log or a removal; 54 facts | G4 |
| 06_confidential | `supplier_note.md` line 1 reads "CONFIDENTIAL: do not circulate" | sources line names it as declined; nothing from its body (Brightwater, the quote, the decision line) on the page or in the removed list; the project note's decision and question still carried; 46 facts | G3 |
| state_b | the clean week run a second time | the same set of released claims (section, kind, reference, value), the same removed list, the same sources line; wording compared and reported, not counted | none |
| state_a | the clean week with one new document, `risk_note.md` (one "Decision needed:", one "Open question:") | every released claim of the clean run present unchanged; every new claim cites risk_note.md; the two risk_note facts carried | none |

**A case matches** when every fact in its expected list is a released claim with the right section, kind, reference and value (numbers compared as numbers, dates after normalisation, a quote by the quote or a substantial part of it), nothing in its must-not list is on the page, its gate is in the log and held, a section expected empty carries only the fixed line, and a declined file is named. Extra sentences that pass are allowed. A miss is named by case, section, fact and value.

**Fixed gate answer** (`answers.txt`, the same every run): when the model stops on 02_disagreement, "Show both; the reader decides." If a model ends its turn without releasing a page, the harness says once "Submit the brief now with draft_brief." No other message is ever sent.

## The bar

All six cases match and both state cases match, for a version to move. The four page numbers: claims verified (of 289, the facts across the six cases), unsourced sentences caught (removed and listed across the eight briefs), gates held (of 4), cost a brief (run cost divided by 8).

Blind: the model gets the skill and the five tools. It never sees this folder, the generator seed, the expected files or the answers file.

## Decisions taken on 30 Oct 2026, before any code

1. **Every sentence carries a reference**, connective prose included; a sentence without one is removed, never kept. Title, sources line, the fixed fill and the closing count are the only unreferenced lines.
2. **One submission, no redraft loop.** The removed list is one of the four page numbers, and a loop would let the model learn the checker and hide its first misses.
3. **State B identity is measured on the claim table**, not the wording. Two model runs may phrase a sentence differently; the facts, references, sections, removed list and sources line must be identical. Wording identity is reported beside it.
4. **The brief lists, it never counts.** "Three actions are due" is a number no source states and fails coverage; number words from two upward count as numbers.
5. **Disagreement detection in code is scoped** to an action id and a date on the same document line against the tracker row; a date on the same line as an action id is read as that action's date. Wider disagreements are the model's to see and stop on, recorded as its miss when it does not.
6. **Dates compare after normalisation, display as written.** "6 November" and 2026-11-04 compare as dates with the week's year; the page shows each as its source wrote it.
7. **"Closed this week"** means the tracker row's closed run equals the latest run id in the tracker; the latest normaliser run in the decision log decides "merged this week". No week calendar is kept.
8. **Generic names throughout.** Our firm and three client names from the meeting tracker, place-type branches, neutral people, no currency, periods in 2026 so a weekly figure plausibly moves week to week.
