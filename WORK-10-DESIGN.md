# WORK-10 design note: when the week no longer fits in one read

Status: approved by Megat on 16 Nov 2026, every recommendation in decisions 1 to 15 as written, with three changes: decision 2 is a staged plan under a US$8 spend cap with a stop rule at each stage (section 6 rewritten around it); decision 7 gives `MCPAdapter` one attempt in the mock before the official `mcp` SDK; and two rules are added for every arm, on where `eval/expected/` is read and on prompt caching (section 4). Nothing is built. Written on branch `work-10` against `WORK-10-BRIEF.md`, `README.md` (v1.3), `eval/CASES.md`, `eval/ARMS.md`, `WORK-09-DESIGN.md`, `server.js`, `lib/sources.js` and `eval/run_eval.js` at 3afed6d, and, where the brief's hazards led, `lib/check.js`, `lib/store.js`, `eval/check.js` and `scripts/make_week.js`.

## 1. The question

When the week folder grows past what one read can hold, does a graph that retrieves keep the bar the six-file week set; does a vector index earn its place over a keyword search; and what does each route cost a brief, in money and seconds? The job runs in Python on LangGraph, with the existing `server.js` unchanged behind it, reached over MCP.

What is on record for the six-file week (`eval/ARMS.md`): the smallest model (claude-haiku-5-5) met the bar in 0 of 5 runs alone (A1) and 1 of 5 with the review step (A2); the largest (claude-opus-5-5, effort high) in 2 of 3. Every WORK-10 number goes on the page beside those, so no reader takes a model's base miss rate for a retrieval effect.

## 2. Sources checked, 16 Nov 2026

Every page below was read today. Where a page shows no date, the table says so. Where the brief or memory disagrees with a page, the page wins and the row says what changed.

| Source | URL | What it says | Date on the page |
|---|---|---|---|
| LangGraph on PyPI | https://pypi.org/project/langgraph/ | Latest release **1.2.22**. Requires Python >=3.10. Depends on `langchain-core>=1.4.7,<2`, `langgraph-checkpoint>=4.3.0,<5.0.0`, `langgraph-prebuilt>=1.1.0,<1.2.0`, `langgraph-sdk>=0.4.6,<0.5.0`, `pydantic>=2.7.4`, `xxhash>=3.5.0` (from the JSON API, https://pypi.org/pypi/langgraph/json). **The brief's 1.2.14 (6 Oct 2026) is superseded**: eight patch releases have shipped since. | 1.2.22 released Nov 14, 2026; "Data verified by PyPI on Nov 14, 2026" |
| LangGraph release history | https://pypi.org/project/langgraph/#history | 1.2.22 Nov 14; 1.2.21 Nov 12; 1.2.20 Nov 5; 1.2.19 Oct 30; 1.2.18 Oct 26; 1.2.17 Oct 24; 1.2.16 Oct 16. 1.2.3 is yanked ("unintended merging strategy regression"). | as listed |
| LangGraph releases on GitHub | https://github.com/langchain-ai/langgraph/releases | `langgraph==1.2.22` marked Latest. No breaking-change notes in the last three. 1.2.20 adds "give each interrupt() in a task its own id" and "a strict resume mode that refuses stale interrupt answers", both touching the stop node. | "14 Nov 01:43" (no year shown; matches PyPI) |
| Release policy | https://docs.langchain.com/oss/python/release-policy | Semantic versioning; breaking changes only in major versions; minor releases every 1 to 2 months, patches "often weekly". LangGraph 1.0 is the LTS line, active until 2.0. "Currently requires Python 3.10 or later." | no date on page |
| LangGraph overview | https://docs.langchain.com/oss/python/langgraph/overview | "a low-level orchestration framework and runtime for long-running, stateful agents". Install `pip install -U langgraph` or `uv add langgraph`. Import `from langgraph.graph import StateGraph, MessagesState, START, END`. | no date on page |
| Interrupts | https://docs.langchain.com/oss/python/langgraph/interrupts | `from langgraph.types import interrupt, Command`; pause with `interrupt(...)`, resume with `graph.invoke(Command(resume=...), config)`; needs a checkpointer and a `thread_id` in `config["configurable"]`, the same one on resume. **On resume "the runtime restarts the entire node from the beginning"; "any code that ran before the interrupt will execute again."** | no date on page |
| Checkpointers | https://docs.langchain.com/oss/python/langgraph/checkpointers | `InMemorySaver` from `langgraph.checkpoint.memory`, in package `langgraph-checkpoint`; SQLite in `langgraph-checkpoint-sqlite`, installed separately. | no date on page |
| MCP in LangChain | https://docs.langchain.com/oss/python/langchain/mcp | The docs now use `langchain.mcp` with an `MCPAdapter` class (beta), installed as `langchain[mcp]` (needs `langchain>=1.4.0`). A `Path` target runs a stdio subprocess; an `MCPConfig` dict `{"mcpServers": {...}}` is also accepted. No `env` key is shown on the pages read. | no date on page |
| MCP sessions | https://docs.langchain.com/oss/python/langchain/mcp/connections | "each time a tool is invoked, it opens the client, runs the MCP call, and releases it"; "If you want a session held open across several calls, keep the adapter's context open". | no date on page |
| MCP migration | https://docs.langchain.com/oss/python/migrate/langchain-mcp-adapters | `MCPAdapter` "replaces the standalone `langchain-mcp-adapters` package, whose `MultiServerMCPClient` is collapsed into a single `MCPAdapter` class". The old `client.session(...)` is "Not exposed". | no date on page |
| langchain on PyPI | https://pypi.org/pypi/langchain/json | 1.5.0; requires Python >=3.11; `langchain-core>=1.8.0,<2`; extra `mcp` pulls `fastmcp>=4.0.11`. | upload date not reached in the page read |
| langchain-core on PyPI | https://pypi.org/pypi/langchain-core/json | 1.8.1; **requires Python >=3.11** (since 1.8.0, 2026-11-11; 1.7.x allowed 3.10). `InMemoryVectorStore` is "the ephemeral, in-process vector store in `langchain-core`" (https://docs.langchain.com/oss/python/integrations/vectorstores/in_memory, no date). | 1.8.1 uploaded 2026-11-15 |
| langchain-anthropic on PyPI and docs | https://pypi.org/pypi/langchain-anthropic/json ; https://docs.langchain.com/oss/python/integrations/chat/anthropic | 1.7.10; Python >=3.10; needs `anthropic>=0.120.0`, `langchain-core>=1.7.5`. `effort=` is accepted (alias of `reasoning_effort`, needs >=1.5.3); top-level `cache_control` caching needs >=1.4.0; cache tokens are reported in `usage_metadata["input_token_details"]` (`cache_read`, `cache_creation`). | 1.7.10 uploaded 2026-11-04; docs no date |
| langchain-mcp-adapters on PyPI | https://pypi.org/project/langchain-mcp-adapters/ | 0.3.2; its README still shows `MultiServerMCPClient` and says the example "will start a new MCP `ClientSession` for each tool invocation". Superseded by `langchain.mcp` per the migration page. | Aug 6, 2026 |
| mcp (official Python SDK) | https://pypi.org/pypi/mcp/json | 2.3.0; Python >=3.10. | 2026-10-02 |
| bm25s, rank-bm25 | https://pypi.org/pypi/bm25s/json ; https://pypi.org/pypi/rank-bm25/json | bm25s 0.3.16, numpy its only required dependency. rank-bm25 0.2.2, last released 2022. The LangChain BM25 retriever page (https://docs.langchain.com/oss/python/integrations/retrievers/bm25) returned 404; `langchain-community` 0.4.2 says it "is being sunset". | bm25s 2026-10-28; rank-bm25 2022-02-16 |
| fastembed | https://pypi.org/pypi/fastembed/json | 0.9.1; Python >=3.10; runs on onnxruntime, **no torch**; default model `BAAI/bge-small-en-v1.5`, 384 dimensions. The model's download size is not stated. | 2026-10-24 |
| sentence-transformers | https://pypi.org/pypi/sentence-transformers/json | 6.3.0; requires `torch>=2.2`. | 2026-11-11 |
| faiss-cpu, langchain-chroma | https://pypi.org/pypi/faiss-cpu/json ; https://pypi.org/pypi/langchain-chroma/json | faiss-cpu 1.16.0 (numpy, packaging); langchain-chroma 1.1.0 (pulls chromadb). | 2026-11-10; 2025-12-12 |
| Embeddings, Anthropic docs | https://platform.claude.com/docs/en/build-with-claude/embeddings | "Anthropic does not offer its own embedding model." Names Voyage AI by MongoDB; keys come from a MongoDB Atlas account ("Create model API key"), set as `VOYAGE_API_KEY`. `voyage-4-lite` is "Optimized for latency and cost"; `voyage-4-nano` is open-weight, downloaded from Hugging Face. Voyage prices are on a MongoDB page not read here. `voyageai` on PyPI: 0.6.0, 2026-11-10. | no date on page |
| Claude pricing | https://platform.claude.com/docs/en/about-claude/pricing | Opus 5.5: input US$4, 5m cache write US$5, cache hit US$0.20, output US$20 per million tokens. **Haiku 5.5 has two tiers**: prompts up to 100,000 tokens US$0.10 / 0.125 / 0.01 / 0.50; prompts over 100,000 tokens US$0.50 / 0.625 / 0.05 / 2.50. "A request's prompt length counts all of its input tokens, including cache reads and cache writes." Opus 5.5 is one price across its 1M context. | no date on page |
| Token counting | https://platform.claude.com/docs/en/build-with-claude/token-counting | "Token counting is **free to use** but subject to requests per minute rate limits based on your usage tier" (5,000 to 20,000 a minute); "Token counting and message creation have separate and independent rate limits"; "The token count is an **estimate**". Accepts system prompts and client tools; `cache_control` is accepted but "prompt caching only occurs during actual message creation". Both claude-haiku-5-5 and claude-opus-5-5 are supported. The pricing page names the endpoint (computer use, browser use and its FAQ, "count it with Token counting and that model's ID") and lists no price for it. | no date on page (read 16 Nov 2026) |
| Model context windows | Anthropic models table (Claude API reference cached 3 Nov 2026) | Both claude-haiku-5-5 and claude-opus-5-5 take 1M tokens of context. Opus 5.5 rejects a forced `tool_choice` (`any` or `tool`) with a 400. | 3 Nov 2026 (cache date) |
| This Mac | `command -v`, `--version` | `/usr/bin/python3` is **3.9.6**, below LangGraph's floor. `uv` 0.11.11 at `~/.local/bin/uv`, with uv-managed Python 3.12.13 and 3.13.13 already installed. Homebrew 6.0.21. Node 24.18.0. arm64, macOS 26.7.2. No pyenv, conda, poetry or pipx. | checked 16 Nov 2026 |

