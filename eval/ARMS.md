# WORK-09: a second agent, tested for its place

Does a second agent lift the smallest model to the bar on the same eight briefs and the same checker, and does it cost less a brief than the largest model alone? Every arm runs the same tool server, cases, expected fact lists, fixed gate answer and checker as the sourced brief v1.3. The design, the reviewer's instructions in full and the checklist are in WORK-09-DESIGN.md. This page is rebuilt from eval/results-arms after every run.

## The verdict

**The second agent is folded.** A2 met the bar in 1 of 5 runs and B in 1 of 5; a tie goes to the arm with fewer parts.
**The review step stays in the skill.** A2 met the bar in 1 of 5 runs and A1 in 0 of 5.

## Predictions beside the results

Megat's predictions were signed before the first run; the full lines are at the foot of this page.

| Arm | Predicted bar met | Bar met |
|---|---|---|
| A1 | 3 of 5 | 0 of 5 |
| A2 | 4 of 5 | 1 of 5 |
| B | 5 of 5 | 1 of 5 |
| Ceiling | 3 of 3 | 2 of 3 |

## The arms

| Arm | What runs | Runs | Bar met | Briefs matched of 8, run by run | Claims verified | Sentences removed | Review findings | Sentences changed after review | Broken by review | Fixed by review | Median cost a brief | Median seconds a brief |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | one agent, one pass, smallest model | 5 of 5 | 0 of 5 | 6, 7, 6, 4, 5 | 1,433 of 1,445 | 9 |  |  |  |  | US$0.0079 | 38.8 |
| A2 | one agent that reviews its own draft, smallest model | 5 of 5 | 1 of 5 | 6, 8, 6, 7, 7 | 1,428 of 1,445 | 8 | 30 | 27 | 3 | 1 | US$0.0113 | 56.2 |
| B | a drafter and a reviewer agent, smallest model for both | 5 of 5 | 1 of 5 | 8, 4, 5, 5, 5 | 1,427 of 1,445 | 13 | 38 | 25 | 4 | 2 | US$0.0166 | 80.1 |
| Ceiling | one agent, one pass, largest model at effort high | 3 of 3 | 2 of 3 | 7, 8, 8 | 867 of 867 | 1 |  |  |  |  | US$0.2124 | 49 |

Broken by review counts the sentences the checker removed after review whose sentence in the draft before review passed it. Fixed by review counts the sentences the checker would have removed before review that passed after it. Both come from the unchanged checker run again on the draft each A2 and B drafter recorded before review; `node eval/review_effect.js` reruns the check and names every sentence.

## Every run

