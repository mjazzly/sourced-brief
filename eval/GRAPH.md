# WORK-10: when the week no longer fits in one read

Built by `node graph/page.mjs` from the records in `eval/results-graph/`, `eval/results-arms/` (WORK-09) and `data/cases-grown/`; never edited by hand. The design, every decision and the signed predictions are in `WORK-10-DESIGN.md`. One model drafted in every run: claude-haiku-5-5, the smallest. "Graph" here means a LangGraph state graph (an orchestration graph); "retrieval" means choosing which source lines the drafter sees (retrieval-augmented generation, RAG); "index" means the searchable store of source lines (a search index, for V a vector index).

## The three questions

**1. When the week grows past what one read can hold, does a graph that retrieves keep the bar the six-file week set?**

Not with retrieval by query. At 20 lines a section, keyword retrieval (K) and vector retrieval (V) never showed the drafter every expected reference in any of the 8 briefs (K found at most 4 of 24, V 2 in every brief), and their single illustration runs matched 0 and 0 of 8. Keeping only this week's files (F) showed the drafter every expected reference in every brief, yet by the rule fixed before the runs F does not keep the bar: it met it in 1 of 5 runs against 2 of 5 for the graph on the six-file week (P). At 200 documents the week still fits one read: the graph reading all of it (PG) matched 7 of 8 in its single run.

**2. Does a vector index earn its place over a plain keyword search on this job?**

No. At 20 lines a section V showed the drafter 2 expected references a brief against K's 1 to 4, so neither can match a brief, and under the verdict recorded from stage 0 V does not earn its place over K; each single illustration run matched 0 of 8. V's index (a vector index) also took 27.8 seconds a brief to build, against 0.018 for K's keyword index.

**3. What does each route cost a brief, in money and seconds?**

On the smallest model: F US$0.0086 and 51.4 seconds a brief, against P's US$0.0082 and 51.7 on the six-file week. Reading the whole grown week in one call (PG) cost US$0.1124 a brief, about 13 times F, because its prompt of about 141,000 tokens crosses Haiku's 100,000-token price line. The agent loop (E) cost US$0.0117 a brief only because it read 6 to 8 files of 207 and skipped the archive by file name.

## The arms

Every WORK-10 arm drafted with claude-haiku-5-5. Cost a brief is the mean over the arm's counted runs, priced call by call from `graph/prices.json` (both Haiku tiers). Seconds a brief is the whole brief; the index and the draft call are shown apart. WORK-09's arms on the six-file week are below the line, from `eval/results-arms/`, priced as WORK-09 priced them.

| Arm | What it is | Folder | Counted runs | Briefs matched (of 8), each run | Bar met | Cost a brief | Seconds a brief | of which index | of which draft call |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **P** | the graph reading every line of the six-file week | `data/cases` | 5 | 7, 6, 8, 8, 6 | 2 of 5 | US$0.0082 | 51.7 | none | 51.5 |
| **F** | the graph keeping only lines from files of this week and the week before, the week read from each file's content; no query, no index model | `data/cases-grown` | 5 | 6, 5, 5, 4, 8 | 1 of 5 | US$0.0086 | 51.4 | 0.004 | 51.2 |
| **K** (illustration) | the graph with keyword retrieval (BM25), top 20 lines a section | `data/cases-grown` | 1 | 0 | 0 of 1 | US$0.0039 | 19.2 | 0.018 | 18.9 |
| **V** (illustration) | the graph with vector retrieval (a local embedding model), top 20 lines a section | `data/cases-grown` | 1 | 0 | 0 of 1 | US$0.0036 | 46.0 | 27.8 | 17.8 |
| **PG** | the graph reading every line of the grown week | `data/cases-grown` | 1 | 7 | 0 of 1 | US$0.1124 | 63.8 | none | 63.5 |
| **E** | the WORK-09 agent loop (arm A1, the Node harness) unchanged, on the grown week | `data/cases-grown` | 1 | 6 | 0 of 1 | US$0.0117 | 46.4 | none | not split (4 to 5 calls) |
| A1 | WORK-09: one agent, one pass | `data/cases` | 5 | 6, 7, 6, 4, 5 | 0 of 5 | US$0.0080 | 39.8 | none | not split |
| A2 | WORK-09: one agent that reviews its own draft | `data/cases` | 5 | 6, 8, 6, 7, 7 | 1 of 5 | US$0.0113 | 55.2 | none | not split |
| Ceiling | WORK-09: one agent, one pass, largest model (claude-opus-5-5, effort high) | `data/cases` | 3 | 7, 8, 8 | 2 of 3 | US$0.2128 | 49.6 | none | not split |

P and F ran five times each and decide the verdict for F. K and V ran once each as illustration, outside any verdict. PG and E ran once each: single runs, reported for misses, cost and seconds, deciding nothing. V's index is rebuilt for each brief; F's "index" is the week read from each file's content (0.004 seconds). E's seconds are the Node harness's own figure.

Every counted graph run ran on Python 3.12.13, langgraph 1.2.22, langchain 1.5.0, langchain-core 1.8.1, langchain-anthropic 1.7.10, mcp 2.3.0, bm25s 0.3.16 and fastembed 0.9.1 (`uv.lock` 546c6d414fee), with the server reached through `MCPAdapter` (route `adapter`).

PG showed the drafter every line of the grown week (1,707 to 1,716 entries a brief); none of the 151 sentences it released cites an archived file. E, the agent loop, chose its own reads; in no brief did it read an archived file:

| Briefs | Model calls | Files read |
| --- | --- | --- |
| 01_clean, 03_change, state_b | 4 | 7: answers.csv, brief_previous.md, decision_log.csv, merged.csv, project_note.md, supplier_note.md, tracker.csv |
| 02_disagreement, 04_gap, 05_inference | 5 | 7: answers.csv, brief_previous.md, decision_log.csv, merged.csv, project_note.md, supplier_note.md, tracker.csv |
| 06_confidential | 4 | 6: answers.csv, brief_previous.md, decision_log.csv, merged.csv, project_note.md, tracker.csv |
| state_a | 4 | 8: answers.csv, brief_previous.md, decision_log.csv, merged.csv, project_note.md, risk_note.md, supplier_note.md, tracker.csv |

## Recall at stage 0: K and V

Recall is the expected facts' references among the lines the drafter would see (found / expected), measured with no model call, before any paid run, with the fixed queries (hash `0cf884ee…2f1c`). The grown week has 1,707 to 1,716 index entries a brief.

