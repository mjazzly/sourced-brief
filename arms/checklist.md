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