| Date | Run | Arm | Model | Cases | State | Briefs matched | Claims verified | Sentences removed | Gates held | Bar | Model calls (drafter / reviewer) | Tokens in / out | Cost | Cost a brief | Seconds a brief | In the verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-12 | W202611121652-one-haiku-5-5 | A1 | claude-haiku-5-5 | 5 of 6 | 1 of 2 | 6 of 8 | 286 of 289 | 3 | 4 of 4 | missed | 35 / none | 590,939 / 86,001 | US$0.068 | US$0.0085 | 44.3 | yes |
| 2026-11-12 | W202611121713-review-haiku-5-5 | A2 | claude-haiku-5-5 | 4 of 6 | 2 of 2 | 6 of 8 | 285 of 289 | 2 | 4 of 4 | missed | 44 / none | 967,811 / 119,081 | US$0.093 | US$0.0116 | 56.8 | yes |
| 2026-11-12 | W202611121725-reviewer-haiku-5-5 | B | claude-haiku-5-5 | 6 of 6 | 2 of 2 | 8 of 8 | 289 of 289 | 0 | 4 of 4 | met | 41 / 18 | 1,114,107 / 155,172 | US$0.128 | US$0.0160 | 76.9 | yes |
| 2026-11-12 | W202611121738-one-opus-5-5-high | Ceiling | claude-opus-5-5 high | 6 of 6 | 1 of 2 | 7 of 8 | 289 of 289 | 1 | 4 of 4 | missed | 36 / none | 563,757 / 49,587 | US$1.726 | US$0.2157 | 50.8 | yes |
| 2026-11-12 | W202611121747-one-haiku-5-5 | A1 | claude-haiku-5-5 | 5 of 6 | 2 of 2 | 7 of 8 | 286 of 289 | 1 | 4 of 4 | missed | 35 / none | 579,310 / 75,912 | US$0.062 | US$0.0077 | 37.7 | yes |
| 2026-11-12 | W202611121753-review-haiku-5-5 | A2 | claude-haiku-5-5 | 6 of 6 | 2 of 2 | 8 of 8 | 289 of 289 | 0 | 4 of 4 | met | 42 / none | 902,897 / 112,934 | US$0.088 | US$0.0110 | 52.9 | yes |
| 2026-11-12 | W202611121805-reviewer-haiku-5-5 | B | claude-haiku-5-5 | 4 of 6 | 0 of 2 | 4 of 8 | 282 of 289 | 3 | 4 of 4 | missed | 43 / 19 | 1,198,436 / 170,256 | US$0.137 | US$0.0172 | 82.7 | yes |
| 2026-11-12 | W202611121818-one-opus-5-5-high | Ceiling | claude-opus-5-5 high | 6 of 6 | 2 of 2 | 8 of 8 | 289 of 289 | 0 | 4 of 4 | met | 36 / none | 562,796 / 48,207 | US$1.699 | US$0.2124 | 49 | yes |
| 2026-11-12 | W202611121826-one-haiku-5-5 | A1 | claude-haiku-5-5 | 5 of 6 | 1 of 2 | 6 of 8 | 286 of 289 | 3 | 4 of 4 | missed | 36 / none | 602,113 / 77,535 | US$0.063 | US$0.0079 | 38.8 | yes |
| 2026-11-12 | W202611121833-review-haiku-5-5 | A2 | claude-haiku-5-5 | 4 of 6 | 2 of 2 | 6 of 8 | 279 of 289 | 4 | 4 of 4 | missed | 42 / none | 903,888 / 116,336 | US$0.090 | US$0.0113 | 56.2 | yes |
| 2026-11-12 | W202611121841-reviewer-haiku-5-5 | B | claude-haiku-5-5 | 3 of 6 | 2 of 2 | 5 of 8 | 284 of 289 | 3 | 4 of 4 | missed | 43 / 17 | 1,156,726 / 163,935 | US$0.133 | US$0.0166 | 82.5 | yes |
| 2026-11-12 | W202611121853-one-opus-5-5-high | Ceiling | claude-opus-5-5 high | 6 of 6 | 2 of 2 | 8 of 8 | 289 of 289 | 0 | 4 of 4 | met | 36 / none | 562,270 / 47,369 | US$1.682 | US$0.2103 | 48.9 | yes |
| 2026-11-12 | W202611121900-one-haiku-5-5 | A1 | claude-haiku-5-5 | 4 of 6 | 0 of 2 | 4 of 8 | 287 of 289 | 1 | 4 of 4 | missed | 34 / none | 564,088 / 78,846 | US$0.063 | US$0.0079 | 39.2 | yes |
| 2026-11-12 | W202611121907-review-haiku-5-5 | A2 | claude-haiku-5-5 | 6 of 6 | 1 of 2 | 7 of 8 | 289 of 289 | 1 | 4 of 4 | missed | 43 / none | 937,933 / 118,714 | US$0.092 | US$0.0115 | 56.9 | yes |
| 2026-11-12 | W202611121918-reviewer-haiku-5-5 | B | claude-haiku-5-5 | 4 of 6 | 1 of 2 | 5 of 8 | 287 of 289 | 4 | 4 of 4 | missed | 41 / 18 | 1,110,027 / 157,587 | US$0.129 | US$0.0161 | 77 | yes |
| 2026-11-12 | W202611121952-one-haiku-5-5 | A1 | claude-haiku-5-5 | 5 of 6 | 0 of 2 | 5 of 8 | 288 of 289 | 1 | 4 of 4 | missed | 35 / none | 579,977 / 77,538 | US$0.063 | US$0.0079 | 38.8 | yes |
| 2026-11-12 | W202611122008-review-haiku-5-5 | A2 | claude-haiku-5-5 | 5 of 6 | 2 of 2 | 7 of 8 | 286 of 289 | 1 | 4 of 4 | missed | 41 / none | 874,552 / 114,433 | US$0.089 | US$0.0111 | 53.1 | yes |
| 2026-11-12 | W202611122016-reviewer-haiku-5-5 | B | claude-haiku-5-5 | 4 of 6 | 1 of 2 | 5 of 8 | 285 of 289 | 3 | 4 of 4 | missed | 43 / 19 | 1,186,105 / 163,921 | US$0.134 | US$0.0167 | 80.1 | yes |