| Arm | k | 01_clean | 02_disagreement | 03_change | 04_gap | 05_inference | 06_confidential | state_b | state_a |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K | 5 | 2/22 | 2/23 | 2/22 | 0/20 | 2/23 | 1/20 | 2/22 | 3/24 |
| K | 10 | 2/22 | 2/23 | 2/22 | 0/20 | 2/23 | 1/20 | 2/22 | 4/24 |
| K | 20 | 3/22 | 3/23 | 3/22 | 1/20 | 3/23 | 2/20 | 3/22 | 4/24 |
| K | 40 | 5/22 | 5/23 | 5/22 | 3/20 | 5/23 | 4/20 | 5/22 | 6/24 |
| V | 5 | 0/22 | 0/23 | 0/22 | 0/20 | 0/23 | 0/20 | 0/22 | 0/24 |
| V | 10 | 0/22 | 0/23 | 0/22 | 0/20 | 0/23 | 0/20 | 0/22 | 0/24 |
| V | 20 | 2/22 | 2/23 | 2/22 | 2/20 | 2/23 | 2/20 | 2/22 | 2/24 |
| V | 40 | 5/22 | 5/23 | 5/22 | 4/20 | 5/23 | 5/20 | 5/22 | 6/24 |
| F | all of the week | 22/22 | 23/23 | 22/22 | 20/20 | 23/23 | 20/20 | 22/22 | 24/24 |

At k = 20, the value every paid run used, K finds every expected reference in 0 of 8 briefs and V in 0 of 8; 314 expected references go unshown across the 16 arm-briefs. Under the stop rule fixed for stage 0, no brief of K or V can match.

**Why both miss.** Of the 98 lines K shows the drafter in a brief, 3 to 5 come from the week's own files; for V, 3 to 4 of 100. The rest are archive lines. Nothing in a query separates this week's lines from earlier weeks' lines, so the archive's near misses (the same metrics, owners, action ids and words, from 25 earlier weeks) fill the top of every section. The queries, the tokenizer and k were not changed after recall was seen.

The version 1 verdict, recorded from stage 0 alone: K and V cannot keep the bar at k = 20, and V does not earn its place over K. At 20 lines a section neither finds every expected reference in any of the eight briefs (K at most 4 of 24, V 2 in every brief), so under the stop rule no brief of either can match, and no paid run is needed to reach the verdict. The cause is the same for both: nothing in a query separates this week's lines from earlier weeks' lines, so the archive's near misses (the same shapes, metrics, owners and words, often in shorter lines) fill the top of every section. Queries version 1 stays as it is, with its hash `0cf884ee…2f1c` and its recall above.

## The verdict for F

The rule, as fixed before the first run (`WORK-10-DESIGN.md`, section 6):

> **The verdict rule for F, fixed before the first run.** F keeps the bar if it meets the bar in at least as many of its five runs as P. When F and P meet the bar in the same number of runs, the tie is broken by median briefs matched of 8: F keeps the bar if its median is at least P's. Recall is reported beside it and decides nothing; P and F share the smallest model's base miss rate (0 of 5 alone on the six-file week, `eval/ARMS.md`), which is why the rule reads F against P and not against the bar alone.

**F does not keep the bar.** F met the bar in 1 of 5 runs and P in 2 of 5. The rule reads bar met first, so the tie-break does not apply. Median briefs matched, reported only: F 5, P 7.

Beside the verdict, which they do not change:

- **Identical lines.** In every brief of every F run, F showed the drafter exactly the lines P showed for that case (checked line by line in the traces). The two arms' draft requests differ by one line, the list of file names, which in F names all 207 files of the grown folder.
- **Complete recall.** F's recall was complete in every brief of all five F runs; every miss in F is a drafting miss, none a retrieval miss.
- **A gap of one run.** P 2 of 5, F 1 of 5.
- **Pooled, 3 of 10.** The graph met the bar in 3 of the 10 runs of P and F together.
- **WORK-09 on the six-file week** (`eval/ARMS.md`), the same smallest model: A1, one agent alone, met the bar in 0 of 5 runs, briefs matched 6, 7, 6, 4, 5; A2, with the review step, 1 of 5 (6, 8, 6, 7, 7); the largest model (Ceiling) 2 of 3 (7, 8, 8). P, the graph on the same week, met it in 2 of 5, briefs matched 7, 6, 8, 8, 6. The smallest model misses often on its own, so a miss in F is not by itself a retrieval effect.

## Predictions beside the results

Megat's predictions, word for word from `WORK-10-DESIGN.md`, each written and signed before the runs it predicts.

| Prediction | Written | Result |
| --- | --- | --- |
| At 20 lines a section, keyword search (K) finds every expected reference in 4 of 8 briefs, and vector search (V) in 3 of 8. | Written 16 Nov 2026, before stage 0 ran and before any recall was measured. | K: 0 of 8. V: 0 of 8. |
| F finds every expected reference in 6 of 8 briefs. | Written 16 Nov 2026, before arm F's recall was measured | 8 of 8 |
| P meets the bar in 1 of 5 runs. | Written 16 Nov 2026, before any paid run of stage 1 | 2 of 5 |
| F meets the bar in 3 of 5 runs. | Written 16 Nov 2026, before any paid run of stage 1 | 1 of 5 |
| In the K and V illustration runs, at least one out-of-date fact from an archived file reaches a released page: yes. | Written 16 Nov 2026, before any paid run of stage 1 | No. 0 of the 36 sentences K and V released cite an archived file. K drafted 1 that did, and the checker removed it for a different claim (see the limits). |
| PG matches 5 of 8 briefs. | Written 16 Nov 2026, after stage 1 and before any stage 2 run | 7 of 8 (one run) |
| E matches 4 of 8 briefs. | Written 16 Nov 2026, after stage 1 and before any stage 2 run | 6 of 8 (one run) |

## Every run

Every record in `eval/results-graph/`, in the order run. Briefs matched is of 8 (of 1 for a one-brief run); claims verified is over the six cases. Cost is what the ledger holds for the run.

