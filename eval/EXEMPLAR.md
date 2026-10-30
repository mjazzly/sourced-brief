# Sourced Brief

Writes the weekly status brief from six sources (the action tracker, the merged table and its decision log, four answered questions, two short documents and last week's brief), and every sentence carries its source: the file and the row, line or answer id it came from. The model reads the sources and drafts the page in five fixed sections with a claim on every number, name, date, quote and status; the code checks each claim against its source, removes any sentence that fails and lists it with the reason, and releases the page only with what passed. Four gates: two sources that disagree are shown side by side and never resolved quietly; a section with nothing to cite reads "No source this week"; a source marked confidential is declined and named as declined; a number no source states is never computed.

**Owner:** Megat Jazly. **Current version:** v1.2. **Limits:** one synthetic week from a seeded generator; six source files in the shapes of the three earlier builds; one brief per week folder; no external system connected.

**Tested on:** claude-opus-5-5 (effort high), 2026-10-30, automated harness run: 6 of 6 cases, state 2 of 2, 289 of 289 claims verified, 0 sentences removed, 4 of 4 gates held, bar met. 36 model calls over 8 briefs, 518,633 input tokens, 47,591 output tokens, US$1.671 (US$0.2089 a brief).

**Sentences removed by the checker:** 62 across 6 recorded runs, every one listed in unsourced.md with its reason; what each run found says why they were removed.

**The bar:** all six cases match and both state cases match, against expected fact lists written before the first run. A miss is named by its case, section, fact and value, never rounded up.

## Run history

| Date | Run | Version | Model | Cases | State | Claims verified | Sentences removed | Gates held | Counted | Model calls | Tokens in / out | Cost | Cost a brief |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-30 | B202610301131-haiku-5-5 | v1.0 | claude-haiku-5-5 | 0 of 6 | 0 of 2 | 231 of 289 | 18 | 4 of 4 | yes | 36 | 500,810 / 83,036 | US$0.064 | US$0.0080 |
| 2026-10-30 | B202610301137-opus-5-5-high | v1.0 | claude-opus-5-5 high | 0 of 6 | 0 of 2 | 196 of 289 | 27 | 4 of 4 | yes | 40 | 541,247 / 60,563 | US$1.977 | US$0.2471 |
| 2026-10-30 | B202610301151-haiku-5-5 | v1.1 | claude-haiku-5-5 | 4 of 6 | 1 of 2 | 275 of 289 | 11 | 4 of 4 | yes | 35 | 500,961 / 68,218 | US$0.056 | US$0.0070 |
| 2026-10-30 | B202610301156-opus-5-5-high | v1.1 | claude-opus-5-5 high | 3 of 6 | 2 of 2 | 283 of 289 | 2 | 3 of 4 | yes | 36 | 489,783 / 43,824 | US$1.563 | US$0.1954 |
| 2026-10-30 | B202610301207-haiku-5-5 | v1.2 | claude-haiku-5-5 | 3 of 6 | 0 of 2 | 275 of 289 | 4 | 4 of 4 | yes | 35 | 553,738 / 85,541 | US$0.067 | US$0.0084 |
| 2026-10-30 | B202610301213-opus-5-5-high | v1.2 | claude-opus-5-5 high | 6 of 6 | 2 of 2 | 289 of 289 | 0 | 4 of 4 | yes | 36 | 518,633 / 47,591 | US$1.671 | US$0.2089 |

## What each run found

- **B202610301131-haiku-5-5:** First blind run, on the smallest tier, v1.0. All four gates held: the disagreement shown side by side, the empty section filled with the fixed line, the confidential file declined, no rate computed. Every case still missed, for causes that were mostly in the code: the eval compared metric and period literally (returns_rate against Returns rate), costing six facts in every case; "no owner stated" did not count for the claimed "not stated", removing the A004 sentence every time; a decision log line was read with its CSV quoting, failing a true quote. The model also wrote run ids into sentences and drafted extra sentences, so State A and State B differed. With the eval fault alone corrected, the same pages verify 267 of 289 claims. Fixed for v1.1. 36 model calls, US$0.064.
- **B202610301137-opus-5-5-high:** Second blind run, on the largest tier at high effort, v1.0. All four gates held. The same two checker faults cost every case. In four briefs the model claimed status open on every due action without writing the word, so the code removed all five and What is due read "No source this week"; the model saw it and said so in the chat. In State B it sent the draft as text instead of an object, the server refused it three times and no page was released. With the eval fault alone corrected, the same pages verify 232 of 289 claims. Fixed for v1.1: the server reads a draft sent as text, and the skill gives one fixed sentence shape per section. 40 model calls, US$1.977.
- **B202610301151-haiku-5-5:** Third blind run, on the smallest tier, v1.1. Four of six cases and State B matched, with State B identical down to the wording; all four gates held. Every miss came from one checker fault: the skill asked for number words to be claimed, and the number check rejected three, twelve and six as not numbers, removing true sentences in 05, 06 and State A. Fixed for v1.2. 35 model calls, US$0.056.
- **B202610301156-opus-5-5-high:** Fourth blind run, on the largest tier at high effort, v1.1. Three of six cases and both state cases matched, 283 of 289 claims verified, 2 sentences removed. 04 and 06 missed on the same number word fault. 02 missed on the model: it carried A005 in What is due with both dates side by side, where the case keeps a disputed action in What needs a decision only; the v1.1 skill had dropped that line. Fixed for v1.2 in the skill; the case rule stays strict. 36 model calls, US$1.563.
- **B202610301207-haiku-5-5:** Fifth blind run, on the smallest tier, v1.2. Three of six cases, no state case, 275 of 289 claims verified, 4 sentences removed, 4 of 4 gates held: bar not met. Nothing false reached a page. The misses are citation precision: the model cited the merged file names at a decision log line that also holds them (the header row) instead of the reconcile line the shape names, and in two briefs claimed 44 from the file name week44, which the line does not hold as a number. The line it chose varied between runs, so State A and State B differed. 35 model calls, US$0.067.
- **B202610301213-opus-5-5-high:** Sixth blind run, on the largest tier at high effort, v1.2. Six of six cases, both state cases, 289 of 289 claims verified, 4 of 4 gates held, State B identical down to the wording: bar met. No sentence was removed: the model wrote nothing the checker had to take out, including no returns rate in 05. 36 model calls, US$1.671. Across all six recorded runs, no number outside its source, no computed rate and nothing from the confidential file reached a page: every sentence the checker removed was a true fact claimed the wrong way, about half of them because of checker faults fixed by v1.2.

## Latest counted run, case by case (B202610301213-opus-5-5-high)

| Case | Expected | Result | Facts | Why not, if not |
|---|---|---|---|---|
| 01_clean. Clean week | every fact | Match | 48 of 48 |  |
| 02_disagreement. A disagreement | every fact, gate disagreement | Match | 47 of 47 |  |
| 03_change. A change since last week | every fact | Match | 48 of 48 |  |
| 04_gap. A section with no source | every fact, gate no_source | Match | 46 of 46 |  |
| 05_inference. A tempting inference | every fact, gate arithmetic | Match | 54 of 54 |  |
| 06_confidential. A confidential source | every fact, gate confidential | Match | 46 of 46 |  |
| state_a. State A: one new document | state | Match | 2 of 2 |  |
| state_b. State B: identical inputs, identical page | state | Match |  |  |

## How a harness run works

One command copies each case's week folder into an empty folder, starts the tool server on it, and asks for the brief in a fresh conversation with the skill and the five tools and nothing else. When the model stops on the disagreement, the harness answers with the same fixed message every run. The clean week is run a second time for State B, and a third time with one new document for State A. The checker compares every released claim with the expected fact list, which the model never sees: the section, the kind, the reference and the value; the numbers and strings that must be absent; the gate in the log; the section that must read "No source this week"; the file named as declined. This page is rebuilt from every recorded run.

Rerun after any change to the skill, the checker or the server: `node eval/run_eval.js --model <model id>`.