## Every miss and every removal

**W202611121652-one-haiku-5-5** (A1, bar missed)

- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5)
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05)
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06)
- state_b: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
- state_b: missing What moved: number "12" (decision_log.csv line 7)
- state_b: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
- state_b: missing What moved: number "14" (decision_log.csv line 10)
- state_b: missing What moved: number "13" (decision_log.csv line 10)
- state_b: missing What moved: number "1" (decision_log.csv line 10)
- state_b: a sentence in the first run and not the second: what_moved | decision_log.csv line 7
- state_b: a sentence in the first run and not the second: what_moved | decision_log.csv line 10
- state_b: the removed list differs between the two runs
- 05_inference: removed by the checker from Open questions: "The Q3 returns rate was asked for, but no source states it; Orders, Q3 2026: 3,150 and Returns, Q3 2026: 257 are given." Reason: unsourced: number 2026 (no claim covers it)
- state_b: removed by the checker from What moved: "09_week44_a.xlsx: 12 rows read, 12 merged." Reason: decision_log.csv line 7 does not hold the number 44
- state_b: removed by the checker from What moved: "10_week44_b.xlsx: 14 rows read, 13 merged, 1 held." Reason: decision_log.csv line 10 does not hold the number 44

**W202611121713-review-haiku-5-5** (A2, bar missed)

- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5). Review: no finding named it.
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05). Review: no finding named it.
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06). Review: no finding named it.
- 06_confidential: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9). Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, with no finding on it.
- 05_inference: removed by the checker from Open questions: "The Q3 returns rate was asked for, but no source states it; Returns, Q3 2026 257 and Orders, Q3 2026 3150 are given." Reason: unsourced: number 2026 (no claim covers it)
- 06_confidential: removed by the checker from Open questions: "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" Reason: "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" does not appear in tracker.csv A004. Introduced after review: the sentence passed the checker before review.

**W202611121738-one-opus-5-5-high** (Ceiling, bar missed)

- state_b: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
- state_b: missing What moved: number "12" (decision_log.csv line 7)
- state_b: a sentence in the first run and not the second: what_moved | decision_log.csv line 7
- state_b: the removed list differs between the two runs
- state_b: removed by the checker from What moved: "09_week44_a.xlsx: 12 rows read, 12 merged." Reason: unsourced: number 12 (no claim covers it)

**W202611121747-one-haiku-5-5** (A1, bar missed)

- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5)
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05)
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06)
- 05_inference: removed by the checker from Open questions: "Q3 returns rate was asked for, but no source states it; returns 257 and orders 3,150 are given, both for Q3 2026." Reason: unsourced: number 2026 (no claim covers it)

**W202611121805-reviewer-haiku-5-5** (B, bar missed)