| Run | Arm | Stage | Counted | Folder | Briefs matched | Claims verified | Removed | Gates held | Bar | Cost | Seconds a brief | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G202611161522-P | P | 1 | no | `data/cases` | no page |  | 0 |  | n/a | US$0.0000 |  | refused on its first draft call: 400, the compiled grammar is too large |
| G202611161523-F | F | 1 | no | `data/cases-grown` | no page |  | 0 |  | n/a | US$0.0000 |  | refused on its first draft call: 400, the compiled grammar is too large |
| G202611161523-P | P | 1 | no | `data/cases` | no page |  | 0 |  | n/a | US$0.0000 |  | refused on its first draft call: 400, the compiled grammar is too large |
| G202611161524-F | F | 1 | no | `data/cases-grown` | no page |  | 0 |  | n/a | US$0.0000 |  | refused on its first draft call: 400, the compiled grammar is too large |
| G202611161524-K | K | 1 | no | `data/cases-grown` | no page |  | 0 |  | n/a | US$0.0000 |  | refused on its first draft call: 400, the compiled grammar is too large |
| G202611161524-P | P | 1 | no | `data/cases` | no page |  | 0 |  | n/a | US$0.0000 |  | refused on its first draft call: 400, the compiled grammar is too large |
| G202611161524-V | V | 1 | no | `data/cases-grown` | no page |  | 0 |  | n/a | US$0.0000 |  | refused on its first draft call: 400, the compiled grammar is too large |
| G20261116154635-P | P | 1 | no | `data/cases` | 3 of 8 | 279 of 289 | 5 | 4 of 4 | missed | US$0.0663 | 51.6 | run under the 16,000 output-token cap; 05_inference and state_a ended on max_tokens |
| G20261116161032-P | P | 1 | no | `data/cases` | 1 of 1 | 54 of 54 | 0 | 1 of 1 | n/a | US$0.0093 | 60.0 | test brief, 05_inference only, after the change to streaming and 32,000 |
| G20261116161815-P | P | 1 | yes | `data/cases` | 7 of 8 | 283 of 289 | 2 | 4 of 4 | missed | US$0.0648 | 49.9 |  |
| G20261116162922-F | F | 1 | yes | `data/cases-grown` | 6 of 8 | 288 of 289 | 2 | 4 of 4 | missed | US$0.0689 | 51.4 |  |
| G20261116163844-P | P | 1 | yes | `data/cases` | 6 of 8 | 282 of 289 | 3 | 4 of 4 | missed | US$0.0671 | 52.6 |  |
| G20261116164842-F | F | 1 | yes | `data/cases-grown` | 5 of 8 | 283 of 289 | 4 | 4 of 4 | missed | US$0.0692 | 52.5 |  |
| G20261116165638-P | P | 1 | yes | `data/cases` | 8 of 8 | 289 of 289 | 0 | 4 of 4 | **met** | US$0.0652 | 55.3 |  |
| G20261116170703-F | F | 1 | yes | `data/cases-grown` | 5 of 8 | 282 of 289 | 4 | 4 of 4 | missed | US$0.0664 | 49.3 |  |
| G20261116171638-P | P | 1 | yes | `data/cases` | 8 of 8 | 289 of 289 | 0 | 4 of 4 | **met** | US$0.0679 | 52.9 |  |
| G20261116200514-F | F | 1 | yes | `data/cases-grown` | 4 of 8 | 286 of 289 | 2 | 4 of 4 | missed | US$0.0680 | 51.2 |  |
| G20261116201521-P | P | 1 | yes | `data/cases` | 6 of 8 | 219 of 289 | 0 | 4 of 4 | missed | US$0.0615 | 47.7 |  |
| G20261116202332-F | F | 1 | yes | `data/cases-grown` | 8 of 8 | 289 of 289 | 0 | 4 of 4 | **met** | US$0.0703 | 52.8 |  |
| G20261116204334-K | K | 1 | yes | `data/cases-grown` | 0 of 8 | 27 of 289 | 1 | 2 of 4 | missed | US$0.0309 | 19.2 | illustration, outside the verdict |
| G20261116204906-V | V | 1 | yes | `data/cases-grown` | 0 of 8 | 36 of 289 | 2 | 2 of 4 | missed | US$0.0287 | 46.0 | illustration, outside the verdict |
| G20261116211827-E | E | 2 | no | `data/cases-grown` | 0 of 1 | 42 of 48 | 2 | 0 of 0 | n/a | US$0.0667 | 52.1 | uncounted E brief (`--only 01_clean`, `--max-calls 120`); ledger cost an upper bound |
| G20261116212543-E | E | 2 | no | `data/cases-grown` | 1 of 1 | 48 of 48 | 0 | 0 of 0 | n/a | US$0.0612 | 45.4 | uncounted E brief (`--only 01_clean`, `--max-calls 120`); ledger cost an upper bound |
| G20261116213400-PG | PG | 2 | yes | `data/cases-grown` | 7 of 8 | 289 of 289 | 1 | 4 of 4 | missed | US$0.8993 | 63.8 |  |
| G20261116214312-E | E | 2 | yes | `data/cases-grown` | 6 of 8 | 280 of 289 | 3 | 4 of 4 | missed | US$0.0934 | 46.5 |  |

Also in the ledger: the grammar probe `PROBE20261116153722-P-haiku-5-5`, one draft request with `max_tokens` 1 that checked the flat schema was accepted (status accepted, stop reason max_tokens, US$0.0013).

## Every miss

Each line is the checker's own words. For the graph arms each missing fact is marked as the record names it: a **drafting miss** (the line was shown to the drafter and the page lacks the fact) or a **retrieval miss** (the line was never shown). E's misses are not split: the agent loop chose its own reads. Lines that are not a missing fact (for the state cases) are marked *state*.