## 3. What the code requires of the design

Read from the files as committed; each line names where it comes from.

1. **The archive must be flat files beside the six.** `loadSources` reads only `.csv` and `.md` names directly in the folder (`lib/sources.js`, `loadSources`); a subfolder is skipped whole. A reference names a bare file (`REF` allows no slash). The harness copies each entry with `copyFileSync` (`eval/run_eval.js:240`), which fails on a subfolder.
2. **No archive file may be named `brief_<yyyy-mm-dd>.md`.** That pattern is `OUTPUT_FILES`: the server never reads it as a source, and `loadRun` in `eval/check.js` takes the first such file in the folder as the released page. An archived brief named `brief_2026-10-16.md` would be read as the page before the draft.
3. **Gate 1 scans every readable `.md` file** for an action id on a line with a date different from its tracker due date (`disagreements` in `lib/check.js`). One archive note saying "A005 ... 2026-10-30" would make every tracker date claim on A005 fail unless cited with that line, in every case. CSV files are not scanned, so archived tracker snapshots may carry old dates freely.
4. **Lines that start "Decision needed:" or "Open question:" are source items** (skill step 3, `scripts/make_week.js` `expectedSentences`). One in the archive would ask the drafter for a sentence no expected list holds, and in 04_gap would fill What needs a decision, which must read only "No source this week."
5. **A first line that matches `\bconfidential\b` declines the file** and logs a confidential gate (`isConfidential`, `Store.open`). One in the archive would fire gate 3 in every case.
6. **The must-not lists apply to the whole page.** 06_confidential forbids "Brightwater", "Lead time on the Harbour route", "twelve months or six" and "October price"; 05_inference forbids 8.16, 8.2, 8.159, 8.1587, 0.0816, 0.08; 03_change forbids 0.23, 2.9, 2.90 and "points". An archived supplier note naming Brightwater, cited correctly, would fail 06. So no archive line may carry any must-not value of any case.
7. **`eval/check.js` has no command line.** It exports `loadExpected`, `loadRun`, `checkAll` and `verdict`; `node eval/check.js` does nothing. The runner needs a small Node entry that imports them (decision 13).
8. **The Node harness reads only `data/cases/`** (`eval/run_eval.js:239`), and records either to `eval/results-arms/` and rebuilds `eval/ARMS.md` (with `--arm`) or to `eval/results/` and rebuilds `eval/EXEMPLAR.md` (without). Both are kept untouched. So arm E cannot simply be pointed at `data/cases-grown` (decision 5).
9. **One brief that reaches the call cap ends the whole Node run uncounted.** The cap error is thrown out of the brief loop to the run's `catch`, which sets `completed = false`, and `counted` needs `completed` (`eval/run_eval.js:143, 268, 293`). `--max-calls` already exists (default 30).
10. **The skill tells the model the folder holds "up to seven source files"** and to `read_source` every readable file (`skill/SKILL.md` lines 20 and 44). Arm E runs it unchanged, by design; the mismatch is part of what E measures.
11. **The sources line names every readable file** (`Store.draftBrief`), from `loadSources`, not from what was read. With the archive it lists about two hundred names. State B compares sources lines; both runs carry the same folder, so it holds.
12. **The six-file week, as the model reads it.** In W202611121652 01_clean the seven reads returned 14,542 characters and the prompt grew from 9,783 to 17,475 tokens: about 7,700 tokens, or about 1,100 tokens a file. The largest prompt in any WORK-09 call was 42,424 tokens, so WORK-09's single Haiku price was right; WORK-10's grown week crosses Haiku's 100,000 token line (decision 12).

And from the docs:

13. **An interrupted node runs again from its start on resume.** If the node that calls the server's `stop` tool also calls `interrupt()`, the stop is logged twice. The tool call and the pause go in two nodes (decision 11).
14. **`MCPAdapter` opens a session per tool call unless its context is held open.** With a stdio target that likely means a fresh `server.js` per call, which would lose `set_case` (held in memory) and restart the store for each call. The adapter's context is held open for the whole brief, and the mock proves one process served it (decision 7).
15. **Opus 5.5 rejects a forced `tool_choice`.** The draft node's structured output must use the API's JSON schema output (`output_config.format`), not a forced tool call (decision 10).
16. **`langchain` 1.5 and `langchain-core` 1.8 need Python 3.11 or later**, though LangGraph itself says 3.10. The system Python (3.9.6) can run none of it (decision 4).

## 4. The design

### The graph (`graph/`)

One LangGraph `StateGraph` per brief, compiled with `InMemorySaver`, one `thread_id` per brief. The server is started once per brief on a fresh copy of the week folder, and one MCP session serves every node.

| Node | What it does | Model call |
|---|---|---|
| `sources` | `set_case`, then `list_sources`; records the week ending, the latest tracker run, every file read and declined | none |
| `retrieve` | P and PG: every index entry. K and V: the top `k` entries for each section's fixed query, merged and deduplicated in file and line order. Records the retrieved references per section | none (V embeds the queries locally) |
| `draft` | One call: the drafter's instructions, the compact sources list, the retrieved lines; returns `sections` (the five keys, the server's sentence and claim shape) and `stops` (reason and text) | one |
| `record_stops` | Calls the server's `stop` once per stop the draft returned | none |
| `wait` | If a stop has reason `disagreement` and the case has a fixed answer, `interrupt()`; the runner resumes with `Command(resume=<eval/answers.txt line>)`. The answer is recorded in the trace | none |
| `submit` | `draft_brief` once with `sections` | none |
| `record` | Writes the trace and the brief's part of the result record | none |

The index is built before the graph, per brief, from `read_source` on every readable file (so a declined file never enters it): one entry per document line or CSV row, carrying its reference in the server's grammar (`project_note.md line 9`, `tracker.csv A007`, `answers.csv D202610300900-Q03`, `decision_log.csv line 10`). Blank lines and CSV header lines are left out; they cannot be cited.

### The arms

The brief's four arms, plus one (decision 9):

| Arm | Folder | What runs | Compared with | What the comparison measures |
|---|---|---|---|---|
| P | `data/cases` | the graph, every entry | WORK-09 A1 | the graph and the one-call draft against the agent loop |
| PG | `data/cases-grown` | the graph, every entry | P | the grown week with nothing else changed |
| E | `data/cases-grown` | the Node harness as it stands, `--arm one` | PG | the agent loop against the graph on the grown week |
| K | `data/cases-grown` | the graph, BM25 top `k` | PG | retrieval with no index model |
| V | `data/cases-grown` | the graph, vector top `k` | K | whether a vector index earns its place |

Without PG, K against E changes two things at once (the orchestrator and the retrieval), which breaks the brief's own "one change at a time".

### What is measured

As the brief sets it out: recall with no model first (for K and V, at every `k` in decision 6), then per run briefs matched of 8, claims verified, removals with the checker's reason, gates held, the bar, model calls, tokens, cost a brief, seconds a brief; and for K and V every miss named as a retrieval miss (an expected reference not among the lines the drafter saw) or a drafting miss (it was there and the page lacks the fact). A change fact needs both its references retrieved.

### Two rules for every arm