- 01_clean: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9). Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, with no finding on it.
- 04_gap: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7). Review: no finding named it.
- 04_gap: missing What moved: number "12" (decision_log.csv line 7). Review: no finding named it.
- 04_gap: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10). Review: no finding named it.
- 04_gap: missing What moved: number "14" (decision_log.csv line 10). Review: no finding named it.
- 04_gap: missing What moved: number "13" (decision_log.csv line 10). Review: no finding named it.
- 04_gap: missing What moved: number "1" (decision_log.csv line 10). Review: no finding named it.
- state_a: a new sentence that does not cite risk_note.md: open_questions | project_note.md line 9. Review: no finding named it.
- state_b: a sentence in the second run and not the first: open_questions | project_note.md line 9. Review: no finding named it.
- state_b: the removed list differs between the two runs. Review: no finding named it.
- 01_clean: removed by the checker from Open questions: ""Open question: does the spend export include the Harbour depot, or only the Central warehouse?"" Reason: "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" does not appear in project_note.md line 7. Introduced after review: the sentence passed the checker before review.
- 04_gap: removed by the checker from What moved: "09_week44_a.xlsx: 12 rows read, 12 merged." Reason: decision_log.csv line 7 does not hold the number 44
- 04_gap: removed by the checker from What moved: "10_week44_b.xlsx: 14 rows read, 13 merged, 1 held." Reason: decision_log.csv line 10 does not hold the number 44

**W202611121826-one-haiku-5-5** (A1, bar missed)

- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5)
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05)
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06)
- state_a: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7)
- state_a: missing What moved: number "12" (decision_log.csv line 7)
- state_a: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
- state_a: missing What moved: number "14" (decision_log.csv line 10)
- state_a: missing What moved: number "13" (decision_log.csv line 10)
- state_a: missing What moved: number "1" (decision_log.csv line 10)
- state_a: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 7
- state_a: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 10
- 05_inference: removed by the checker from Open questions: "The Q3 returns rate was asked for, but no source states it; Returns, Q3 2026: 257 and Orders, Q3 2026: 3,150 are given." Reason: unsourced: number 2026 (no claim covers it)
- state_a: removed by the checker from What moved: "09_week44_a.xlsx: 12 rows read, 12 merged." Reason: decision_log.csv line 5 does not hold the number 44
- state_a: removed by the checker from What moved: "10_week44_b.xlsx: 14 rows read, 13 merged, 1 held." Reason: decision_log.csv line 8 does not hold the number 44

**W202611121833-review-haiku-5-5** (A2, bar missed)

- 05_inference: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7). Review: no review (SKIPPED).
- 05_inference: missing What moved: number "12" (decision_log.csv line 7). Review: no review (SKIPPED).
- 05_inference: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10). Review: no review (SKIPPED).
- 05_inference: missing What moved: number "14" (decision_log.csv line 10). Review: no review (SKIPPED).
- 05_inference: missing What moved: number "13" (decision_log.csv line 10). Review: no review (SKIPPED).
- 05_inference: missing What moved: number "1" (decision_log.csv line 10). Review: no review (SKIPPED).
- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5). Review: no review (SKIPPED).
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05). Review: no review (SKIPPED).
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06). Review: no review (SKIPPED).
- 06_confidential: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9). Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, with no finding on it.
- 05_inference: removed by the checker from What moved: "09_week44_a.xlsx: 12 rows read, 12 merged." Reason: decision_log.csv line 7 does not hold the number 44
- 05_inference: removed by the checker from What moved: "10_week44_b.xlsx: 14 rows read, 13 merged, 1 held." Reason: decision_log.csv line 10 does not hold the number 44
- 05_inference: removed by the checker from Open questions: "The Q3 returns rate was asked for, but no source this week states it; Returns, Q3 2026: 257 and Orders, Q3 2026: 3150 are given." Reason: unsourced: number 2026 (no claim covers it)
- 06_confidential: removed by the checker from Open questions: ""Open question: does the spend export include the Harbour depot, or only the Central warehouse?"" Reason: "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" does not appear in tracker.csv A004. Introduced after review: the sentence passed the checker before review.

**W202611121841-reviewer-haiku-5-5** (B, bar missed)