**G20261116161815-P** (P)
- **02_disagreement** (41 of 47 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
  - drafting miss: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "14" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "13" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "1" (decision_log.csv line 10)

**G20261116162922-F** (F)
- **03_change** (47 of 48 facts)
  - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
- **state_a** (48 of 50 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
  - *state*: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 7

**G20261116163844-P** (P)
- **02_disagreement** (46 of 47 facts)
  - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
- **04_gap** (40 of 46 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
  - drafting miss: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "14" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "13" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "1" (decision_log.csv line 10)

**G20261116164842-F** (F)
- **02_disagreement** (41 of 47 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
  - drafting miss: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "14" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "13" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "1" (decision_log.csv line 10)
- **state_b** (46 of 48 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
  - *state*: a sentence in the first run and not the second: what_moved | decision_log.csv line 7
  - *state*: the removed list differs between the two runs
- **state_a** (48 of 50 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
  - *state*: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 7

**G20261116165638-P** (P): no miss; every brief matched.

**G20261116170703-F** (F)
- **02_disagreement** (41 of 47 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
  - drafting miss: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "14" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "13" (decision_log.csv line 10)
  - drafting miss: missing What moved: number "1" (decision_log.csv line 10)
- **03_change** (47 of 48 facts)
  - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
- **state_b** (47 of 48 facts)
  - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
  - *state*: a sentence in the first run and not the second: open_questions | supplier_note.md line 8
  - *state*: the removed list differs between the two runs

**G20261116171638-P** (P): no miss; every brief matched.

**G20261116200514-F** (F)
- **01_clean** (47 of 48 facts)
  - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
- **06_confidential** (44 of 46 facts)
  - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
- **state_b** (48 of 48 facts)
  - *state*: a sentence in the second run and not the first: open_questions | supplier_note.md line 8
  - *state*: the removed list differs between the two runs
- **state_a** (50 of 50 facts)
  - *state*: a new sentence that does not cite risk_note.md: open_questions | supplier_note.md line 8

**G20261116201521-P** (P)
- **05_inference** (15 of 54 facts)
  - drafting miss: missing What is due: text "Send the draft category taxonomy" (tracker.csv A002)
  - drafting miss: missing What is due: owner "Aiden Brooks" (tracker.csv A002)
  - drafting miss: missing What is due: date "2026-11-03" (tracker.csv A002)
  - drafting miss: missing What is due: text "Set up the introductions to the three logistics partners" (tracker.csv A005)
  - drafting miss: missing What is due: owner "Daniel Okafor" (tracker.csv A005)
  - drafting miss: missing What is due: date "2026-11-04" (tracker.csv A005)
  - drafting miss: missing What is due: text "Send the revised price list to the distributors" (tracker.csv A004)
  - drafting miss: missing What is due: owner "not stated" (tracker.csv A004)
  - drafting miss: missing What is due: date "2026-11-05" (tracker.csv A004)
  - drafting miss: missing What is due: text "Draft the board summary of the claims review" (tracker.csv A007)
  - drafting miss: missing What is due: owner "Aiden Brooks" (tracker.csv A007)
  - drafting miss: missing What is due: date "2026-11-06" (tracker.csv A007)
  - drafting miss: missing What is due: text "Return the signed distributor contracts" (tracker.csv A008)
  - drafting miss: missing What is due: owner "Priya Shah" (tracker.csv A008)
  - drafting miss: missing What is due: date "2026-11-10" (tracker.csv A008)
  - drafting miss: missing What changed in the numbers: metric "Orders" (answers.csv D202610300900-Q01)
  - drafting miss: missing What changed in the numbers: period "September 2026" (answers.csv D202610300900-Q01)
  - drafting miss: missing What changed in the numbers: change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13)
  - drafting miss: missing What changed in the numbers: metric "Revenue" (answers.csv D202610300900-Q02)
  - drafting miss: missing What changed in the numbers: period "Q3 2026" (answers.csv D202610300900-Q02)
  - drafting miss: missing What changed in the numbers: change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14)
  - drafting miss: missing What changed in the numbers: metric "Average order value" (answers.csv D202610300900-Q04)
  - drafting miss: missing What changed in the numbers: period "September 2026" (answers.csv D202610300900-Q04)
  - drafting miss: missing What changed in the numbers: change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16)
  - drafting miss: missing What changed in the numbers: metric "Orders" (answers.csv D202610300900-Q05)
  - drafting miss: missing What changed in the numbers: period "Q3 2026" (answers.csv D202610300900-Q05)
  - drafting miss: missing What changed in the numbers: number "3,150" (answers.csv D202610300900-Q05)
  - drafting miss: missing What changed in the numbers: metric "Returns" (answers.csv D202610300900-Q06)
  - drafting miss: missing What changed in the numbers: period "Q3 2026" (answers.csv D202610300900-Q06)
  - drafting miss: missing What changed in the numbers: number "257" (answers.csv D202610300900-Q06)
  - drafting miss: missing What needs a decision: text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 8)
  - drafting miss: missing What needs a decision: text "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six." (supplier_note.md line 6)
  - drafting miss: missing Open questions: text "Send the revised price list to the distributors" (tracker.csv A004)
  - drafting miss: missing Open questions: owner "not stated" (tracker.csv A004)
  - drafting miss: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 10)
  - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
  - drafting miss: missing Open questions: text "the Q3 returns rate" (project_note.md line 5)
  - drafting miss: missing Open questions: number "3,150" (answers.csv D202610300900-Q05)
  - drafting miss: missing Open questions: number "257" (answers.csv D202610300900-Q06)
- **06_confidential** (15 of 46 facts)
  - drafting miss: missing What is due: text "Send the draft category taxonomy" (tracker.csv A002)
  - drafting miss: missing What is due: owner "Aiden Brooks" (tracker.csv A002)
  - drafting miss: missing What is due: date "2026-11-03" (tracker.csv A002)
  - drafting miss: missing What is due: text "Set up the introductions to the three logistics partners" (tracker.csv A005)
  - drafting miss: missing What is due: owner "Daniel Okafor" (tracker.csv A005)
  - drafting miss: missing What is due: date "2026-11-04" (tracker.csv A005)
  - drafting miss: missing What is due: text "Send the revised price list to the distributors" (tracker.csv A004)
  - drafting miss: missing What is due: owner "not stated" (tracker.csv A004)
  - drafting miss: missing What is due: date "2026-11-05" (tracker.csv A004)
  - drafting miss: missing What is due: text "Draft the board summary of the claims review" (tracker.csv A007)
  - drafting miss: missing What is due: owner "Aiden Brooks" (tracker.csv A007)
  - drafting miss: missing What is due: date "2026-11-06" (tracker.csv A007)
  - drafting miss: missing What is due: text "Return the signed distributor contracts" (tracker.csv A008)
  - drafting miss: missing What is due: owner "Priya Shah" (tracker.csv A008)
  - drafting miss: missing What is due: date "2026-11-10" (tracker.csv A008)
  - drafting miss: missing What changed in the numbers: metric "Orders" (answers.csv D202610300900-Q01)
  - drafting miss: missing What changed in the numbers: period "September 2026" (answers.csv D202610300900-Q01)
  - drafting miss: missing What changed in the numbers: change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13)
  - drafting miss: missing What changed in the numbers: metric "Revenue" (answers.csv D202610300900-Q02)
  - drafting miss: missing What changed in the numbers: period "Q3 2026" (answers.csv D202610300900-Q02)
  - drafting miss: missing What changed in the numbers: change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14)
  - drafting miss: missing What changed in the numbers: metric "Returns rate" (answers.csv D202610300900-Q03)
  - drafting miss: missing What changed in the numbers: period "Q3 2026" (answers.csv D202610300900-Q03)
  - drafting miss: missing What changed in the numbers: change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15)
  - drafting miss: missing What changed in the numbers: metric "Average order value" (answers.csv D202610300900-Q04)
  - drafting miss: missing What changed in the numbers: period "September 2026" (answers.csv D202610300900-Q04)
  - drafting miss: missing What changed in the numbers: change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16)
  - drafting miss: missing What needs a decision: text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 7)
  - drafting miss: missing Open questions: text "Send the revised price list to the distributors" (tracker.csv A004)
  - drafting miss: missing Open questions: owner "not stated" (tracker.csv A004)
  - drafting miss: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9)