- **Where `eval/expected/` is read.** In two places only: the recall measure (stage 0, a step outside the graph) and `graph/check_case.mjs` after a page is released. The mock proves that no graph node and no run folder can reach it: it records every file the graph process opens (Python's audit hook on `open`) and fails on any path under `eval/expected/`, and it fails if any file in any run folder matches a file there.
- **Prompt caching: on in E, off in the graph** (changed by Megat on 16 Nov 2026, after session 2's finding in section 7a). E runs exactly as the Node harness runs it, every call with top-level `cache_control: {"type": "ephemeral"}`; its loop sends a growing conversation, so each call reads the previous call's prompt from the cache. P, PG, K and V send **no `cache_control` at all**: the graph makes one call a brief, and with only a top-level breakpoint each call writes its whole prompt to the cache at its end, which the next brief never reads, since it shares only the instructions with it; caching would price every input token at the cache-write rate for no return. The rule as first approved rested on the expectation that the instructions would be read from cache across a run's eight briefs, which section 7a shows does not hold. Mock check 3 fails any graph request that carries `cache_control` anywhere; E's check is unchanged. Every call is priced from its own fresh, cache-write and cache-read tokens at its own tier (decision 12); a graph call's input is all fresh input, priced at its tier in the stage 0 forecast and the ledger.

### Records

`eval/results-graph/<label>.json`, one per counted run, with the keys of `eval/results-arms/` plus `retriever`, `lines_per_section`, `index_entries`, `index_seconds`, `recall_by_case`, `retrieval_misses`, `drafting_misses`, `framework_version`, and a trace per brief in `eval/results-graph/<label>/`, in the WORK-09 trace shape with the retrieved references added. `eval/GRAPH.md` is rebuilt from them after every run. Labels: `G<yyyymmddhhmm>-<arm>-<model tag>[-<effort>]`.

## 5. Open decisions (Megat's)

### 1. Archive size and its rules

From the measure in section 3, item 12, one archive file costs about 1,100 tokens as `read_source` returns it. **The token figures in this table are estimates, which stage 0's count replaces.** Measured in session 2 on the archive as built (decision 1b): one grown folder's `read_source` results come to 225,120 characters, **about 120,000 tokens of reads** at the six-file rate (7,692 tokens for 14,542 characters), not 220,000, because an archive file averages about 560 tokens; `list_sources` adds 36,436 characters, about 19,000 tokens. The 200 files are kept as decided; no file is lengthened to reach the estimate.

| Option | Documents | The grown week as read | What it means |
|---|---|---|---|
| a | 48 (six earlier weeks, eight each) | about 55,000 tokens | Still under Haiku's 100,000 token price line. E reads it cheaply; a weak test. |
| **b** | **200 (25 earlier weeks, eight each)** | **about 220,000 tokens (estimate; measured as built: about 120,000 tokens of reads)** | **Past Haiku's price line, well inside both models' 1M windows. Reading everything is still possible, at five times Haiku's price per token and about 200 read calls.** |
| c | 1,000 | about 1.1M tokens | Past the 1M window. E cannot read it all and fails on the first brief; retrieval is the only route. The literal "past what one read can hold". |

**Recommendation: b.** It is the brief's two hundred documents, and it is honest to say what it shows: at 200 documents the week no longer fits one *cheap* read, but it still fits one read. The page says so in those words. Option c answers the literal question and is held for a later session if b leaves it open.

The rules, for whichever size is chosen (the generator enforces each; the proof below checks each):

- **Shape.** 25 earlier weeks, ending 2026-05-01 to 2026-10-16 (the six-file week ends 2026-10-30; `brief_previous.md` is 2026-10-23). Eight files a week: project note, supplier note, released brief, meeting note, risk note (`.md`), tracker snapshot, answers snapshot, decision log snapshot (`.csv`). No merged-table snapshots. Names `archive_<week>_<kind>.<ext>`, for example `archive_2026-10-16_brief.md`, so none matches `brief_<date>.md`, a six-file name or `risk_note.md`. Flat in the folder. The same archive bytes in every grown folder, so cases still differ only as `eval/CASES.md` says.
- **Near misses, on purpose.** Each of the four metrics (orders, revenue, returns rate, average order value) appears in at least eight archived briefs and answer snapshots with a different value, the Q3 2026 ones included from weeks ending in October. The archived trackers hold older actions under the same ids A001 to A008: each id carries one older action at a time, drawn from a seeded pool of neutral actions for the same five people and three client firms, with a transcript name and meeting date of its own; it runs open for one to four weeks, closes, stays one week more as closed, and the id then takes the next action, so every snapshot holds open and closed rows. No archived row or line repeats the text of any of the eight current actions (tracker.csv adds those in runs R2026-10-23-1 and R2026-10-30-1). Each archived brief's What moved and What is due lines follow its own week's archived tracker, and its What is due lines cite the row by number (`tracker.csv row 7`), not by id, so no `.md` line that names an action id carries a date. Archived briefs carry What moved lines for older files and runs. Decision and question lines from earlier weeks are written as "Decided on <date>:" and "Answered on <date>:", which a keyword search still finds and the shape table does not name. One near miss added in session 2: 14 of the 25 archived briefs carry, under What needs a decision, a line of the form "Whether to … was still open that week." (the other 11 read "No source this week."), which tempts a drafter in 04_gap, where that section must read only "No source this week.".
- **Forbidden.** A line starting "Decision needed:" or "Open question:"; a first line matching `\bconfidential\b`; in a `.md` file, an action id on a line with any date other than that action's tracker due date; any must-not number or string of any case; a name that matches `OUTPUT_FILES`, a six-file name or `risk_note.md`; a subfolder.
- **The proof, before any model call** (`graph/prove_grown.mjs`, Node, importing `lib/` and `eval/check.js` unchanged), for each of the seven grown folders against its six-file folder: the declined lists are equal; for every tracker row, a date claim alone on its due date gives the same result (pass, or the same disagreement) in both; the expected sentences of `eval/expected/` run through `checkDraft` pass and fail exactly as on the six-file folder; the forbidden scan finds nothing; and the mock through the real server meets the bar on the grown week. Any failure stops the build.

### 2. Models and run counts

**As approved: a staged plan under a US$8 spend cap, set out in section 6.** The smallest model drafts in every arm: five runs each of P, K and V (stage 1), and one counted run each of PG and E after one uncounted E brief (stage 2). The largest model, at effort high, runs K and V once each, only on Megat's word and only if stage 1 leaves the verdict open (stage 3). Within a stage the arms take turns, as in WORK-09.

The options first put, for the record: a, five runs each of P, PG, K, V and E on the smallest model (about US$14); b, a plus three runs each of K and V on the largest (about US$27, recommended then); c, b plus three runs of E on the largest (about US$61).

**The verdict rule, fixed before the first run** (part of this decision):

1. **Retrieval keeps the bar** if the better of K and V meets the bar in at least as many of its five runs as P does; ties on bar met are broken by median briefs matched of 8.
2. **V earns its place** only if it meets the bar in more of five runs than K, or ties with K and has the higher median briefs matched; any other tie goes to K, the arm with fewer parts.
3. PG and E (one run each) are reported for misses, forecast and measured cost, and seconds, and decide nothing.
4. Recall is reported beside every arm and decides nothing.
5. The rule reads stage 1 only. Stage 3's runs, if Megat starts them, are reported beside the verdict and do not change how the rule reads.

The tie-breaker is there because the smallest model met the bar in 0 of 5 on the six-file week; on bar met alone, every arm may read 0 of 5 and say nothing. Stage 1 **leaves the verdict open** when rule 1 or rule 2 is settled only by the tie-breaker or the fewer-parts tie, or when P, K and V all meet the bar in 0 of 5.

### 3. Embedding model and store for V

| Option | What | What it needs from Megat | Cost |
|---|---|---|---|
| **a** | **`fastembed` 0.9.1 with `BAAI/bge-small-en-v1.5` (ONNX, no torch), in `langchain-core`'s `InMemoryVectorStore`** | **a one-time model download from Hugging Face (size not stated on the pages read; checked at download, with Megat's OK); no account; no key** | **none a run** |
| b | `sentence-transformers` 6.3.0, the same model, in FAISS | the same download plus torch (several hundred megabytes) | none a run |
| c | Voyage `voyage-4-lite`, hosted, through `voyageai` 0.6.0 | a MongoDB Atlas account and a `VOYAGE_API_KEY`, both Megat's to create | per token; the price page was not read |
| d | `voyage-4-nano`, open weights, run locally | the Hugging Face download and torch | none a run |

**Session 2:** the download, through fastembed into `graph/models/`, needed no account or token and takes 64 MB on disk; fastembed maps the name to the quantized ONNX build `Qdrant/bge-small-en-v1.5-onnx-Q`. Embedding a grown week's 1,712 entries took 43 seconds on this Mac's CPU with nothing else running, and 73 to 276 seconds a brief in the final V mock while other jobs shared the CPU; `index_seconds` and seconds a brief in V depend on what else the Mac is doing, so V's paid runs are best started with nothing else heavy running.

**Recommendation: a.** It needs no account, no key and no torch; the index is a few thousand entries a folder, which brute-force search in memory handles in milliseconds; and a local model on the CPU gives the same vectors every run, so the free recall numbers repeat. If V loses to K on a, a hosted model is a fair follow-up question, not this build's.

For K, the same choice in short: **`bm25s` 0.3.16** (numpy only, released 28 Oct 2026) with a fixed tokenizer (lowercase, split on non-alphanumerics, ids such as A005 and D202610300900-Q03 kept whole, no stemming), against `rank-bm25` 0.2.2 (last released 2022) or LangChain's `BM25Retriever` (its docs page is gone and `langchain-community` is being sunset). Recommendation: bm25s.

### 4. Python setup

| Option | What |
|---|---|
| **a** | **`uv` 0.11.11 (already installed): a project in `graph/` with `pyproject.toml`, `uv.lock` committed, `.python-version` set to 3.12, every package pinned exactly** |
| b | the same with Python 3.13 |
| c | `python3.12 -m venv` and `pip` with a pinned `requirements.txt` |

**Recommendation: a.** uv and its Python 3.12.13 are on the Mac already, so nothing new is installed system-wide; the lock file records every transitive version, which is what `framework_version` points at. 3.12 meets `langchain-core` 1.8's 3.11 floor with room, and is the safer bet for onnxruntime wheels than 3.13 (not checked either way). Pins at the build, from today's pages: `langgraph==1.2.22`, `langchain-core==1.8.1`, `langchain[mcp]==1.5.0`, `langchain-anthropic==1.7.10`, `bm25s==0.3.16`, `fastembed==0.9.1`; session 2 reads PyPI again before pinning and records any change in this note. **Session 2, 16 Nov 2026, from the PyPI JSON API:** every pin above is unchanged (langgraph 1.2.22, 2026-11-14; langchain-core 1.8.1, 2026-11-15; langchain 1.5.0, 2026-11-11; langchain-anthropic 1.7.10, 2026-11-04; bm25s 0.3.16, 2026-10-28; fastembed 0.9.1, 2026-10-24; mcp 2.3.0, 2026-10-02). Two direct pins are added: `anthropic==2.8.0` (2026-11-10), for stage 0's `messages.count_tokens`, and `mcp==2.3.0`, which `langchain[mcp]` already pulls in through `fastmcp` 4.2.0 (`mcp>=2.3.0,<3`), pinned so decision 7b needs no second sync. On 3.12, numpy 2.5.5 and onnxruntime 1.32.0 publish macOS arm64 wheels; the fastembed supported-models table lists `BAAI/bge-small-en-v1.5` at 0.067 GB. `uv sync` downloads packages, which Megat approves when session 2 runs it.

### 5. The Node harness for arm E

| Option | What changes |
|---|---|
| a | One flag, `--cases <dir>`, in `eval/run_eval.js`: reads week folders from `<dir>`, records to `eval/results-graph/` with traces, and rebuilds neither `ARMS.md` nor `EXEMPLAR.md`. Without the flag, the file behaves exactly as at 3afed6d. |
| **b** | **No change to the Node harness. `graph/run.py --arm E` builds a scratch copy of the repo under `graph/runs/<label>/repo/` (gitignored; `node_modules` linked, not copied) with `data/cases` replaced by `data/cases-grown`, runs `node eval/run_eval.js --arm one --model ... --max-calls <n>` there, and copies its record and traces into `eval/results-graph/`, the Node record kept whole inside the graph record. The copy's own `ARMS.md` is thrown away.** |

**Recommendation: b.** It keeps `eval/run_eval.js` byte for byte, so E is "the existing Node harness, as it stands" in fact and not by intent, and no WORK-09 file changes. Its cost is one indirection, documented in the README. `--max-calls` is the flag that exists: at its default of 30, a model that reads ten files a call would reach the cap on 200 files, and one capped brief ends the whole run uncounted (section 3, item 9). The value is set in stage 2 from one uncounted brief (section 6), and the record shows the cap used.

### 6. Lines per section and the queries

The six-file week has about 100 citable entries and at most six source items in a section; the grown week about 3,000 (estimates; measured in session 2: 86 and 1,712 index entries in 01_clean).

| Option | What the drafter sees |
|---|---|
| a | `k` = 10 a section, about 50 lines |
| **b** | **`k` = 20 a section, about 100 lines, close to the six-file week's whole size** |
| c | `k` = 10 and `k` = 20 both in paid runs (doubles the K and V runs) |

**Recommendation: b, fixed for every paid run, with free recall reported at `k` = 5, 10, 20 and 40.** At 20 a section the drafter's context in K and V is about the size it had in P, so the comparison is between which lines, not how many. The four other values cost nothing and show where recall turns.

**The queries.** One fixed query per section, written from the skill's shape table only, with two values filled from `list_sources` (the week ending date and the latest tracker run id). For example, What moved: "closed this week <latest run> reconcile read merged held". The five templates go into this note, and their hash into every record, before recall is first measured. Recall is computed against the expected lists, so tuning the queries after seeing it would fit them to the answer key; if a template changes after the first recall run, the page shows every version and its recall. No query names a file.

**The five templates, as fixed in session 2 before any recall was measured** (`graph/queries.json`, version 1; `{week_ending}` and `{latest_run}` filled from `list_sources`):

| Section | Template |
|---|---|
| What moved | `closed this week {latest_run} reconcile read merged held` |
| What is due | `open action owner due date {week_ending}` |
| What changed in the numbers | `orders revenue returns rate average order value period value last week` |
| What needs a decision | `decision needed whether disagreement` |
| Open questions | `open question owner not stated asked for` |

Tokenizer, the same for the index and the queries: lowercase; ids (A005, D202610300900-Q03, R2026-10-30-1, N2026-10-29-1) and ISO dates kept whole; every other token split on non-alphanumerics; no stemming, no stopwords (`graph/queries.py`). **Hash: `0cf884ee0e52043ad02034644dbb3eaaa36880f2af8ff13e0a489f71522f2f1c`**, sha256 of the canonical JSON of the version, tokenizer and templates (`queries_hash` in `graph/queries.py`); every record carries it.

### 7. The MCP client route in Python

| Option | Route |
|---|---|
| **a** | **`langchain.mcp`'s `MCPAdapter` (beta, `langchain[mcp]` 1.5.0), the route the current docs give, with its context held open for the whole brief** |
| b | the official `mcp` 2.3.0 SDK's stdio client and `ClientSession` directly |
| c | `langchain-mcp-adapters` 0.3.2 with `client.session(...)` and `load_mcp_tools` |

**As approved: a gets one attempt in the mock, then b.** Session 2 builds the client on `MCPAdapter` first, held open for the whole brief, and runs the mock once. That attempt must prove two things the pages read leave open: one `server.js` process serves every call of a brief (checked by the process id the server reports, and by `case_id` filled on every `run_log.csv` line, which only holds if `set_case` and later calls share a process), and the server receives `SOURCED_BRIEF_DATA` and `SOURCED_BRIEF_RUN_ID` (checked by the run folder and run id in `run_log.csv`). If either fails on that one attempt, the client switches to the official `mcp` 2.3.0 SDK (b), and this note records which check failed and what the adapter did. No second attempt is made at a. c is the package the docs now replace.

**Session 2 result: the build ends on a, `MCPAdapter`.** On its one attempt (mock run `graph/runs-mock/adapter-attempt`, arm P, 8 briefs), mock check 1 passed: every brief's `run_log.csv` holds exactly one `load` line (each `server.js` process writes one when it opens the folder), every later line carries the brief's `case_id`, every line carries the run id the runner passed, the log sits in the brief's own copied folder, and `data/week/` gained nothing, so the server received `SOURCED_BRIEF_DATA` and `SOURCED_BRIEF_RUN_ID` through the `MCPConfig` entry's `env` key. `server.js` reports no process id and stays unchanged, so the load line stands in for the process id the note named. The route is recorded in `graph/route.json`; `mcp` 2.3.0 stays pinned as route b.

### 8. The entry's name on the AI Work page

| Option | Name |
|---|---|
| **a** | **WORK-10 as the working name; Megat picks the public title after the result, as for WORK-09** |
| b | "Sourced brief at two hundred documents" |
| c | "The week that no longer fits" |

**Recommendation: a.** The honest title depends on what decision 1 settles and what the runs show.

### 9. Arm PG

**Options:** a, add PG (the graph reading every entry of the grown week); b, run the brief's four arms only. **Recommendation: a.** It makes each comparison one change (section 4), and on the smallest model costs about US$1 a run.

### 10. The drafter's instructions and output in the graph

**Options:** a, built at run time from `skill/SKILL.md`, as WORK-09 built its arm skills: CONTEXT, ROLE, OUTPUT (the shapes and claim kinds), WHEN TO STOP and RULES AND STYLE copied byte for byte; STEPS replaced by a graph step in `graph/draft_step.md` that says the lines are given, not read, and that stops are returned in `stops`; the mock fails if a copied part differs from SKILL.md. b, a new prompt written for the graph. **Recommendation: a.** The drafter knows what A1 knew and nothing else.

The output uses structured output through the API's JSON schema (`output_config.format`), never a forced tool call (section 3, item 15); session 2 confirms which `ChatAnthropic.with_structured_output` method sends that, from the docs, before writing it. **Session 2:** the docs say `method="json_schema"` uses "Claude's dedicated structured output feature" without naming `output_config.format`, and the pages read do not confirm a top-level `cache_control` pass-through; one pass through the installed `langchain-anthropic` 1.7.10 source confirmed both (the `json_schema` branch of `with_structured_output` binds `output_config={"format": ...}`; `_get_request_payload` keeps a `cache_control` kwarg top-level when `_llm_type` is `anthropic-chat`, the direct API), so the draft node uses `ChatAnthropic`, with `cache_control` set through `model_kwargs`. The mock records the exact request body at a local stand-in for the Messages API (`graph/mock_model.py`), and stage 0 captures the same body the same way and counts it with every key but `max_tokens`. The drafter's instructions leave out INPUTS AND TOOLS, which describes tools the drafter does not have in the graph; the file shapes and the reference grammar reach it through the OUTPUT section and the references on every line. Every arm's lines are shown the same way: the reference, then the line or the row with its column names, grouped by file in file order. The sources list is compact: week ending, latest tracker run, files declined, and the file names.

### 11. Where the stop sits

**Options:** a, the draft returns `stops` with `sections` in its one call; `record_stops` calls the server; `wait` pauses on a disagreement and resumes on the fixed answer, which is recorded and does not change the draft; b, after the resume a second model call revises the draft with the answer; c, a gate-finding call before the draft. **Recommendation: a.** It keeps one model call a brief, and the fixed answer ("Show both; the reader decides.") is what the skill already tells the drafter to do, so the draft loses nothing. The tool call and the pause sit in two nodes, so the stop is logged once although the paused node runs again on resume. The page says plainly that the harness plays the person.

### 12. The price table

**Options:** a, `graph/prices.json` with both Haiku 5.5 tiers and the cache rows from the pricing page read today; the graph prices each call by its own prompt length; E's cost is recomputed from its trace, call by call, with the same table, and the Node harness's own figure is kept beside it; `eval/prices.json` untouched. b, cost from `eval/prices.json` as the brief says. **Recommendation: a** (approved). The stage 0 forecast and the spend ledger (section 6) price from the same table. `eval/prices.json` holds one Haiku price; on the grown week most Haiku calls cross 100,000 tokens and pay five times as much, so b would report E and PG at about a fifth of their cost. The WORK-09 figures stand: no WORK-09 call passed 42,424 tokens.

### 13. The case check entry

**Options:** a, `graph/check_case.mjs`, a few lines of Node that import `loadExpected`, `loadRun`, `checkAll` and `verdict` from `eval/check.js` and print the result as JSON; b, port the checker to Python. **Recommendation: a.** One checker, unchanged, which is the brief's reason for calling Node.

### 14. `WORK-10-BRIEF.md`

**Options:** a, kept local and added to `.gitignore` beside `WORK-09-BRIEF.md`; b, committed with this note. **Recommendation: a**, as for WORK-09. Not done in this session.

### 15. Where the grown week's generator lives

**Options:** a, a new `graph/make_grown.mjs` that copies each committed `data/cases/<case>` folder byte for byte into `data/cases-grown/<case>` and writes the archive beside it from its own generator on the same seed (20261030); `scripts/make_week.js` untouched; b, an addition to `scripts/make_week.js` behind a flag. **Recommendation: a.** The six files of every grown folder are then the committed six files exactly, which the proof can check by hash, and the v1.2 generator stays as it is.

## 6. The staged plan: spend cap US$8

The runs are Megat's, from Terminal with the `.env` key, one command each. Megat writes and signs one prediction line per arm before the first counted run; the stage 0 forecast and recall exist before that, and he may read them first.

**The cap.** `graph/run.py` keeps a spend ledger, `eval/results-graph/spend.json`: every paid model call of WORK-10 (counted runs, the uncounted E brief, anything else), priced from `graph/prices.json` call by call, with the run label and the stage. Before a run starts, the runner adds that run's forecast to the ledger total and refuses the run if the sum passes US$8.00. During a run it stops after the brief on which the ledger passes US$8.00, and that run is recorded as not counted. Token counting and mock runs cost nothing and enter the ledger at zero.

**At the end of every stage, session 3 stops and reports to Megat** with the stage's result, the ledger total so far, and the forecast for the next stage. The next stage starts only on his word.

### Stage 0: forecast and recall, no spend

1. **Count the tokens of every grown folder** with the token counting endpoint, which the token counting page says is "free to use" (section 2; the pricing page names the endpoint and lists no price for it). The count is the page's own "estimate". For each of the eight briefs and each arm, the runner builds the exact request that arm would send and counts it with each model it may use: for P, PG, K and V the draft request (instructions and lines); for E the skill and tools, `list_sources`, and every `read_source` result of the folder, which is the prompt E reaches once it has read everything. Counting has its own rate limit (5,000 a minute at the lowest tier), far above the few hundred requests this needs.
2. **Forecast the cost a brief for every arm** from those counts and `graph/prices.json`, at each call's own tier. Output tokens cannot be counted before a call, so the forecast takes each model's median output a brief from its WORK-09 records (the smallest model's A1 runs, the largest model's ceiling runs). E's forecast assumes the A1 pattern on record (list, read everything in one turn, draft, read back); stage 2 measures what E really does.
3. **Measure recall for K and V** at `k` = 5, 10, 20 and 40, with the fixed, hashed queries (decision 6).
4. **Write the forecast and recall into this note and into `eval/GRAPH.md`** before any paid run.
5. **The stop rule.** If at `k` = 20 either K or V leaves any expected reference unretrieved in any brief, stage 0 stops and reports: such a brief cannot match in any paid run of that arm. The report names every reference missed, by brief, section and query. The queries are not changed to fix it (decision 6); whether stage 1 runs anyway is Megat's call.

### Stage 0 result, 16 Nov 2026 (run S0202611161338)

Queries version 1, hash `0cf884ee…2f1c`, unchanged; k as decided. Recall is the expected facts' references among the lines the drafter would see (found / expected), by brief:

| Arm | k | 01_clean | 02_disagreement | 03_change | 04_gap | 05_inference | 06_confidential | state_b | state_a |
|---|---|---|---|---|---|---|---|---|---|
| K | 5 | 2/22 | 2/23 | 2/22 | 0/20 | 2/23 | 1/20 | 2/22 | 3/24 |
| K | 10 | 2/22 | 2/23 | 2/22 | 0/20 | 2/23 | 1/20 | 2/22 | 4/24 |
| K | 20 | 3/22 | 3/23 | 3/22 | 1/20 | 3/23 | 2/20 | 3/22 | 4/24 |
| K | 40 | 5/22 | 5/23 | 5/22 | 3/20 | 5/23 | 4/20 | 5/22 | 6/24 |
| V | 5 | 0/22 | 0/23 | 0/22 | 0/20 | 0/23 | 0/20 | 0/22 | 0/24 |
| V | 10 | 0/22 | 0/23 | 0/22 | 0/20 | 0/23 | 0/20 | 0/22 | 0/24 |
| V | 20 | 2/22 | 2/23 | 2/22 | 2/20 | 2/23 | 2/20 | 2/22 | 2/24 |
| V | 40 | 5/22 | 5/23 | 5/22 | 4/20 | 5/23 | 5/20 | 5/22 | 6/24 |

At k = 20 neither arm finds every expected reference in any brief (Megat's prediction: K in 4 of 8, V in 3 of 8; measured: K 0 of 8, V 0 of 8). **The stop rule (step 5) fires**: 314 expected references are not retrieved across the 16 arm-briefs, listed in `eval/results-graph/stage0/recall.json`. Of the 98 to 100 lines K and V show the drafter in a brief, 3 to 5 come from the week's own files; the rest are archive near misses. Under the stop rule no brief of K or V can match in a paid run; whether stage 1 runs anyway is Megat's call. The queries, the tokenizer and k are not changed.

Counted tokens of the request each arm sends, claude-haiku-5-5 (the token counting endpoint's estimate; claude-opus-5-5 counted the same):

| Arm | Lowest brief | Highest brief | Against Haiku's 100,000 token line |
|---|---|---|---|
| P | 15,183 (06_confidential) | 15,555 (05_inference) | under |
| PG | 143,003 (06_confidential) | 143,375 (05_inference) | over |
| K | 19,378 (01_clean) | 19,585 (state_a) | under |
| V | 18,816 (01_clean) | 18,845 (06_confidential) | under |
| E (the read-everything prompt) | 150,551 (06_confidential) | 151,187 (state_a) | over |

The forecast a run, from these counts and `graph/prices.json`, with each model's median output a brief from its WORK-09 records (9,692 tokens Haiku A1; 6,026 tokens Opus high Ceiling); a graph call priced as fresh input at its tier, E as one cache write and one cache read of its read-everything prompt plus the median output:

| Arm | claude-haiku-5-5 | claude-opus-5-5, high |
|---|---|---|
| P | US$0.0511 | US$1.4567 |
| PG | US$0.7667 | US$5.5469 |
| K | US$0.0543 | US$1.5862 |
| V | US$0.0538 | US$1.5666 |
| E | US$1.0126 | US$7.2730 |

The stages as first planned, from these counts (replaced by the revised plan below):

| Stage | Runs | Forecast | Ledger after the stage |
|---|---|---|---|
| 0 | 80 token counts | US$0 | US$0 |
| 1 | P, K, V on the smallest model, five each | US$0.80 | US$0.80 |
| 2 | one uncounted E brief (US$0.13), PG (US$0.77) and E (US$1.01) once each | US$1.91 | US$2.71 |
| 3 | K and V on the largest model, once each | US$3.15 | US$5.86 |

US$2.14 of the US$8 cap would have been left at the end of stage 3.

### The version 1 verdict, from stage 0 alone (recorded 16 Nov 2026, on Megat's word)

**K and V cannot keep the bar at k = 20, and V does not earn its place over K.** At 20 lines a section neither finds every expected reference in any of the eight briefs (K at most 4 of 24, V 2 in every brief), so under the stop rule no brief of either can match, and no paid run is needed to reach the verdict. The cause is the same for both: nothing in a query separates this week's lines from earlier weeks' lines, so the archive's near misses (the same shapes, metrics, owners and words, often in shorter lines) fill the top of every section. Queries version 1 stays as it is, with its hash `0cf884ee…2f1c` and its recall above.

### Arm F, filter by week (added after stage 0's finding)

Added by Megat on 16 Nov 2026, after the version 1 verdict, to test whether the week, not a query, is what separates the lines. Each index entry carries the week of its file, read from the file's own content as `read_source` returns it, never from its name: a document's "week ending <date>" title line, or a CSV's latest run id or timestamp, taken to the Friday on or after it. F keeps every entry from files of the current week (the week ending from `list_sources`) and the week before, and shows the drafter all of them: no top k, no query, no embedding model. Everything else is the graph as built: the same instructions, the same draft call, no `cache_control`. If a file's week cannot be read from its content, F stops; it never falls back on the name.

**The fallback for a CSV with no run id and no timestamp** (Megat, 16 Nov 2026): the latest date (yyyy-mm-dd) in its rows, taken to the Friday on or after it. In this data it applies to `merged.csv` only, the one file the first rule could not read in any folder (its columns are record_id, branch, sale_date, delivery_date, customer, product, quantity, net_amount, gross_amount, source_file); its latest date, delivery 2026-10-26, gives the week ending 2026-10-30. No expected fact cites `merged.csv`.

**What F measures on this archive.** The archive's last week ends 2026-10-16, so F keeps exactly the week's own files (the six, `risk_note.md` in state_a, and `brief_previous.md`, which is the week before). Its lines therefore equal P's lines on the six-file week, and only the sources line differs, which names all 207 files of the grown folder. F measures whether filtering by week alone returns the graph to P.

**F's stage 0 result, 16 Nov 2026 (run S0F202611161504).** The mock passed all eight checks on the eight briefs (`graph/runs-mock/final-F`), and F's draft request equals P's byte for byte apart from the one line that lists the folder's files. Recall, every expected reference among the lines F keeps:

| | 01_clean | 02_disagreement | 03_change | 04_gap | 05_inference | 06_confidential | state_b | state_a |
|---|---|---|---|---|---|---|---|---|
| F | 22/22 | 23/23 | 22/22 | 20/20 | 23/23 | 20/20 | 22/22 | 24/24 |
| lines kept | 86 | 86 | 86 | 84 | 88 | 81 | 86 | 90 |

Every expected reference is kept in **8 of 8** briefs (Megat's prediction: 6 of 8). The files kept in each brief are the week's own, read from their content: `answers.csv`, `brief_previous.md` (the week before), `decision_log.csv`, `merged.csv` (by the fallback), `project_note.md`, `supplier_note.md` (declined in 06), `tracker.csv`, and `risk_note.md` in state_a. Counted tokens on claude-haiku-5-5: 18,333 (06_confidential) to 18,705 (05_inference), under Haiku's 100,000 token line; forecast US$0.0536 a run (fresh input at its tier, Haiku A1's median output).

### The revised plan (Megat, 16 Nov 2026, after stage 0)

Stage 0 settled K and V without a paid run (the version 1 verdict above) and added arm F. The plan below replaces stages 1 to 3 as first written; the cap, the ledger, the stop rules and the report at the end of every stage stay as they were. Forecasts are stage 0's, from counted tokens.

### Stage 1: P and F, with one run each of K and V as illustration, about US$0.63

Five counted runs each of P and F on the smallest model, the two arms taking turns (P, F, P, F, ...), then one run each of K and V on the smallest model, marked as illustration (`--illustration`, recorded with `outside_verdict: true`). The K and V runs show on the page what the version 1 verdict means in a brief; they decide nothing.

**The verdict rule for F, fixed before the first run.** F keeps the bar if it meets the bar in at least as many of its five runs as P. When F and P meet the bar in the same number of runs, the tie is broken by median briefs matched of 8: F keeps the bar if its median is at least P's. Recall is reported beside it and decides nothing; P and F share the smallest model's base miss rate (0 of 5 alone on the six-file week, `eval/ARMS.md`), which is why the rule reads F against P and not against the bar alone.

**Stop rule:** a run that would take the ledger past US$8 is refused; a run whose measured cost comes in at more than twice its forecast holds the stage after that run, for Megat's word.

**The truncation guard** (Megat, 16 Nov 2026): `max_tokens` stays at 16,000 with no streaming. If a draft call ends on `max_tokens`, the runner records that brief as truncated (`truncated_briefs` in the record, `miss_kind: "truncated"` on its case, kept apart from a model miss), prints it plainly at the end of the run, and holds the stage, so the next run is refused until Megat releases it with `--release-hold`. Found while testing it in the mock (`--mock-truncate`): the structured output parser accepts a cut-off JSON draft as far as it goes, so a truncated brief is submitted as a partial draft and releases a partial page; the record marks it truncated either way.

### Stage 1 result, 16 Nov 2026

Twelve runs on claude-haiku-5-5, the draft call streamed with `max_tokens` 32,000, run by Megat in the order the plan gives. P read the six-file week (`data/cases`); F, K and V read the grown week (`data/cases-grown`). Records in `eval/results-graph/`, one per run; every figure below is taken from them.

| Run | Arm | Briefs matched (of 8) | Claims verified (of 289) | Removed | Bar | Forecast | Measured | Difference |
|---|---|---|---|---|---|---|---|---|
| G20261116161815 | P | 7 | 283 | 2 | missed | US$0.0663 | US$0.0648 | −2.3% |
| G20261116162922 | F | 6 | 288 | 2 | missed | US$0.0688 | US$0.0689 | +0.2% |
| G20261116163844 | P | 6 | 282 | 3 | missed | US$0.0663 | US$0.0671 | +1.2% |
| G20261116164842 | F | 5 | 283 | 4 | missed | US$0.0688 | US$0.0692 | +0.6% |
| G20261116165638 | P | 8 | 289 | 0 | **met** | US$0.0663 | US$0.0652 | −1.7% |
| G20261116170703 | F | 5 | 282 | 4 | missed | US$0.0688 | US$0.0664 | −3.5% |
| G20261116171638 | P | 8 | 289 | 0 | **met** | US$0.0663 | US$0.0679 | +2.5% |
| G20261116200514 | F | 4 | 286 | 2 | missed | US$0.0688 | US$0.0680 | −1.2% |
| G20261116201521 | P | 6 | 219 | 0 | missed | US$0.0663 | US$0.0615 | −7.2% |
| G20261116202332 | F | 8 | 289 | 0 | **met** | US$0.0688 | US$0.0703 | +2.2% |
| G20261116204334 | K (illustration) | 0 | 27 | 1 | missed | US$0.0695 | US$0.0309 | −55.6% |
| G20261116204906 | V (illustration) | 0 | 36 | 2 | missed | US$0.0690 | US$0.0287 | −58.4% |

The twelve runs cost US$0.7290 against a forecast of US$0.8140: P US$0.3265, F US$0.3429, K and V US$0.0596. K and V came in at under half their forecast because they wrote about 4,000 output tokens a brief against P's 14,000: the forecast took P's measured output, and K and V had little they could cite. No brief was truncated: all 96 draft calls ended on `end_turn`, the largest at 18,364 output tokens (F, G20261116200514, 05_inference), above the old cap of 16,000. No run held the stage.

**The verdict, as the rule reads: F does not keep the bar.** F met the bar in 1 of 5 runs and P in 2 of 5. The rule reads bar met first, so the tie-break does not apply; median briefs matched, reported only, is F 5 and P 7.

Beside the verdict, which they do not change:

- F's lines equalled P's in every brief (stage 0), and F's recall was complete in every brief of all five F runs: every miss in F is a drafting miss, none a retrieval miss.
- The two arms' draft requests differ by one line, the list of file names.
- The gap is one run out of five.
- Pooled, the graph met the bar in 3 of 10 runs (P 2, F 1).
- WORK-09's A1 (the agent loop, the same smallest model, the six-file week) met the bar in 0 of 5 runs, briefs matched 6, 7, 6, 4, 5 (`eval/ARMS.md`); P met it in 2 of 5, briefs matched 7, 6, 8, 8, 6.

**Megat's predictions beside the results:**

| Prediction (signed before any paid stage 1 run) | Result |
|---|---|
| P meets the bar in 1 of 5 runs | 2 of 5 |
| F meets the bar in 3 of 5 runs | 1 of 5 |
| In the K and V illustration runs, at least one out-of-date fact from an archived file reaches a released page: yes | No. None of the 36 sentences K and V released cites an archived file. K drafted one and the checker removed it for an unrelated claim (section 8). |

**K and V, illustration.** K released 22 sentences across its eight briefs and V 14, against 46 to 54 a brief in a full page; most sections read "No source this week". Each held 2 of 4 gates: the disagreement and the arithmetic gate failed because their lines were never shown to the drafter. Retrieval misses: K 349, V 339.

**Every removal in P and F, with the checker's reason** (17: P 5, F 12):

| Checker's reason | Sentence | Removals | Runs (brief) |
|---|---|---|---|
| "decision_log.csv line 7 does not hold the number 44" | 09_week44_a.xlsx: 12 rows read, 12 merged. | 4 | P161815 (02), P163844 (04), F164842 (02), F170703 (02) |
| "decision_log.csv line 10 does not hold the number 44" | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | 4 | the same four |
| "unsourced: number 12 (no claim covers it)" | 09_week44_a.xlsx: 12 rows read, 12 merged. | 4 | F162922 (state_a), F164842 (state_a, state_b), F200514 (06) |
| '"Q1" is not a number' | "Open question: can Brightwater Packaging hold the October price into Q1?" | 4 | F162922 (03), P163844 (02), F170703 (state_b), F200514 (01) |
| '"October" is not one date' | the same open question | 1 | F170703 (03) |
| **Empty reference** | none | **0** | none, in any of the 12 runs |

K's one removal and V's two are in section 8 and under the follow-up below. Misses without a removal: the P run under the failure mode below, and state briefs that fail on the clean run's removal rather than their own page (in F200514, state_a has 50 of 50 facts and fails because 01_clean lost the Brightwater sentence; in F164842, F170703 and F200514, state_b fails in part on "the removed list differs between the two runs").

**A failure mode of the one-call draft (G20261116201521-P).** In 05_inference and 06_confidential the draft returned its gate stop and five What moved sentences, and nothing for the other four sections, and ended on `end_turn` at 12,181 and 8,884 output tokens, far under the cap. The draft parsed, so the graph submitted it and the server released a five-sentence page; 39 and 31 expected facts are missing, all 70 of the run's drafting misses, and the checker gives no reason since no sentence for them was submitted. The truncation guard does not catch it, since the call ended normally, and nothing in the graph checks that a draft covers its sections. With one call, a draft that stops early loses the rest of the brief.

**Follow-up, not acted on: the "44" from the file name.** In 8 of the 17 P and F removals, across four runs and both arms, the drafter claimed the 44 inside a file name (`09_week44_a.xlsx`, `10_week44_b.xlsx`) as a number; `decision_log.csv` lines 7 and 10 do not hold it as a number, and the checker removed the sentence. V's two removals and K's archived sentence (its "42") are the same miss. It is a recurring model miss, listed here for a later decision; no instruction is changed now (Megat, 16 Nov 2026).

### Stage 2: forecast against measured, about US$1.91, unchanged

1. **One uncounted E brief**, `--only 01_clean`, in the scratch copy (decision 5), with `--max-calls 120` so the cap cannot end it. It records how many model calls the brief used and what it cost (an upper bound, `cost_is_upper_bound`, since the Node harness writes no trace for one case); it is never counted, and its cost enters the ledger.
2. **`--max-calls` for E's counted run** is set from that brief: twice the calls it used, rounded up to the next ten, and never below 30. The value goes into this note before the counted run.
3. **One counted run each of PG and E** on the smallest model.

**The uncounted E brief, 16 Nov 2026.** It ran twice: `G20261116211827-E-haiku-5-5` and `G20261116212543-E-haiku-5-5`, both 01_clean, both `--max-calls 120`, both recorded `counted: false` and both entered in the ledger.

| Probe | Model calls | Ledger cost (upper bound) | Priced call by call | Forecast | Output tokens | 01_clean |
|---|---|---|---|---|---|---|
| G20261116211827 | 4 | US$0.0667 | US$0.0133 | US$0.1266 | 12,973 | missed, 42 of 48 claims, 2 removed |
| G20261116212543 | 4 | US$0.0612 | US$0.0122 | US$0.1266 | 11,162 | matched, 48 of 48 claims |

- **`--max-calls` for E's counted run: 30.** Both probes used 4 calls; twice that is 8, rounded up to the next ten is 10, and the floor of 30 sets it.
- **The stop rule passes.** Eight times the larger probe cost is US$0.53, which takes the ledger from US$0.9338 to about US$1.47, well under US$8.
- **E read 7 files of 207.** In both probes the agent called `list_sources` once and `read_source` seven times, on the week's own files (`answers.csv`, `brief_previous.md`, `decision_log.csv`, `merged.csv`, `project_note.md`, `supplier_note.md`, `tracker.csv`), and read no archive file. It chose by file name, which arm F is forbidden to do. On this archive every archive file's name starts `archive_`, so the agent loop skips the archive without reading it, and E's brief costs about what it costs on the six-file week; the forecast, which priced every file read, is about ten times the call-by-call cost.
- **The upper bound is wider than it needed to be.** The Node harness does write a trace with `--only`, under `eval/runs-mock/<label>/traces/` of the scratch copy, where the runner does not look; the call-by-call prices above are from those traces and equal the Node harness's own figures. The ledger keeps the upper bound, as accepted in section 7a.

**Stop rule:** if the uncounted E brief's measured cost, times eight, would take the ledger past US$8, the stage stops before the counted runs and reports. **The page shows forecast beside measured for every arm**, per brief and per run, with the difference in per cent.

### Stage 2 result, 16 Nov 2026

Two counted runs on claude-haiku-5-5, run by Megat: PG (`G20261116213400-PG-haiku-5-5`, the graph, every entry of the grown week, draft call streamed with `max_tokens` 32,000) and E (`G20261116214312-E-haiku-5-5`, the Node harness unchanged in the scratch copy, `--max-calls 30`). Both read `data/cases-grown`. Records in `eval/results-graph/`.

| Run | Briefs matched (of 8) | Claims verified (of 289, the six cases) | Removed | Gates held | Bar | Megat's prediction |
|---|---|---|---|---|---|---|
| PG | **7** | 289 | 1 | 4 of 4 | missed (state_b) | 5 of 8 |
| E | **6** | 280 | 3 | 4 of 4 | missed (05_inference, 06_confidential) | 4 of 8 |

Both arms beat Megat's predictions by two briefs. Neither met the bar. One run each: these are single readings, not rates.

**Removals, with the checker's reason:**

| Arm | Brief | Sentence | Checker's reason |
|---|---|---|---|
| PG | state_b | "Open question: can Brightwater Packaging hold the October price into Q1?" | '"Q1" is not a number' |
| E | 05_inference | "The Q3 returns rate was asked for, but no source states it; Returns, Q3 2026: 257 and Orders, Q3 2026: 3,150 are given." | "unsourced: number 2026 (no claim covers it)" |
| E | 06_confidential | 09_week44_a.xlsx: 12 rows read, 12 merged. | "decision_log.csv line 7 does not hold the number 44" |
| E | 06_confidential | 10_week44_b.xlsx: 14 rows read, 13 merged, 1 held. | "decision_log.csv line 10 does not hold the number 44" |
| **Empty reference** | none | | PG's record lists none; E's three reasons above are its only removals |

PG's state_b also fails on what follows from its own removal: "a sentence in the first run and not the second" and "the removed list differs between the two runs". E's two "44" removals are the follow-up recorded under stage 1, now seen in the Node harness with SKILL.md unchanged as well as in the graph.

**PG: archived files on the page.** PG showed the drafter every line of the grown week, 1,707 to 1,716 entries a brief, and its recall was complete in every brief. It released 151 sentences across the eight briefs; **none cites an archived file**, and no claim in any `claims.csv` names an archive reference, so the checker had no archived sentence to pass or remove.

**E: the files it read.** In every brief E called `list_sources` once and `read_source` on the week's own files only, and **read no archive file in any brief**:

| Brief | Model calls | Files read |
|---|---|---|
| 01_clean, 03_change, state_b | 4 | `answers.csv`, `brief_previous.md`, `decision_log.csv`, `merged.csv`, `project_note.md`, `supplier_note.md`, `tracker.csv` (7) |
| 02_disagreement, 04_gap, 05_inference | 5 (one more for `stop`) | the same 7 |
| 06_confidential | 4 | the same less `supplier_note.md`, declined (6) |
| state_a | 4 | the same 7 and `risk_note.md` (8) |

35 model calls in all, under the cap of 30 a brief. E skipped the archive by its file names (section 8).

**Forecast beside measured, PG and E:**

| Arm | Forecast a run | Measured | Difference | Per brief, forecast | Per brief, measured |
|---|---|---|---|---|---|
| PG | US$0.8427 | US$0.8993 | +6.7% | US$0.1052 to US$0.1054 | US$0.1059 (06) to US$0.1274 (05), +0.6% to +20.8% |
| E | US$1.0126 | US$0.0934 | −90.8% | US$0.1264 to US$0.1268 | US$0.0107 (06) to US$0.0129 (05), about −90% each |

PG's input is about 141,000 tokens a brief, past Haiku's 100,000-token line, so every input token is at the upper tier; it ran over where the brief needed more output (05_inference 22,728 tokens, state_a 20,326, against the 13,957 the forecast took). E's forecast priced every one of 207 files read; E read 7.

**Cost and seconds a brief, every arm, the smallest model** (P and F the mean of five counted runs, the others one run):

| Arm | Folder | Cost a brief | Seconds a brief | of which: index | of which: draft (model) | rest (reads, tools) |
|---|---|---|---|---|---|---|
| P | six-file week | US$0.0082 | 51.7 | none | 51.5 | 0.2 |
| F | grown | US$0.0086 | 51.4 | 0.004 (week read from content) | 51.2 | 0.2 |
| K | grown | US$0.0039 | 19.2 | 0.018 (BM25) | 18.9 | 0.3 |
| V | grown | US$0.0036 | 46.0 | 27.8 (embedding about 1,710 entries) | 17.8 | 0.4 |
| PG | grown | US$0.1124 | 63.8 | none | 63.5 | 0.3 |
| E | grown | US$0.0117 | 46.4 | none | not split (agent loop, 4 to 5 calls) | |

E's seconds are the Node harness's own figure for the whole brief. V's index is rebuilt for each brief; K's and V's draft calls are short because they had little to cite.

**Ledger after stage 2:** US$1.926507 of the US$8 cap (`eval/results-graph/spend.json`): stage 1 US$0.8059, the two uncounted E probes US$0.1279 (upper bounds), PG US$0.8993, E US$0.0934. No hold is set.

### Stage 3: dropped

Stage 3 ran K and V on the largest model only if stage 1 left the K-against-V verdict open. Stage 0 closed it: at 20 lines a section K and V leave 18 to 22 expected references a brief unshown, and no model can cite a line it is never shown, so the largest model could only measure the same retrieval misses at forty times the price. F's question is answered on the smallest model against P.

### The forecast, all stages (stage 0's counts)

| Stage | Runs | Forecast | Ledger after the stage |
|---|---|---|---|
| 0 | 128 token counts (80, 8 for F, 40 after the schema change) | US$0 | US$0 |
| 1 | measured: the grammar probe (US$0.0013), the first P run under the 16,000 cap (US$0.0663, not counted), the 05_inference test brief (US$0.0093, not counted), and the twelve runs (US$0.7290 against US$0.8140 forecast) | US$0.81 forecast, US$0.73 measured | US$0.81 (measured) |
| 2 | measured: the uncounted E brief, run twice (US$0.0667 and US$0.0612, upper bounds), PG (US$0.8993) and E (US$0.0934) once each | US$1.98 forecast, US$1.12 measured | US$1.93 (measured) |
| 3 | dropped | US$0 | US$1.93 |

The graph arms' forecasts now take the measured output of the first P run (median 13,957 tokens a brief, a floor, since two of its briefs stopped at 16,000) in place of WORK-09's 9,692, which summed several calls; each rose by about a third (PG by 11 per cent, its input being most of its cost). E keeps WORK-09's A1 median, being the same agent loop. Input counts are from the recount after the flat schema and predate the one sentence added to `graph/draft_step.md` (well under one per cent). After stage 2 the ledger stands at US$1.926507 (`eval/results-graph/spend.json`), with no hold set; US$6.07 of the US$8 cap is left.

## 7. Session 2, once this note is approved

The grown week's generator (decision 15) and its proof, the index, the graph, the runner with its spend ledger and its stage 0 counting and forecast, `graph/check_case.mjs`, the mock (a scripted drafter that returns the expected sentences and stops, as `eval/mock.js` does), the README section. The mock carries the proofs this note asks for: one server process per brief and its environment (decision 7, one attempt at `MCPAdapter`), no graph node or run folder reaching `eval/expected/`, and the same `cache_control` on every call of every arm (section 4). Session 2 stops before any API call, token counting included, before any model download, and before `uv sync`, each of which waits for Megat's word. Session 3 runs the stages in section 6 and stops at the end of each.

## 7a. Found in session 2 (the build)

- **The index is built inside the graph.** The `sources` node reads every readable file (after `set_case`, so every read line carries the case id) and the `retrieve` node builds the index from those reads, timed as `index_seconds`; the note had the index built before the graph.
- **The 5-minute cache across briefs.** With top-level `cache_control` and no breakpoint of its own, each graph call would write its whole prompt to the cache at its end; a later brief's call shares only the instructions with it and no cache entry ends there, so nothing would be read back and every input token would pay the cache-write price. On this finding Megat changed the rule in section 4: the graph arms send no `cache_control`, E keeps the Node harness's caching, and a graph call's input is priced as fresh input at its tier.
- **Arm E's cap inside a run.** The Node harness runs its eight briefs in one process, so the ledger can refuse an E run before it starts (forecast) and can hold the stage after it, but it cannot stop E after the brief on which the ledger passes US$8.00. The stage 2 probe brief's rule (its cost times eight) is the guard. Megat, 16 Nov 2026: the check before the run and the probe-brief rule are enough; E is not run one brief at a time.
- **The stage 2 probe brief's cost is an upper bound.** With `--only`, the Node harness writes no trace, so its calls cannot be priced one by one; the runner prices every token of the probe at Haiku's upper tier and marks the record `cost_is_upper_bound`. Megat, 16 Nov 2026: accepted; it overstates, the safe direction for a cap.
- **The Node mock and the call cap.** `eval/mock.js` makes one tool call a model call, so E's mock needs `--max-calls 300` to read 207 files; the default of 30 ends the run uncounted on the first brief, which is the hazard in section 3, item 9, seen in the mock.
- **Mock runs write a scratch ledger** in their own folder under `graph/runs-mock/`, never `eval/results-graph/spend.json`, since mock runs are never recorded.
- **`eval/GRAPH.md` is not built in this session;** it is session 4's page, from the records.
- **Stage 1's first attempt: the grammar limit.** On 16 Nov 2026 every stage 1 run that started (P three times, F twice, K and V; records `eval/results-graph/G2026111615*.json`, kept and marked `counted: false`) was refused on its first draft call with `400 invalid_request_error: The compiled grammar is too large, which would cause performance issues.` The API compiles the `output_config.format` schema into a grammar, and the first schema (the sentence shape copied five times, once a section, each claim a choice of two shapes) was too large. Neither check before it could see this: the mock's stand-in accepts any schema, and the token counting endpoint counts a request without compiling its grammar; only a real request compiles it. No page was released and nothing was spent. Five more commands were refused at once because run labels went only to the minute, so a second run of an arm within the same minute found its folder taken. **The fix:** one flat list of sentences, each naming its section, and one claim shape with all eight fields as strings (empty where its kind uses none), 1,302 characters of schema against 4,748; the node turns the reply back into the five sections `draft_brief` takes, and the mock shows the payload the server receives is identical to the one before in every brief. Run labels now carry seconds. Only `graph/draft_step.md` step 5 changed in the drafter's instructions; the copied SKILL.md sections are unchanged. One real draft request (01_clean, arm P, the smallest model, `max_tokens` 1) then probes the new grammar before stage 1 runs again.
- **Stage 1's first P run: the output cap** (`G20261116154635-P-haiku-5-5`, kept, marked `counted: false`, "run under the 16,000 cap, changed before the stage"). Two of its eight briefs (05_inference, state_a) ended on `max_tokens` at 16,000 output tokens and released partial pages, and 01_clean used 14,327; the truncation guard held stage 1 and refused the runs after it. The one-call design carries the model's thinking and the whole draft under one output limit, where the agent loop spread the same work over several calls, each with its own limit; WORK-09's median of 9,692 output tokens a brief was a sum over calls and understated what one call needs. **The fix** (Megat, 16 Nov 2026): the draft call streams, with `max_tokens` 32,000; the request body changes only in those two keys. The truncation hold stays: at 32,000 a cut-off brief would mean something else is wrong. One line was added to `graph/draft_step.md`, that every claim carries its reference, `change` claims by `new_ref` and `old_ref`, after one removal in that run came from a claim with an empty `ref`, which the flat claim shape allows; removals for an empty reference are reported in their own row.
- **Stage 0's first attempt stopped before any token count.** `graph/check_case.mjs --recall` called `process.exit` straight after writing more than 64 KB to a pipe, and Node cut the output; the runner could not parse it. The script now ends on its own, and stage 0 ran again in full (S0202611161338). Recall is deterministic; the queries, the tokenizer and k did not change between the two.

## Megat's predictions

Written 16 Nov 2026, before stage 0 ran and before any recall was measured.

At 20 lines a section, keyword search (K) finds every expected reference in 4 of 8 briefs, and vector search (V) in 3 of 8.

Signed: Megat

Written 16 Nov 2026, before arm F's recall was measured:

F finds every expected reference in 6 of 8 briefs.

Signed: Megat

Written 16 Nov 2026, before any paid run of stage 1:

- P meets the bar in 1 of 5 runs.
- F meets the bar in 3 of 5 runs.
- In the K and V illustration runs, at least one out-of-date fact from an archived file reaches a released page: yes.

Signed: Megat

Written 16 Nov 2026, after stage 1 and before any stage 2 run:

- PG matches 5 of 8 briefs.
- E matches 4 of 8 briefs.

Signed: Megat

## 8. Limits found while writing this note

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