- 03_change: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9). Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, with no finding on it.
- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5). Review: no finding named it.
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05). Review: no finding named it.
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06). Review: F5 named it; the drafter's sentence was changed.
- 06_confidential: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9). Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, with no finding on it.
- 03_change: removed by the checker from Open questions: ""Open question: does the spend export include the Harbour depot, or only the Central warehouse?"" Reason: the sentence does not carry the claimed value "Send the revised price list to the distributors"; the sentence does not carry the claimed value "not stated". Introduced after review: the sentence passed the checker before review.
- 05_inference: removed by the checker from Open questions: "Q3 returns rate was asked for, but no source states it; Returns, Q3 2026: 257 and Orders, Q3 2026: 3150 are given." Reason: unsourced: number 2026 (no claim covers it)
- 06_confidential: removed by the checker from Open questions: ""Open question: does the spend export include the Harbour depot, or only the Central warehouse?"" Reason: the sentence does not carry the claimed value "Send the revised price list to the distributors"; the sentence does not carry the claimed value "not stated". Introduced after review: the sentence passed the checker before review.

**W202611121900-one-haiku-5-5** (A1, bar missed)

- 01_clean: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
- 06_confidential: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10)
- state_a: a new sentence that does not cite risk_note.md: open_questions | supplier_note.md line 8
- state_b: a sentence in the second run and not the first: open_questions | supplier_note.md line 8
- state_b: the removed list differs between the two runs
- 01_clean: removed by the checker from Open questions: ""Open question: can Brightwater Packaging hold the October price into Q1?"" Reason: "October" is not one date

**W202611121907-review-haiku-5-5** (A2, bar missed)

- state_a: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8). Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, acting on F5.
- state_a: a sentence from the clean run is missing after the new document: open_questions | supplier_note.md line 8. Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, acting on F5.
- state_a: removed by the checker from Open questions: ""Open question: can Brightwater Packaging hold the October price into Q1?"" Reason: "Q1" is not a number. Introduced after review: the sentence passed the checker before review.

**W202611121918-reviewer-haiku-5-5** (B, bar missed)

- 02_disagreement: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8). Review: no finding named it.
- 04_gap: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 7). Review: no finding named it.
- state_a: missing What moved: text "09_week44_a.xlsx" (decision_log.csv line 7). Review: no finding named it.
- state_a: missing What moved: number "12" (decision_log.csv line 7). Review: no finding named it.
- state_a: missing What moved: text "10_week44_b.xlsx" (decision_log.csv line 10). Review: no finding named it.
- state_a: missing What moved: number "14" (decision_log.csv line 10). Review: no finding named it.
- state_a: missing What moved: number "13" (decision_log.csv line 10). Review: no finding named it.
- state_a: missing What moved: number "1" (decision_log.csv line 10). Review: no finding named it.
- state_a: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 7. Review: no finding named it.
- state_a: a sentence from the clean run is missing after the new document: what_moved | decision_log.csv line 10. Review: no finding named it.
- 02_disagreement: removed by the checker from Open questions: ""Open question: can Brightwater Packaging hold the October price into Q1?"" Reason: "Q1" is not a number
- 04_gap: removed by the checker from Open questions: ""Open question: can Brightwater Packaging hold the October price into Q1?"" Reason: "Q1" is not a number
- state_a: removed by the checker from What moved: "09_week44_a.xlsx: 12 rows read, 12 merged." Reason: decision_log.csv line 7 does not hold the number 44
- state_a: removed by the checker from What moved: "10_week44_b.xlsx: 14 rows read, 13 merged, 1 held." Reason: decision_log.csv line 10 does not hold the number 44

**W202611121952-one-haiku-5-5** (A1, bar missed)

- 01_clean: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8)
- state_a: a new sentence that does not cite risk_note.md: open_questions | supplier_note.md line 8
- state_b: a sentence in the second run and not the first: open_questions | supplier_note.md line 8
- state_b: the removed list differs between the two runs
- 01_clean: removed by the checker from Open questions: ""Open question: can Brightwater Packaging hold the October price into Q1?"" Reason: "Q1" is not a number

