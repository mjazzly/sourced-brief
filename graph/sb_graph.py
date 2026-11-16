"""WORK-10: the LangGraph state graph that writes one brief.

  sources       set_case, list_sources, then read_source on every readable file (what was read and
                what was declined go into the state)
  retrieve      builds the index from those reads (one entry per line or row) and picks the lines:
                every entry (arms P and PG), the top k for each section's fixed query (K, V), or
                every entry from files of this week and the week before, by each file's week as
                read from its content (F, added after stage 0's finding)
  draft         one model call: the drafter's instructions, the compact sources list, the lines;
                returns sections and stops
  record_stops  the server's stop tool, once per stop the draft returned
  wait          on a disagreement with a fixed answer, interrupt(); the runner resumes with
                Command(resume=<eval/answers.txt line>). The answer is recorded and changes nothing.
  submit        draft_brief once
  record        the brief's part of the trace

The tool call and the pause sit in two nodes because on resume LangGraph runs the interrupted node
again from its start: a stop recorded in the same node would be logged twice. One server process
and one MCP session serve every node; they, the model and the reads live in the run context, not in
the checkpointed state. Compiled with InMemorySaver, one thread_id per brief.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langgraph.types import interrupt

import queries as Q
import sb_draft
import sb_index


class State(TypedDict, total=False):
    case_id: str
    arm: str
    k: int | None
    has_fixed_answer: bool
    week_ending: str
    latest_run: str
    files: list[str]
    read: list[str]
    declined: list[str]
    index_entries: int
    index_seconds: float
    queries: dict
    retrieved_by_section: dict
    lines: list[str]
    file_weeks: dict | None
    draft: dict | None
    draft_error: str | None
    model_call: dict
    stops_recorded: list
    answer: str | None
    submitted: bool
    submit_result: dict | None
    draft_brief_payload: dict | None
    steps: list


@dataclass
class Ctx:
    server: Any                      # sb_mcp.ToolServer, held open for the brief
    model: Any                       # sb_draft.make_model(...)
    system: str                      # the drafter's instructions
    reads: list = field(default_factory=list)
    entries: list = field(default_factory=list)
    lines: list = field(default_factory=list)


def _step(state: State, **s) -> list:
    return [*state.get("steps", []), {"n": len(state.get("steps", [])) + 1, **s}]


async def sources(state: State, runtime: Runtime[Ctx]) -> dict:
    srv, t0 = runtime.context.server, time.perf_counter()
    await srv.call_json("set_case", {"case_id": state["case_id"]})
    src = await srv.call_json("list_sources", {})
    reads = []
    for s in src["sources"]:
        if s["status"] == "READABLE":
            reads.append(await srv.call_json("read_source", {"file": s["file"]}))
    runtime.context.reads = reads
    runtime.context.list_sources = src
    declined = [s["file"] for s in src["sources"] if s["status"] == "DECLINED"]
    return {"week_ending": src["week_ending"], "latest_run": src["latest_tracker_run"], "files": [s["file"] for s in src["sources"]],
            "read": [r["file"] for r in reads], "declined": declined,
            "steps": _step(state, node="sources", tool_calls=2 + len(reads), seconds=round(time.perf_counter() - t0, 2))}


async def retrieve(state: State, runtime: Runtime[Ctx]) -> dict:
    ctx, t0 = runtime.context, time.perf_counter()
    entries = sb_index.entries_from_reads(ctx.reads)
    ctx.entries = entries
    weeks = None
    if state["arm"] in ("P", "PG"):
        lines, by_section, qs, idx_s = sb_index.in_file_order(entries), None, None, 0.0
    elif state["arm"] == "F":
        w, bad = sb_index.weeks_of(ctx.reads)
        if bad:
            raise RuntimeError(f"arm F cannot read the week of {bad}; it never falls back on a file name")
        weeks = {f: list(v) for f, v in w.items()}
        lines, by_section, qs = sb_index.by_week(entries, w, state["week_ending"]), None, None
        idx_s = time.perf_counter() - t0
    else:
        r = sb_index.Keyword(entries) if state["arm"] == "K" else sb_index.Vector(entries)
        qs = Q.fill(state["week_ending"], state["latest_run"])
        lines, by_section = sb_index.retrieve(r, qs, state["k"])
        idx_s = r.seconds
    ctx.lines = lines
    return {"index_entries": len(entries), "index_seconds": round(idx_s, 3), "queries": qs, "retrieved_by_section": by_section, "file_weeks": weeks,
            "lines": [e["ref"] for e in lines], "steps": _step(state, node="retrieve", entries=len(entries), lines=len(lines), seconds=round(time.perf_counter() - t0, 2))}


async def draft(state: State, runtime: Runtime[Ctx]) -> dict:
    ctx, t0 = runtime.context, time.perf_counter()
    msgs = [{"role": "system", "content": ctx.system}, *sb_draft.messages(ctx.list_sources, ctx.lines)]
    out = await ctx.model.ainvoke(msgs)
    raw = out["raw"]
    u = getattr(raw, "usage_metadata", None) or {}
    d = (u.get("input_token_details") or {})
    cache_read = d.get("cache_read") or 0
    cache_write = (d.get("cache_creation") or 0) + (d.get("ephemeral_5m_input_tokens") or 0) + (d.get("ephemeral_1h_input_tokens") or 0)
    total_in = u.get("input_tokens") or 0
    call = {"tokens": {"in": total_in, "fresh": total_in - cache_read - cache_write, "cache_read": cache_read, "cache_write": cache_write, "out": u.get("output_tokens") or 0},
            "stop_reason": (raw.response_metadata or {}).get("stop_reason"), "model": (raw.response_metadata or {}).get("model") or (raw.response_metadata or {}).get("model_name"),
            "seconds": round(time.perf_counter() - t0, 2)}
    parsed, err = out.get("parsed"), out.get("parsing_error")
    return {"draft": parsed, "draft_error": None if parsed else str(err or "no parsed output"), "model_call": call,
            "steps": _step(state, node="draft", **call, parsed=parsed is not None)}


async def record_stops(state: State, runtime: Runtime[Ctx]) -> dict:
    srv, rec = runtime.context.server, []
    for s in (state.get("draft") or {}).get("stops", []):
        text, err = await srv.call("stop", {"reason": s["reason"], "text": s["text"]})
        rec.append({"reason": s["reason"], "text": s["text"], "is_error": err, "result": text[:500]})
    return {"stops_recorded": rec, "steps": _step(state, node="record_stops", stops=len(rec))}


async def wait(state: State) -> dict:
    disagreement = any(s["reason"] == "disagreement" for s in state.get("stops_recorded", []))
    if not (disagreement and state.get("has_fixed_answer")):
        return {"answer": None, "steps": _step(state, node="wait", paused=False)}
    answer = interrupt({"case_id": state["case_id"], "stop": "disagreement", "ask": "The draft found a disagreement. Your answer?"})
    return {"answer": answer, "steps": _step(state, node="wait", paused=True, answer=answer)}


async def submit(state: State, runtime: Runtime[Ctx]) -> dict:
    d = state.get("draft")
    if not d:
        return {"submitted": False, "submit_result": None, "steps": _step(state, node="submit", submitted=False, reason=state.get("draft_error"))}
    payload = {"sections": sb_draft.to_sections(d)}
    text, err = await runtime.context.server.call("draft_brief", payload)
    res = None if err else json.loads(text)
    if res:
        res = {k: v for k, v in res.items() if k != "page"}
    return {"submitted": not err, "submit_result": res if res else {"error": text[:2000]}, "draft_brief_payload": payload,
            "steps": _step(state, node="submit", submitted=not err, released=(res or {}).get("sentences_released"), removed=(res or {}).get("sentences_removed"))}


async def record(state: State) -> dict:
    return {"steps": _step(state, node="record")}


def build():
    g = StateGraph(State, context_schema=Ctx)
    for name, fn in [("sources", sources), ("retrieve", retrieve), ("draft", draft), ("record_stops", record_stops), ("wait", wait), ("submit", submit), ("record", record)]:
        g.add_node(name, fn)
    order = ["sources", "retrieve", "draft", "record_stops", "wait", "submit", "record"]
    g.add_edge(START, order[0])
    for a, b in zip(order, order[1:]):
        g.add_edge(a, b)
    g.add_edge(order[-1], END)
    return g.compile(checkpointer=InMemorySaver())