**G20261116202332-F** (F): no miss; every brief matched.

**G20261116213400-PG** (PG)
- **state_b** (47 of 48 facts)
  - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
  - *state*: a sentence in the first run and not the second: open_questions | supplier_note.md line 8
  - *state*: the removed list differs between the two runs

**G20261116214312-E** (E)
- **05_inference** (51 of 54 facts)
  - agent loop: missing Open questions: text "the Q3 returns rate" (project_note.md line 5)
  - agent loop: missing Open questions: number "3,150" (answers.csv D202610300900-Q05)
  - agent loop: missing Open questions: number "257" (answers.csv D202610300900-Q06)
- **06_confidential** (40 of 46 facts)
  - agent loop: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
  - agent loop: missing What moved: number "12" (decision_log.csv line 7)
  - agent loop: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
  - agent loop: missing What moved: number "14" (decision_log.csv line 10)
  - agent loop: missing What moved: number "13" (decision_log.csv line 10)
  - agent loop: missing What moved: number "1" (decision_log.csv line 10)

**G20261116204334-K** (K, illustration): 349 retrieval misses and 0 drafting misses. The drafting misses and every line that is not a missing fact:
- 02_disagreement: *state*: gate disagreement not held
- 05_inference: *state*: gate arithmetic not held

<details><summary>K: all 349 retrieval misses, by brief and reference</summary>

- **01_clean**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
- **02_disagreement**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
  - `tracker.csv A005` never shown: 1 fact (date "2026-11-04" (tracker.csv A005))
  - `project_note.md line 5` never shown: 1 fact (date "6 November" (project_note.md line 5))
- **03_change**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 8.15% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 8.15% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
- **04_gap**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 8` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 8))
  - `supplier_note.md line 7` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 7))
- **05_inference**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `answers.csv D202610300900-Q05` never shown: 4 facts (metric "Orders" (answers.csv D202610300900-Q05); period "Q3 2026" (answers.csv D202610300900-Q05); number "3,150" (answers.csv D202610300900-Q05); number "3,150" (answers.csv D202610300900-Q05))
  - `answers.csv D202610300900-Q06` never shown: 4 facts (metric "Returns" (answers.csv D202610300900-Q06); period "Q3 2026" (answers.csv D202610300900-Q06); number "257" (answers.csv D202610300900-Q06); number "257" (answers.csv D202610300900-Q06))
  - `project_note.md line 10` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 10))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
  - `project_note.md line 5` never shown: 1 fact (text "the Q3 returns rate" (project_note.md line 5))
- **06_confidential**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
- **state_b**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
- **state_a**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `decision_log.csv line 7` never shown: 2 facts (text "09_week44_a.xlsx" (decision_log.csv line 7); number "12" (decision_log.csv line 7))
  - `decision_log.csv line 10` never shown: 4 facts (text "10_week44_b.xlsx" (decision_log.csv line 10); number "14" (decision_log.csv line 10); number "13" (decision_log.csv line 10); number "1" (decision_log.csv line 10))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
  - `risk_note.md line 7` never shown: 1 fact (text "Open question: has Meridian Foods confirmed which distributor raised the term first?" (risk_note.md line 7))

</details>

**G20261116204906-V** (V, illustration): 339 retrieval misses and 6 drafting misses. The drafting misses and every line that is not a missing fact:
- 02_disagreement: *state*: gate disagreement not held
- 05_inference: *state*: gate arithmetic not held
- state_a: drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
- state_a: drafting miss: missing What moved: number "12" (decision_log.csv line 7)
- state_a: drafting miss: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
- state_a: drafting miss: missing What moved: number "14" (decision_log.csv line 10)
- state_a: drafting miss: missing What moved: number "13" (decision_log.csv line 10)
- state_a: drafting miss: missing What moved: number "1" (decision_log.csv line 10)
- state_a: *state*: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 7
- state_a: *state*: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 10
- state_a: *state*: a new sentence that does not cite risk_note.md: what_moved | none

<details><summary>V: all 339 retrieval misses, by brief and reference</summary>

- **01_clean**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 7` never shown: 1 fact (text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 7))
  - `supplier_note.md line 6` never shown: 1 fact (text "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six." (supplier_note.md line 6))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
- **02_disagreement**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 7` never shown: 1 fact (text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 7))
  - `supplier_note.md line 6` never shown: 1 fact (text "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six." (supplier_note.md line 6))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
  - `tracker.csv A005` never shown: 1 fact (date "2026-11-04" (tracker.csv A005))
  - `project_note.md line 5` never shown: 1 fact (date "6 November" (project_note.md line 5))
- **03_change**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 8.15% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 8.15% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 7` never shown: 1 fact (text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 7))
  - `supplier_note.md line 6` never shown: 1 fact (text "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six." (supplier_note.md line 6))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