**W202611122008-review-haiku-5-5** (A2, bar missed)

- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5). Review: no finding named it.
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05). Review: no finding named it.
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06). Review: no finding named it.
- 05_inference: removed by the checker from Open questions: "The Q3 returns rate was asked for, but no source states it; Returns 257 and Orders 3150 are given, both for Q3 2026." Reason: unsourced: number 2026 (no claim covers it)

**W202611122016-reviewer-haiku-5-5** (B, bar missed)

- 05_inference: missing Open questions: text "the Q3 returns rate" (project_note.md line 5). Review: F1 named it; the drafter's sentence was changed.
- 05_inference: missing Open questions: number "3,150" (answers.csv D202610300900-Q05). Review: F1 named it; the drafter's sentence was changed.
- 05_inference: missing Open questions: number "257" (answers.csv D202610300900-Q06). Review: F1 named it; the drafter's sentence was changed.
- 06_confidential: missing Open questions: text "Open question: does the spend export include the Harbour depot, or only the Central warehouse?" (project_note.md line 9). Review: introduced after review; the sentence passed the checker before review, and the drafter changed it after review, with no finding on it.
- state_b: missing Open questions: text "Open question: can Brightwater Packaging hold the October price into Q1?" (supplier_note.md line 8). Review: no finding named it.
- state_b: a sentence in the first run and not the second: open_questions | supplier_note.md line 8. Review: no finding named it.
- state_b: the removed list differs between the two runs. Review: no finding named it.
- 05_inference: removed by the checker from Open questions: "the Q3 returns rate in this week's brief was asked for, but no source states it; Returns, Q3 2026: 257 and Orders, Q3 2026: 3,150 are given." Reason: unsourced: number 2026 (no claim covers it)
- 06_confidential: removed by the checker from Open questions: ""Open question: does the spend export include the Harbour depot, or only the Central warehouse?"" Reason: the sentence does not carry the claimed value "Send the revised price list to the distributors"; the sentence does not carry the claimed value "not stated". Introduced after review: the sentence passed the checker before review.
- state_b: removed by the checker from Open questions: ""Open question: can Brightwater Packaging hold the October price into Q1?"" Reason: "Q1" is not a number

## The verdict rule, fixed before the first run

A1, A2 and B run five times each; the ceiling runs three times (decision 2). The rule is applied once every arm has its runs, and compares A1, A2 and B on bar met in n of 5. The ceiling enters the rule through its median cost a brief over its three runs; its bar met in n of 3 is reported beside it. Ties go to the arm with fewer parts.

1. **B earns its place** only if it meets the bar in more of its five runs than A2 does, and B's median cost a brief over its five runs stays below the ceiling's median cost a brief over its three.
2. **If A2 meets the bar in as many of five runs as B, or more,** the second agent is folded. The review step stays in the skill only if A2 also meets the bar in more of five runs than A1 (decision 8).
3. **If neither A2 nor B meets the bar in any of its five runs,** the entry says so and names every miss by case, section, fact and value.
4. Every arm's briefs matched of 8 in each run, claims verified, sentences removed, cost and seconds are reported beside the bar, and none of them decides the verdict.

The cost half of rule 1 is close to certain to hold: two runs of the smallest model cost about a twentieth of one ceiling run. The bar half is the test.

## Megat's predictions, signed before the first run

One line each, in Megat's words.

| Arm | Prediction (bar met in n of N, and why) |
|---|---|
| A1 | 3 of 5. |
| A2 | 4 of 5, because it has another round of checking that is focused on the checklist. |
| B | 5 of 5, because a fresh review that focuses only on reviewing is able to catch anything that was missed, since it has done no heavy work on the draft yet compared to the first agent. |
| Ceiling | 3 of 3, all will pass without any issue. |

Signed: Megat Jazly. Date: 12 Nov 2026.