- **04_gap**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 8` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 8))
  - `supplier_note.md line 7` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 7))
- **05_inference**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `answers.csv D202610300900-Q05` never shown: 4 facts (metric "Orders" (answers.csv D202610300900-Q05); period "Q3 2026" (answers.csv D202610300900-Q05); number "3,150" (answers.csv D202610300900-Q05); number "3,150" (answers.csv D202610300900-Q05))
  - `answers.csv D202610300900-Q06` never shown: 4 facts (metric "Returns" (answers.csv D202610300900-Q06); period "Q3 2026" (answers.csv D202610300900-Q06); number "257" (answers.csv D202610300900-Q06); number "257" (answers.csv D202610300900-Q06))
  - `project_note.md line 8` never shown: 1 fact (text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 8))
  - `supplier_note.md line 6` never shown: 1 fact (text "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six." (supplier_note.md line 6))
  - `project_note.md line 10` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 10))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
  - `project_note.md line 5` never shown: 1 fact (text "the Q3 returns rate" (project_note.md line 5))
- **06_confidential**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 7` never shown: 1 fact (text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 7))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
- **state_b**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 7` never shown: 1 fact (text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 7))
  - `supplier_note.md line 6` never shown: 1 fact (text "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six." (supplier_note.md line 6))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
- **state_a**
  - `tracker.csv A001` never shown: 3 facts (text "Send the spend export for the last twelve months" (tracker.csv A001); owner "Sofia Lindqvist" (tracker.csv A001); status "closed this week" (tracker.csv A001))
  - `tracker.csv A003` never shown: 3 facts (text "Confirm the distributor discount bands" (tracker.csv A003); owner "Priya Shah" (tracker.csv A003); status "closed this week" (tracker.csv A003))
  - `tracker.csv A006` never shown: 3 facts (text "Share the claims backlog figures with the board pack" (tracker.csv A006); owner "Tom Reilly" (tracker.csv A006); status "closed this week" (tracker.csv A006))
  - `tracker.csv A002` never shown: 3 facts (text "Send the draft category taxonomy" (tracker.csv A002); owner "Aiden Brooks" (tracker.csv A002); date "2026-11-03" (tracker.csv A002))
  - `tracker.csv A005` never shown: 3 facts (text "Set up the introductions to the three logistics partners" (tracker.csv A005); owner "Daniel Okafor" (tracker.csv A005); date "2026-11-04" (tracker.csv A005))
  - `tracker.csv A004` never shown: 5 facts (text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004); date "2026-11-05" (tracker.csv A004); text "Send the revised price list to the distributors" (tracker.csv A004); owner "not stated" (tracker.csv A004))
  - `tracker.csv A007` never shown: 3 facts (text "Draft the board summary of the claims review" (tracker.csv A007); owner "Aiden Brooks" (tracker.csv A007); date "2026-11-06" (tracker.csv A007))
  - `tracker.csv A008` never shown: 3 facts (text "Return the signed distributor contracts" (tracker.csv A008); owner "Priya Shah" (tracker.csv A008); date "2026-11-10" (tracker.csv A008))
  - `answers.csv D202610300900-Q01` never shown: 3 facts (metric "Orders" (answers.csv D202610300900-Q01); period "September 2026" (answers.csv D202610300900-Q01); change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `brief_previous.md line 13` never shown: 1 fact (change 4,210 (answers.csv D202610300900-Q01) from 4,210 (brief_previous.md line 13))
  - `answers.csv D202610300900-Q02` never shown: 3 facts (metric "Revenue" (answers.csv D202610300900-Q02); period "Q3 2026" (answers.csv D202610300900-Q02); change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `brief_previous.md line 14` never shown: 1 fact (change 1,604,322.50 (answers.csv D202610300900-Q02) from 1,604,322.50 (brief_previous.md line 14))
  - `answers.csv D202610300900-Q03` never shown: 3 facts (metric "Returns rate" (answers.csv D202610300900-Q03); period "Q3 2026" (answers.csv D202610300900-Q03); change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `brief_previous.md line 15` never shown: 1 fact (change 7.92% (answers.csv D202610300900-Q03) from 7.92% (brief_previous.md line 15))
  - `answers.csv D202610300900-Q04` never shown: 3 facts (metric "Average order value" (answers.csv D202610300900-Q04); period "September 2026" (answers.csv D202610300900-Q04); change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `brief_previous.md line 16` never shown: 1 fact (change 128.56 (answers.csv D202610300900-Q04) from 128.56 (brief_previous.md line 16))
  - `project_note.md line 7` never shown: 1 fact (text "Decision needed: whether to extend the pilot to the Riverside branch before the taxonomy is signed off." (project_note.md line 7))
  - `supplier_note.md line 6` never shown: 1 fact (text "Decision needed: whether to renew the Brightwater Packaging contract for twelve months or six." (supplier_note.md line 6))
  - `risk_note.md line 5` never shown: 1 fact (text "Decision needed: whether to offer sixty day terms to the two distributors or hold at thirty." (risk_note.md line 5))
  - `project_note.md line 9` never shown: 1 fact (text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9))
  - `supplier_note.md line 8` never shown: 1 fact (text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8))
  - `risk_note.md line 7` never shown: 1 fact (text "Open question: has Meridian Foods confirmed which distributor raised the term first?" (risk_note.md line 7))

</details>

**Uncounted runs.** Kept as recorded; they decide nothing.

- **G202611161522-P** (P): every brief: "no page was released" (refused on its first draft call: 400, the compiled grammar is too large).
- **G202611161523-F** (F): every brief: "no page was released" (refused on its first draft call: 400, the compiled grammar is too large).
- **G202611161523-P** (P): every brief: "no page was released" (refused on its first draft call: 400, the compiled grammar is too large).
- **G202611161524-F** (F): every brief: "no page was released" (refused on its first draft call: 400, the compiled grammar is too large).
- **G202611161524-K** (K): every brief: "no page was released" (refused on its first draft call: 400, the compiled grammar is too large).
- **G202611161524-P** (P): every brief: "no page was released" (refused on its first draft call: 400, the compiled grammar is too large).
- **G202611161524-V** (V): every brief: "no page was released" (refused on its first draft call: 400, the compiled grammar is too large).
- **G20261116154635-P** (P):
  - **01_clean** (47 of 48 facts)
    - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
  - **04_gap** (40 of 46 facts)
    - drafting miss: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
    - drafting miss: missing What moved: number "12" (decision_log.csv line 7)
    - drafting miss: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
    - drafting miss: missing What moved: number "14" (decision_log.csv line 10)
    - drafting miss: missing What moved: number "13" (decision_log.csv line 10)
    - drafting miss: missing What moved: number "1" (decision_log.csv line 10)
  - **05_inference** (51 of 54 facts)
    - drafting miss: missing Open questions: text "the Q3 returns rate" (project_note.md line 5)
    - drafting miss: missing Open questions: number "3,150" (answers.csv D202610300900-Q05)
    - drafting miss: missing Open questions: number "257" (answers.csv D202610300900-Q06)
  - **state_b** (47 of 48 facts)
    - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
  - **state_a** (45 of 50 facts)
    - drafting miss: missing Open questions: text "Send the revised price list to the distributors" (tracker.csv A004)
    - drafting miss: missing Open questions: owner "not stated" (tracker.csv A004)
    - drafting miss: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9)
    - drafting miss: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
    - drafting miss: missing Open questions: text "Open question: has Meridian Foods confirmed which distributor raised the term first?" (risk_note.md line 7)
    - *state*: a sentence from the clean run is missing after the new document: open_questions | tracker.csv A004
    - *state*: a sentence from the clean run is missing after the new document: open_questions | project_note.md line 9
    - *state*: a new sentence that does not cite risk_note.md: open_questions | none
- **G20261116161032-P** (P): no miss.
- **G20261116211827-E** (E):
  - **01_clean** (42 of 48 facts)
    - agent loop: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
    - agent loop: missing What moved: number "12" (decision_log.csv line 7)
    - agent loop: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
    - agent loop: missing What moved: number "14" (decision_log.csv line 10)
    - agent loop: missing What moved: number "13" (decision_log.csv line 10)
    - agent loop: missing What moved: number "1" (decision_log.csv line 10)
- **G20261116212543-E** (E): no miss.

## Every removal, with the checker's reason

Every sentence the checker removed in any run, 24 in counted runs and 7 in uncounted ones. A removal for an empty reference is marked; there are 0 in counted runs.

| Run | Counted | Arm | Brief | Section | Sentence | Checker's reason | Empty reference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G20261116154635-P | no | P | 01_clean | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "Q1" is not a number |  |
| G20261116154635-P | no | P | 04_gap | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116154635-P | no | P | 04_gap | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |
| G20261116154635-P | no | P | 05_inference | Open questions | The Q3 returns rate was asked for, but no source states it; Returns, Q3 2026: 257 and Orders, Q3 2026: 3150 are given. | reference "" is not of the form "<file> line N" or "<file> <id>" | yes |
| G20261116154635-P | no | P | state_b | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "Q1" is not a number |  |
| G20261116161815-P | yes | P | 02_disagreement | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116161815-P | yes | P | 02_disagreement | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |
| G20261116162922-F | yes | F | 03_change | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "Q1" is not a number |  |
| G20261116162922-F | yes | F | state_a | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | unsourced: number 12 (no claim covers it) |  |
| G20261116163844-P | yes | P | 02_disagreement | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "Q1" is not a number |  |
| G20261116163844-P | yes | P | 04_gap | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116163844-P | yes | P | 04_gap | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |
| G20261116164842-F | yes | F | 02_disagreement | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116164842-F | yes | F | 02_disagreement | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |
| G20261116164842-F | yes | F | state_b | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | unsourced: number 12 (no claim covers it) |  |
| G20261116164842-F | yes | F | state_a | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | unsourced: number 12 (no claim covers it) |  |
| G20261116170703-F | yes | F | 02_disagreement | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116170703-F | yes | F | 02_disagreement | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |
| G20261116170703-F | yes | F | 03_change | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "October" is not one date |  |
| G20261116170703-F | yes | F | state_b | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "Q1" is not a number |  |
| G20261116200514-F | yes | F | 01_clean | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "Q1" is not a number |  |
| G20261116200514-F | yes | F | 06_confidential | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | unsourced: number 12 (no claim covers it) |  |
| G20261116204334-K | yes | K | 02_disagreement | What moved | week42.xlsx: 11 rows read, 11 merged. | archive_2026-10-16_decisions.csv line 7 does not hold the number 42 |  |
| G20261116204906-V | yes | V | state_a | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116204906-V | yes | V | state_a | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |
| G20261116211827-E | no | E | 01_clean | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116211827-E | no | E | 01_clean | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |
| G20261116213400-PG | yes | PG | state_b | Open questions | "Open question: can Brightwater Packaging hold the October price into Q1?" | "Q1" is not a number |  |
| G20261116214312-E | yes | E | 05_inference | Open questions | The Q3 returns rate was asked for, but no source states it; Returns, Q3 2026: 257 and Orders, Q3 2026: 3,150 are given. | unsourced: number 2026 (no claim covers it) |  |
| G20261116214312-E | yes | E | 06_confidential | What moved | 09_week44_a.xlsx: 12 rows read, 12 merged. | decision_log.csv line 7 does not hold the number 44 |  |
| G20261116214312-E | yes | E | 06_confidential | What moved | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | decision_log.csv line 10 does not hold the number 44 |  |

13 of the 24 counted removals, in 5 arms (P, F, K, V, E), are one miss: the drafter claimed the number inside a file name (`09_week44_a.xlsx`, `week42.xlsx`) as a number, and the cited line does not hold it as a number. It is listed for a later decision; no instruction was changed for it.

## Limits

Section 8 of `WORK-10-DESIGN.md`, in full:

- At 200 documents the grown week still fits in both models' context windows. It tests a week too large for a cheap read, not one too large for any read.
- E runs the skill unchanged, which tells the model the folder holds up to seven files; a miss in E may come from that text, and the page cannot separate it from a reading miss.
- The graph drafts in one call and the agent loop in several; P against A1 measures the graph and the one call together and cannot split them.
- Recall is measured against the expected lists, which are the answer key; the fixed, hashed queries are the only guard against fitting them.
- The 1,100 tokens a file is measured on seven files of one week and is the basis of every estimate here; the generator reports the real size of each grown folder in characters, and the first E run its tokens. Session 2 measured about 560 tokens an archive file (section 5, decision 1).
- `brief_previous.md` (week ending 2026-10-23) says "first brief with this number" for orders and average order value in September 2026 and for revenue and returns rate in Q3 2026, while the three October archive briefs (weeks ending 2026-10-02, 2026-10-09, 2026-10-16) already carry earlier values for the same periods. The six files are committed and unchanged, so the contradiction stays; it is part of the near misses decision 1 asks for.
- `MCPAdapter` is beta, and nothing on the pages read shows how it passes environment variables to a stdio server.
- LangGraph shipped eight patch releases between 6 Oct and 14 Nov 2026; the pin is exact and a later version is a new run, never a silent upgrade.
- Voyage prices were not read; decision 3c's cost is unknown here.
- **The checker does not check the week of a line** (found in stage 1). It confirms that a claimed value is on the cited line; it does not check that the line belongs to the current week. In K's illustration run (`G20261116204334-K-haiku-5-5`, 02_disagreement) the drafter wrote "week42.xlsx: 11 rows read, 11 merged." citing `archive_2026-10-16_decisions.csv line 7`, a real line from two weeks before. The checker removed it only because the drafter also claimed the 42 inside the file name as a number: "archive_2026-10-16_decisions.csv line 7 does not hold the number 42". Run offline through `checkDraft` (`lib/check.js`) on the grown 02_disagreement folder, the same sentence without that one claim passes. No archived fact reached a page in these runs, and that rested on an unrelated removal, not on the checker.
- **E skipped the archive by file name** (found in stage 2). In the two probes and in all eight briefs of its counted run, E read only the week's own files and no archive file, because every archived file's name starts `archive_`. This shows an agent filtering by file name on a tidy folder; it says nothing about a folder whose names do not mark old files. E's result and its cost on this archive are those of an agent that never read the archive.

Also from the records: PG and E ran once each, and K and V once each as illustration; each is a single reading, not a rate. Every WORK-10 run used the smallest model; stage 3 (the largest model) did not run.

## What changed during the build, and why

**The archived trackers.** In the archive as first built in session 2, all 25 archived trackers carried the eight current actions word for word, months before `tracker.csv` adds them (in runs R2026-10-23-1 and R2026-10-30-1). They were rebuilt as an earlier review cycle's actions: each id A001 to A008 holds one older action at a time from a seeded pool, open for one to four weeks, then closed (`graph/make_grown.mjs`). Checked on this page: 200 rows in 25 archived trackers, 0 repeating a current action's text.

**No `cache_control` on the graph arms.** The graph makes one call a brief. With only a top-level cache breakpoint, each call would write its whole prompt to the cache, and the next brief, sharing only the instructions, would never read it back: every input token would pay the cache-write price for nothing. Megat changed the rule in session 2: P, F, K, V and PG send no `cache_control` (their records show no cache reads or writes in any counted run); E keeps the Node harness's caching, unchanged (727,267 cache-read and 321,519 cache-write tokens in its run).

**The schema and the 400.** The first 7 stage 1 runs (P, F, P, F, K, P, V) were each refused on their first draft call: "The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools." The API compiles the JSON schema output into a grammar, and the first schema (the sentence shape five times, each claim a choice of two shapes) was too large; neither the mock nor the token counting endpoint compiles it. No page was released and nothing was spent; the records are kept, uncounted. The fix: one flat list of sentences, each naming its section, and one claim shape with every field a string (1,302 characters of schema against 4,748, per the design note); the payload the server receives is the same. Five more commands were refused at once because run labels went only to the minute, so a second run of an arm in the same minute found its folder taken; labels now carry seconds. The grammar probe then confirmed the new schema was accepted.

**The output limit and streaming.** The first P run after the schema fix (`G20261116154635-P`), at `max_tokens` 16,000 with no streaming, had 2 briefs end on `max_tokens` (05_inference, state_a); the truncation guard held the stage (held 15:53, released 16:11). One call carries the model's thinking and the whole draft under one limit, where the agent loop spreads them over several calls. The fix: the draft call streams, with `max_tokens` 32,000; that run is kept, uncounted. Since then all 104 draft calls of the counted graph runs ended on `end_turn`; the largest wrote 22,728 output tokens (PG, `G20261116213400-PG`, 05_inference). One line was added to `graph/draft_step.md`, that every claim carries its reference, after that run had a removal for an empty reference.

**Arm F, added after stage 0.** Stage 0's recall showed K and V could not keep the bar at k = 20 (the version 1 verdict above), before any paid run. Megat added F to test whether the week, not a query, is what separates the lines: each file's week read from its content, never its name, and every line of this week and the week before kept. The verdict rule for F was fixed before F's first run. F's stage 0 recall was complete in 8 of 8 briefs.

**Stage 3, dropped.** Stage 3 would have run K and V on the largest model if stage 1 left the K-against-V verdict open. Stage 0 closed it: at 20 lines a section K and V leave expected references unshown in every brief, and no model can cite a line it is never shown.

## Forecast beside measured cost

The forecast is stage 0's: token counts of the exact requests from the free token counting endpoint (an estimate), priced from `graph/prices.json`, with the graph arms' output taken from the first P run's median (13,957 tokens a brief) and E's from WORK-09's A1 median (9,692 tokens).

| Run | Arm | Counted | Forecast | Measured | Difference |
| --- | --- | --- | --- | --- | --- |
| G20261116154635-P | P | no | US$0.0492 | US$0.0663 | +34.7% |
| G20261116161032-P | P | no | US$0.0083 | US$0.0093 | +12.3% |
| G20261116161815-P | P | yes | US$0.0663 | US$0.0648 | −2.3% |
| G20261116162922-F | F | yes | US$0.0688 | US$0.0689 | +0.2% |
| G20261116163844-P | P | yes | US$0.0663 | US$0.0671 | +1.2% |
| G20261116164842-F | F | yes | US$0.0688 | US$0.0692 | +0.6% |
| G20261116165638-P | P | yes | US$0.0663 | US$0.0652 | −1.7% |
| G20261116170703-F | F | yes | US$0.0688 | US$0.0664 | −3.5% |
| G20261116171638-P | P | yes | US$0.0663 | US$0.0679 | +2.5% |
| G20261116200514-F | F | yes | US$0.0688 | US$0.0680 | −1.2% |
| G20261116201521-P | P | yes | US$0.0663 | US$0.0615 | −7.2% |
| G20261116202332-F | F | yes | US$0.0688 | US$0.0703 | +2.2% |
| G20261116204334-K | K | yes | US$0.0695 | US$0.0309 | −55.6% |
| G20261116204906-V | V | yes | US$0.0690 | US$0.0287 | −58.4% |
| G20261116211827-E | E | no | US$0.1266 | US$0.0667 (upper bound) | −47.3% |
| G20261116212543-E | E | no | US$0.1266 | US$0.0612 (upper bound) | −51.7% |
| G20261116213400-PG | PG | yes | US$0.8427 | US$0.8993 | +6.7% |
| G20261116214312-E | E | yes | US$1.0126 | US$0.0934 | −90.8% |

Per brief, counted runs, by arm:

| Arm | Forecast a brief | Measured a brief | Difference |
| --- | --- | --- | --- |
| P | US$0.0083 | US$0.0057 to US$0.0103 | −30.6% to +23.5% |
| F | US$0.0086 | US$0.0070 to US$0.0108 | −18.6% to +25.7% |
| K | US$0.0087 | US$0.0027 to US$0.0048 | −69.3% to −44.7% |
| V | US$0.0086 | US$0.0032 to US$0.0044 | −63.4% to −49.5% |
| PG | US$0.1052 to US$0.1054 | US$0.1059 to US$0.1274 | +0.6% to +20.8% |
| E | US$0.1264 to US$0.1268 | US$0.0107 to US$0.0129 | −91.5% to −89.8% |

K and V came in under half their forecast because they wrote far less: they had little they could cite. E's forecast priced reading all 207 files; E read 6 to 8. PG ran over where a brief needed more output than the median the forecast took.

**The ledger** (`eval/results-graph/spend.json`), every paid call of WORK-10, counted or not:

| Stage | What | Model calls | Cost |
| --- | --- | --- | --- |
| 0 | token counts (80 + 8 + 40 requests, free) | 0 | US$0.0000 |
| 1 | the grammar probe, the 16,000-cap P run, the 05_inference test brief and the twelve counted runs | 106 | US$0.8059 |
| 2 | two uncounted E briefs (upper bounds), PG and E once each | 51 | US$1.1206 |
| 3 | dropped | 0 | US$0.0000 |
| **Total** | against the cap of US$8.00 | 157 | **US$1.926507** |

US$6.07 of the US$8.00 cap is unspent. No hold is set.
