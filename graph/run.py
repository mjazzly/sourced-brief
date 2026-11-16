"""WORK-10: the runner. One command, eight briefs, blind, recorded; mirrors eval/run_eval.js.

  uv run run.py --arm P|PG|K|V --model claude-haiku-5-5 --stage 1 [--effort high]
  uv run run.py --arm E --model claude-haiku-5-5 --stage 2 --max-calls <n> [--only 01_clean]
  uv run run.py --arm P|PG|K|V|E --mock           (no API call; a local stand-in; never recorded)
  uv run run.py stage0 [--count]                  (recall and the captured requests; --count adds the
                                                   token counts and the forecast, which call the API)

Arms (WORK-10-DESIGN.md section 4): P the graph reading every entry of data/cases; PG every entry of
data/cases-grown; K and V the top k lines a section of the grown week by BM25 or by vector; E the
Node harness as it stands, run in a scratch copy of the repo whose data/cases is data/cases-grown.

Every paid call is priced from graph/prices.json at its own tier and entered in the spend ledger,
eval/results-graph/spend.json, with a US$8.00 cap (section 6). The case check is node
graph/check_case.mjs, the one checker; this process never opens eval/expected/, and records every
file it opens to prove it.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import shutil
import statistics
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

# ---------- every file this process opens, recorded before anything else is imported ----------
OPENED: list[str] = []
_EXPECTED = str(ROOT / "eval" / "expected")


def _audit(event, args):
    if event in ("open", "os.listdir", "os.scandir") and args and isinstance(args[0], (str, bytes, os.PathLike)):
        p = os.fsdecode(args[0])
        if _EXPECTED in os.path.abspath(p):
            OPENED.append(p)


sys.addaudithook(_audit)

import queries as Q  # noqa: E402
import sb_draft  # noqa: E402
import sb_index  # noqa: E402
from sb_mcp import ToolServer  # noqa: E402

CASES = ROOT / "data" / "cases"
GROWN = ROOT / "data" / "cases-grown"
RESULTS = ROOT / "eval" / "results-graph"
LEDGER = RESULTS / "spend.json"
FORECAST = RESULTS / "forecast.json"
CAP_USD = 8.00
K_PAID = 20                                  # decision 6b, fixed for every paid run
K_RECALL = [5, 10, 20, 40]
ARMS = ["P", "PG", "K", "V", "E", "F"]   # F: filter by week, added after stage 0's finding
SMALLEST, LARGEST = "claude-haiku-5-5", "claude-opus-5-5"
PRICES = json.loads((HERE / "prices.json").read_text())
ROUTE = json.loads((HERE / "route.json").read_text())["route"] if (HERE / "route.json").exists() else "adapter"

# the eight briefs, in the Node harness's order: six cases, State B (the clean week again), State A
BRIEFS = [("01_clean", "01_clean"), ("02_disagreement", "02_disagreement"), ("03_change", "03_change"), ("04_gap", "04_gap"),
          ("05_inference", "05_inference"), ("06_confidential", "06_confidential"), ("state_b", "01_clean"), ("state_a", "state_a")]
ANSWERS = dict(l.split("=", 1) for l in (ROOT / "eval" / "answers.txt").read_text().splitlines() if "=" in l)


def now_local() -> datetime:
    return datetime.now()


def sha(p: Path | str, n: int = 12) -> str:
    b = Path(p).read_bytes() if isinstance(p, Path) else p.encode()
    return hashlib.sha256(b).hexdigest()[:n]


def model_tag(model: str) -> str:
    return model.replace("claude-", "")


# ---------- prices ----------
def call_cost(model: str, fresh: int, cache_write: int, cache_read: int, out: int) -> float | None:
    p = PRICES.get(model)
    if not p:
        return None
    prompt = fresh + cache_write + cache_read
    t = next(t for t in p["tiers"] if t["max_prompt_tokens"] is None or prompt <= t["max_prompt_tokens"])
    return (fresh * t["input"] + cache_write * t["cache_write_5m"] + cache_read * t["cache_read"] + out * t["output"]) / 1e6


# ---------- the spend ledger ----------
class Ledger:
    def __init__(self, path: Path, cap: float = CAP_USD):
        self.path, self.cap = path, cap
        self.data = json.loads(path.read_text()) if path.exists() else {"cap_usd": cap, "total_usd": 0.0, "entries": [], "holds": []}

    @property
    def total(self) -> float:
        return round(sum(e["cost_usd"] for e in self.data["entries"]), 6)

    def save(self):
        self.data["total_usd"] = self.total
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2) + "\n")

    def refuse(self, label: str, stage, forecast: float | None, ignore_holds: bool = False) -> str | None:
        """A reason to refuse the run, or None."""
        for h in ([] if ignore_holds else self.data["holds"]):
            if h["stage"] == stage and not h.get("released"):
                return f"stage {stage} is held: {h['why']}. Megat releases it with --release-hold."
        if forecast is None:
            return "no forecast for this arm and model; run stage 0 with --count first"
        if self.total + forecast > self.cap:
            return f"the ledger (US${self.total:.4f}) plus this run's forecast (US${forecast:.4f}) passes the US${self.cap:.2f} cap"
        return None

    def add(self, label: str, stage, kind: str, cost: float, calls: int, note: str = ""):
        self.data["entries"].append({"label": label, "stage": stage, "kind": kind, "cost_usd": round(cost, 6), "model_calls": calls, "at": now_local().isoformat(timespec="seconds"), "note": note})
        self.save()

    def hold(self, stage, why: str):
        self.data["holds"].append({"stage": stage, "why": why, "at": now_local().isoformat(timespec="seconds")})
        self.save()

    def release(self, stage):
        for h in self.data["holds"]:
            if h["stage"] == stage:
                h["released"] = now_local().isoformat(timespec="seconds")
        self.save()


# ---------- the stand-in model server (mock and capture) ----------
class StandIn:
    def __init__(self, mode: str, record: Path, truncate: str | None = None):
        self.mode, self.record, self.truncate = mode, record, truncate

    def __enter__(self):
        cmd = [sys.executable, "-I", str(HERE / "mock_model.py"), "--mode", self.mode, "--record", str(self.record)] + (["--truncate", self.truncate] if self.truncate else [])
        self.p = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
        line = self.p.stdout.readline().strip()
        self.port = int(line.split()[1])
        self.url = f"http://127.0.0.1:{self.port}"
        return self

    def case(self, case_id: str):
        import urllib.request
        urllib.request.urlopen(urllib.request.Request(f"{self.url}/mock/case", data=json.dumps({"case": case_id}).encode(), headers={"content-type": "application/json"}, method="POST")).read()

    def __exit__(self, *exc):
        self.p.terminate()
        self.p.wait(timeout=10)


# ---------- one brief through the graph ----------
async def run_brief(graph, case_id: str, folder: Path, run_dir: Path, run_id: str, arm: str, model, route: str, label: str) -> dict:
    from langgraph.types import Command
    import sb_graph
    data = run_dir / case_id
    data.mkdir(parents=True)
    for f in sorted(folder.iterdir()):
        shutil.copyfile(f, data / f.name)
    system, _ = sb_draft.instructions()
    t0 = time.perf_counter()
    async with ToolServer(data, run_id, route) as srv:
        ctx = sb_graph.Ctx(server=srv, model=model, system=system)
        cfg = {"configurable": {"thread_id": f"{label}-{case_id}"}}
        init = {"case_id": case_id, "arm": arm, "k": K_PAID if arm in ("K", "V") else None, "has_fixed_answer": case_id in ANSWERS, "steps": []}
        out = await graph.ainvoke(init, cfg, context=ctx)
        paused = bool(out.get("__interrupt__"))
        if paused:
            out = await graph.ainvoke(Command(resume=ANSWERS[case_id]), cfg, context=ctx)
        tool_calls = srv.calls
    out = {k: v for k, v in out.items() if k != "__interrupt__"}
    out.update({"seconds": round(time.perf_counter() - t0, 2), "paused": paused, "tool_calls": tool_calls, "data_dir": str(data)})
    return out


def check_run(run_dir: Path, seen: dict | None, only: str | None = None) -> dict:
    cmd = ["node", str(HERE / "check_case.mjs"), str(run_dir)]
    if only:
        cmd += ["--only", only]
    if seen is not None:
        sp = run_dir / "retrieved.json"
        sp.write_text(json.dumps(seen))
        cmd += ["--retrieved", str(sp)]
    return json.loads(subprocess.run(cmd, check=True, capture_output=True, text=True).stdout)


def framework_version() -> dict:
    from importlib.metadata import version
    lock = HERE / "uv.lock"
    return {p: version(p) for p in ["langgraph", "langchain", "langchain-core", "langchain-anthropic", "anthropic", "mcp", "fastmcp", "bm25s", "fastembed"]} | {"uv_lock_sha": sha(lock) if lock.exists() else None, "python": sys.version.split()[0]}


def api_key() -> str:
    if os.environ.get("ANTHROPIC_API_KEY"):
        return os.environ["ANTHROPIC_API_KEY"]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith("ANTHROPIC_API_KEY"):
                return line.split("=", 1)[1].strip().strip('"')
    sys.exit("No API key. Put ANTHROPIC_API_KEY=... in .env in the repo root, or set it in the environment.")


# ---------- a graph arm: P, PG, K, V ----------
async def graph_arm(a) -> int:
    import sb_graph
    mock = a.mock
    stamp = now_local().strftime("%Y%m%d%H%M%S")
    run_id = f"G{stamp}"
    label = a.label or f"{run_id}-{a.arm}-{'mock' if mock else model_tag(a.model)}{'-' + a.effort if a.effort else ''}"
    run_dir = (HERE / ("runs-mock" if mock or a.only else "runs") / label)
    if run_dir.exists():
        sys.exit(f"{run_dir} exists; pass --label or wait a minute")
    run_dir.mkdir(parents=True)
    base = CASES if a.arm == "P" else GROWN
    todo = [b for b in BRIEFS if not a.only or b[0] == a.only]
    ledger = Ledger(run_dir / "spend.json" if mock else LEDGER)
    forecast = None
    if not mock:
        fc = json.loads(FORECAST.read_text()) if FORECAST.exists() else {}
        per = fc.get("per_brief_usd", {}).get(a.arm, {}).get(f"{a.model}{'-' + a.effort if a.effort else ''}")
        forecast = None if per is None else sum(per.get(c, 0) for c, _ in todo)
        if a.release_hold:
            ledger.release(a.stage)
        why = ledger.refuse(label, a.stage, forecast, ignore_holds=a.test_brief)
        if why:
            print(f"refused: {why}")
            return 2
        if a.test_brief:
            print(f"a test brief on Megat's word: the stage {a.stage} hold is not lifted, and the cap still applies")
    print(f"run {label}: arm {a.arm}, {'mock stand-in' if mock else a.model}{', effort ' + a.effort if a.effort else ''}, route {a.route}, {len(todo)} briefs, folder {base.relative_to(ROOT)}")
    graph = sb_graph.build()
    results, cost, completed, error, over_cap = {}, 0.0, True, None, False
    record_dir = run_dir / "requests"
    standin = StandIn("mock", record_dir, truncate=a.mock_truncate) if mock else None
    truncated = []   # briefs whose draft call ended on max_tokens: kept apart from a model miss
    try:
        if standin:
            standin.__enter__()
        model = sb_draft.make_model(a.model if not mock else SMALLEST, a.effort, base_url=standin.url if mock else None, api_key="mock-no-key" if mock else api_key())
        for case_id, folder in todo:
            if standin:
                standin.case(case_id)
            r = await run_brief(graph, case_id, base / folder, run_dir, run_id, a.arm, model, a.route, label)
            t = r["model_call"]["tokens"]
            c = 0.0 if mock else call_cost(a.model, t["fresh"], t["cache_write"], t["cache_read"], t["out"]) or 0.0
            r["cost_usd"] = round(c, 6)
            results[case_id] = r
            cost += c
            if r["model_call"].get("stop_reason") == "max_tokens":
                r["truncated"] = True
                truncated.append(case_id)
                print(f"  {case_id:16} TRUNCATED: the draft call ended on max_tokens ({sb_draft.MAX_TOKENS}); {t['out']} output tokens")
            sr = r.get("submit_result") or {}
            print(f"  {case_id:16} {'released' if r.get('submitted') else 'NOT RELEASED'}, {sr.get('sentences_removed', '?')} removed; {r['index_entries']} entries, {len(r['lines'])} lines; "
                  f"{t['in']} in, {t['out']} out; US${c:.4f}; {r['seconds']} s{'; paused and resumed' if r['paused'] else ''}")
            if not mock:
                ledger.add(label, a.stage, "brief", c, 1, case_id)
                if ledger.total > CAP_USD:
                    over_cap, completed, error = True, False, f"the ledger passed US${CAP_USD:.2f} after {case_id}"
                    print(f"  stopped: {error}")
                    break
    except Exception as e:  # a failed brief ends the run uncounted, as in the Node harness
        completed, error = False, f"{type(e).__name__}: {e}"
        print(f"run did not finish: {error}")
    finally:
        if standin:
            standin.__exit__()
    seen = {c: r["lines"] for c, r in results.items()}
    checked = check_run(run_dir, seen, a.only)
    v = checked["verdict"]
    for cid in truncated:
        checked["cases"][cid]["miss_kind"] = "truncated"   # not a model miss: the call hit max_tokens
    for c in checked["cases"].values():
        print(f"{'MATCH' if c['match'] else 'TRUNC' if c.get('miss_kind') == 'truncated' else 'MISS '} {c['name']}{' (%d of %d facts)' % (c['facts_found'], c['facts_total']) if c['facts_total'] else ''}" + ("".join(f"\n        {f}" for f in c["fails"])))
    print(f"\n{v['cases_matched']} of {v['of_cases']} cases, state {v['state_matched']} of {v['of_state']}, {v['claims_verified']} of {v['of_claims']} claims verified, "
          f"{v['unsourced_caught']} removed, {v['gates_held']} of {v['of_gates']} gates held: {'BAR MET' if v['passed'] else 'BAR NOT MET'}")
    if a.arm in ("K", "V"):
        print(f"retrieval misses {len(checked['retrieval_misses'])}, drafting misses {len(checked['drafting_misses'])}")
    rec = build_record(a, label, run_id, stamp, results, checked, cost, completed and not a.only, error, forecast, mock)
    rec["truncated_briefs"] = truncated
    if truncated:
        print(f"\nTRUNCATED: {len(truncated)} brief{'s' if len(truncated) != 1 else ''} ended on max_tokens ({sb_draft.MAX_TOKENS}) and released no page from a whole draft: {', '.join(truncated)}. "
              f"Recorded as truncated, apart from model misses. Stage {a.stage} is held: the next run is refused until Megat releases it with --release-hold.")
        ledger.hold(a.stage, f"{label}: {len(truncated)} brief(s) ended on max_tokens: {', '.join(truncated)}")
    if mock:
        pdir = run_dir / "payloads"   # the draft_brief payload of every brief, as the server received it
        pdir.mkdir(exist_ok=True)
        for c, r in results.items():
            (pdir / f"{c}.json").write_text(json.dumps(r.get("draft_brief_payload"), indent=2) + "\n")
        report = mock_checks(a, run_dir, results, checked, record_dir)
        if a.mock_truncate:
            nxt = ledger.refuse("next", a.stage, 0.01)
            ok = truncated == [a.mock_truncate] and checked["cases"][a.mock_truncate].get("miss_kind") == "truncated" and bool(nxt)
            report["9 truncation guard"] = {"ok": ok, "detail": [f"briefs recorded truncated: {truncated}; miss kind {checked['cases'].get(a.mock_truncate, {}).get('miss_kind')}; the next run refused: {nxt}"]}
        report["8 stage 0 counts this request"] = await stage0_same_request(a, todo[0], base, run_dir, record_dir)
        rec["mock_checks"] = report
        (run_dir / "mock_report.json").write_text(json.dumps(report, indent=2) + "\n")
        (run_dir / "result.json").write_text(json.dumps(rec, indent=2) + "\n")
        print_mock(report)
        return 0 if all(x["ok"] for x in report.values()) else 1
    write_record(rec, results, label)
    if forecast and cost > 2 * forecast:
        ledger.hold(a.stage, f"{label} cost US${cost:.4f}, more than twice its forecast US${forecast:.4f}")
        print(f"stage {a.stage} held: measured cost is more than twice the forecast")
    print(f"recorded {RESULTS / (label + '.json')}; counted {rec['counted']}; ledger US${ledger.total:.4f} of US${CAP_USD:.2f}")
    return 0


def build_record(a, label, run_id, stamp, results, checked, cost, completed, error, forecast, mock) -> dict:
    system, version = sb_draft.instructions()
    tok = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
    for r in results.values():
        t = r["model_call"]["tokens"]
        tok["input"] += t["fresh"]; tok["output"] += t["out"]; tok["cache_read"] += t["cache_read"]; tok["cache_write"] += t["cache_write"]
    n = len(results) or 1
    secs = {c: r["seconds"] for c, r in results.items()}
    removed = [{"case": c, **x, "empty_reference": any('reference "" is not' in y for y in x.get("reasons", []))} for c, r in results.items() for x in (r.get("submit_result") or {}).get("removed", [])]
    return {
        "label": label, "run_id": run_id, "date": stamp[:8], "started_at": stamp, "mode": "mock" if mock else "one case" if a.only else "harness", "blind": True,
        "counted": bool(not mock and completed and not a.only), "skill_version": version, "server_version": json.loads((ROOT / "package.json").read_text())["version"],
        "model": "mock (scripted, no model)" if mock else a.model, "effort": a.effort, "briefs": len(results), "model_calls": len(results),
        "tokens": tok, "total_input": tok["input"] + tok["cache_read"] + tok["cache_write"], "cost_usd": round(cost, 6), "cost_per_brief_usd": round(cost / n, 6),
        "cache": False, "completed": completed, "error": error, "verdict": checked["verdict"], "cases": checked["cases"],
        "work": "WORK-10", "arm": a.arm, "arm_name": a.arm, "drafter_model": None if mock else a.model, "reviewer_model": None, "checklist_sha": None, "reviewer_sha": None,
        "max_calls": 1, "reviewer_max_calls": None, "by_agent": {"drafter": {"model_calls": len(results), "tokens_in": sum(r["model_call"]["tokens"]["in"] for r in results.values()),
                                                                          "tokens_out": tok["output"], "cost_usd": round(cost, 6)}},
        "seconds": round(sum(secs.values()), 1), "seconds_per_brief": round(sum(secs.values()) / n, 1), "seconds_by_brief": secs, "review": None, "removed": removed,
        "removed_empty_reference": [x for x in removed if x["empty_reference"]], "max_tokens": sb_draft.MAX_TOKENS, "streamed": True,
        "retriever": {"P": "none", "PG": "none", "K": "bm25", "V": "vector", "F": "week filter"}[a.arm], "lines_per_section": K_PAID if a.arm in ("K", "V") else None,
        "outside_verdict": bool(a.illustration), "note": "illustration, outside the verdict (section 6, revised plan)" if a.illustration else None,
        "index_entries": {c: r["index_entries"] for c, r in results.items()}, "index_seconds": {c: r["index_seconds"] for c, r in results.items()},
        "recall_by_case": checked.get("recall_by_case"), "retrieval_misses": checked.get("retrieval_misses"), "drafting_misses": checked.get("drafting_misses"),
        "framework_version": framework_version(), "queries_version": Q.load()["version"], "queries_hash": Q.queries_hash(), "instructions_sha": sb_draft.sha12(system),
        "mcp_route": a.route, "stage": a.stage, "forecast_usd": forecast, "prices": "graph/prices.json", "folder": str((CASES if a.arm == "P" else GROWN).relative_to(ROOT)),
        "expected_opened_by_graph": list(OPENED),
    }


def write_record(rec, results, label):
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / f"{label}.json").write_text(json.dumps(rec, indent=2) + "\n")
    tdir = RESULTS / label
    tdir.mkdir(exist_ok=True)
    for c, r in results.items():
        (tdir / f"{c}.trace.json").write_text(json.dumps({"label": label, "case": c, **{k: v for k, v in r.items() if k != "data_dir"}}, indent=2) + "\n")


# ---------- the mock's checks ----------
def mock_checks(a, run_dir: Path, results: dict, checked: dict, record_dir: Path) -> dict:
    import csv
    out = {}
    # 1. the MCP route: one server process a brief, its environment received
    probs = []
    for c, r in results.items():
        log = list(csv.DictReader(open(Path(r["data_dir"]) / "run_log.csv")))
        loads = [l for l in log if l["step"] == "load"]
        after = [l for l in log if l["step"] != "load" and not (l["step"] == "gate" and l["reason"] == "confidential" and "declined: its first line" in l["detail"])]
        if len(loads) != 1:
            probs.append(f"{c}: {len(loads)} server processes opened the folder (load lines), not 1")
        if any(l["case_id"] != c for l in after):
            probs.append(f"{c}: {sum(l['case_id'] != c for l in after)} log lines without case_id {c}")
    run_ids = {l["run_id"] for r in results.values() for l in csv.DictReader(open(Path(r["data_dir"]) / "run_log.csv"))}
    week_new = sorted(set(os.listdir(ROOT / "data" / "week")) - set(WEEK_BEFORE))
    if week_new:
        probs.append(f"data/week gained {week_new}: the server did not receive SOURCED_BRIEF_DATA")
    if len(run_ids) != 1 or not next(iter(run_ids), "").startswith("G"):
        probs.append(f"run ids in the logs: {sorted(run_ids)}; SOURCED_BRIEF_RUN_ID did not arrive")
    out["1 mcp route"] = {"ok": not probs, "route": a.route, "detail": probs or [f"{len(results)} briefs, one server process each (one load line), every later line carries its case_id, run id {sorted(run_ids)} in every line, nothing new in data/week"]}
    # 2. eval/expected: never opened by this process; no run folder file matches one there
    opened = list(OPENED)
    exp_hashes = set(subprocess.run(["shasum", "-a", "256", *[str(p) for p in sorted((ROOT / "eval" / "expected").glob("*.json"))]], capture_output=True, text=True).stdout.split()[0::2])
    exp_names = set(subprocess.run(["ls", str(ROOT / "eval" / "expected")], capture_output=True, text=True).stdout.split())
    clash = []
    for c, r in results.items():
        for f in Path(r["data_dir"]).iterdir():
            if f.name in exp_names or hashlib.sha256(f.read_bytes()).hexdigest() in exp_hashes:
                clash.append(f"{c}/{f.name}")
    out["2 expected unreachable"] = {"ok": not opened and not clash, "detail": [f"files under eval/expected/ opened or listed by the graph process: {len(opened)}{' ' + str(opened[:5]) if opened else ''}",
                                                                               f"run folder files matching a file in eval/expected/ by name or sha256: {len(clash)}{' ' + str(clash[:5]) if clash else ''}",
                                                                               f"files checked: {sum(len(list(Path(r['data_dir']).iterdir())) for r in results.values())}"]}
    # 3. the requests: one a brief, no cache_control anywhere (section 4 as changed in session 2), JSON schema output
    probs, shown = [], None
    reqs = sorted(record_dir.glob("*.request.json"))
    for p in reqs:
        body = json.loads(p.read_text())
        if '"cache_control"' in p.read_text() or '"ttl"' in json.dumps(body):
            probs.append(f"{p.name}: the request carries cache_control (top-level or in a block)")
        fmt = (body.get("output_config") or {}).get("format") or {}
        if fmt.get("type") != "json_schema":
            probs.append(f"{p.name}: output_config.format is {fmt.get('type')}")
        if "tool_choice" in body or "tools" in body:
            probs.append(f"{p.name}: tools or tool_choice in the draft request")
        shown = shown or {k: (v if k not in ("messages", "system", "output_config") else f"<{len(json.dumps(v))} characters>") for k, v in body.items()}
    if len(reqs) != len(results):
        probs.append(f"{len(reqs)} requests for {len(results)} briefs")
    out["3 requests and cache_control"] = {"ok": not probs, "detail": probs or [f"{len(reqs)} requests, one a brief; none carries cache_control, top-level or in any block; output_config.format json_schema; no tools"], "request_keys": shown,
                                           "first_request_file": str(reqs[0]) if reqs else None}
    # 4. the drafter's instructions copied from SKILL.md
    fails = sb_draft.check_copies()
    out["4 instructions copied"] = {"ok": not fails, "detail": fails or ["CONTEXT, ROLE, OUTPUT, WHEN TO STOP and RULES AND STYLE byte for byte from skill/SKILL.md; STEPS from graph/draft_step.md"]}
    # 5. the stop and the pause
    probs = []
    for c, r in results.items():
        stops = len(r.get("stops_recorded") or [])
        logged = sum(1 for l in csv.DictReader(open(Path(r["data_dir"]) / "run_log.csv")) if l["step"] == "stop")
        if stops != logged:
            probs.append(f"{c}: {stops} stops returned, {logged} logged")
        if (c in ANSWERS) != r["paused"]:
            probs.append(f"{c}: paused {r['paused']}, fixed answer {c in ANSWERS}")
        if r["paused"] and r.get("answer") != ANSWERS[c]:
            probs.append(f"{c}: resumed with {r.get('answer')!r}")
    paused = [c for c, r in results.items() if r["paused"]]
    out["5 stop and pause"] = {"ok": not probs, "detail": probs or [f"every stop logged once; paused and resumed with the fixed answer in {paused or 'no brief'}; no other brief paused"]}
    # 6. the case check
    v = checked["verdict"]
    full = not a.only
    out["6 bar"] = {"ok": v["passed"] if full else all(c["match"] for c in checked["cases"].values()), "detail": [f"{v['cases_matched']} of {v['of_cases']} cases, state {v['state_matched']} of {v['of_state']}, {v['claims_verified']} of {v['of_claims']} claims, {v['gates_held']} of {v['of_gates']} gates"]}
    # 7. the ledger: refusal, the in-run cap and the hold, on a scratch ledger
    lp = run_dir / "ledger_test.json"
    L = Ledger(lp, cap=8.0)
    r1 = L.refuse("t", 1, None)
    L.add("t", 1, "brief", 7.95, 1)
    r2 = L.refuse("t", 1, 0.10)
    r3 = L.refuse("t", 1, 0.04)
    L.hold(1, "test")
    r4 = L.refuse("t", 1, 0.01)
    L.release(1)
    r5 = L.refuse("t", 1, 0.01)
    ok = bool(r1) and bool(r2) and r3 is None and bool(r4) and r5 is None
    out["7 ledger"] = {"ok": ok, "detail": [f"no forecast refused: {bool(r1)}; US$7.95 + 0.10 refused: {bool(r2)}; US$7.95 + 0.04 allowed: {r3 is None}; a hold refuses: {bool(r4)}; a released hold allows: {r5 is None}"]}
    return out


async def stage0_same_request(a, brief, base, run_dir: Path, record_dir: Path) -> dict:
    """Stage 0 captures the draft request through the same node with the stand-in in capture mode
    and counts that body. Here the capture path runs on the first brief and its body is compared,
    byte for byte, with the request the mock's draft node sent."""
    import sb_graph
    case_id, folder = brief
    cap_dir = run_dir / "stage0-capture"
    with StandIn("capture", cap_dir / "requests") as si:
        si.case(case_id)
        llm = sb_draft.make_model(SMALLEST, None, base_url=si.url, api_key="capture-no-key")
        await run_brief(sb_graph.build(), case_id, base / folder, cap_dir, "GCAPTURE", a.arm, llm, a.route, f"capture-{case_id}")
    mine, theirs = (record_dir / f"{case_id}.request.json").read_bytes(), (cap_dir / "requests" / f"{case_id}.request.json").read_bytes()
    body = json.loads(mine)
    dropped = sorted(k for k in body if k not in COUNT_KEYS)
    ok = mine == theirs and dropped == ["max_tokens", "stream"]   # count_tokens takes neither
    return {"ok": ok, "detail": [f"{case_id}: the capture path's request is {'byte for byte' if mine == theirs else 'NOT'} the mock's ({len(mine)} bytes); the count sends every key but {dropped}"]}


async def e_same_request(repo: Path) -> dict:
    """Stage 0's E request carries the system text and the tools the Node harness sends."""
    f, _ = await read_folder(GROWN / "01_clean", repo.parent / "e-request", "01_clean", ROUTE)
    body = e_request(SMALLEST, None, f)
    js = ("import fs from 'node:fs'; import { Client } from '@modelcontextprotocol/sdk/client/index.js'; import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';"
          "const skill = fs.readFileSync('skill/SKILL.md','utf8').replace(/^---[\\s\\S]*?\\n---\\n/, '').trim();"
          "const mcp = new Client({ name: 'eval-harness', version: '1.0.0' });"
          "await mcp.connect(new StdioClientTransport({ command: process.execPath, args: ['server.js'], env: { ...process.env, SOURCED_BRIEF_DATA: process.argv[1] }, stderr: 'ignore' }));"
          "const tools = (await mcp.listTools()).tools.filter((t) => t.name !== 'set_case').map((t) => { const { $schema, ...input_schema } = t.inputSchema; return { name: t.name, description: t.description, input_schema }; });"
          "await mcp.close(); process.stdout.write(JSON.stringify({ skill, tools }));")
    tmp = repo.parent / "e-request" / "node-view"
    tmp.mkdir(parents=True)
    for x in (GROWN / "01_clean").iterdir():
        shutil.copyfile(x, tmp / x.name)
    node = json.loads(subprocess.run(["node", "--input-type=module", "-e", js, str(tmp)], cwd=repo, check=True, capture_output=True, text=True).stdout)
    same_sys, same_tools = body["system"] == node["skill"], json.dumps(body["tools"], sort_keys=True) == json.dumps(node["tools"], sort_keys=True)
    reads = len(body["messages"][4]["content"])
    return {"ok": same_sys and same_tools and reads == 207, "detail": [f"system {'equals' if same_sys else 'DIFFERS FROM'} the harness's skill body; tools {'equal' if same_tools else 'DIFFER FROM'} the harness's {[t['name'] for t in node['tools']]}; {reads} read results after list_sources; top-level cache_control {body['cache_control']}"]}


def print_mock(report: dict):
    print("\nmock checks")
    for name, r in report.items():
        print(f"  {'PASS' if r['ok'] else 'FAIL'}  {name}: {' | '.join(r['detail'])}")


# ---------- arm E: the Node harness, unchanged, in a scratch copy ----------
E_COPY = ["server.js", "package.json", "package-lock.json", "lib", "skill", "arms", "eval/run_eval.js", "eval/check.js", "eval/mock.js", "eval/arms.js", "eval/arms_page.js",
          "eval/page.js", "eval/review_effect.js", "eval/prices.json", "eval/answers.txt", "eval/expected", "eval/CASES.md"]


def scratch_repo(dest: Path, link_env: bool) -> Path:
    for rel in E_COPY:
        s, d = ROOT / rel, dest / rel
        d.parent.mkdir(parents=True, exist_ok=True)
        if s.is_dir():
            shutil.copytree(s, d)
        elif s.exists():
            shutil.copyfile(s, d)
    (dest / "node_modules").symlink_to(ROOT / "node_modules")
    (dest / "data").mkdir()
    shutil.copytree(GROWN, dest / "data" / "cases")
    if link_env and (ROOT / ".env").exists():
        (dest / ".env").symlink_to(ROOT / ".env")
    return dest


def e_cache_check(cmd: list[str]) -> dict:
    src = (ROOT / "eval" / "run_eval.js").read_text()
    ok = "if (CACHE) req.cache_control = { type: \"ephemeral\" };" in src and 'const CACHE = !flag("no-cache");' in src and "--no-cache" not in cmd
    return {"ok": ok, "detail": [f"eval/run_eval.js sets top-level cache_control {{type: 'ephemeral'}} on every call unless --no-cache; the E command {'does not pass' if '--no-cache' not in cmd else 'PASSES'} --no-cache"]}


def e_arm(a) -> int:
    stamp = now_local().strftime("%Y%m%d%H%M%S")
    label = a.label or f"G{stamp}-E-{'mock' if a.mock else model_tag(a.model)}{'-' + a.effort if a.effort else ''}"
    base = HERE / ("runs-mock" if a.mock else "runs") / label
    if base.exists():
        sys.exit(f"{base} exists; pass --label or wait a minute")
    repo = scratch_repo(base / "repo", link_env=not a.mock)
    cmd = ["node", "eval/run_eval.js", "--arm", "one"]
    # The Node mock makes one tool call a model call, so its 207 reads a brief need a cap above 207;
    # a paid E run's cap is set in stage 2 from one uncounted brief (WORK-10-DESIGN.md section 6).
    cmd += ["--mock", "--max-calls", "300"] if a.mock else ["--model", a.model, "--max-calls", str(a.max_calls)] + (["--effort", a.effort] if a.effort else [])
    if a.only:
        cmd += ["--only", a.only]
    ledger = Ledger(base / "spend.json" if a.mock else LEDGER)
    forecast = None
    if not a.mock:
        fc = json.loads(FORECAST.read_text()) if FORECAST.exists() else {}
        per = fc.get("per_brief_usd", {}).get("E", {}).get(f"{a.model}{'-' + a.effort if a.effort else ''}")
        todo = [b for b in BRIEFS if not a.only or b[0] == a.only]
        forecast = None if per is None else sum(per.get(c, 0) for c, _ in todo)
        if a.release_hold:
            ledger.release(a.stage)
        why = ledger.refuse(label, a.stage, forecast)
        if why:
            print(f"refused: {why}")
            return 2
    print(f"run {label}: arm E, the Node harness in {repo.relative_to(ROOT)}: {' '.join(cmd)}")
    t0 = time.perf_counter()
    p = subprocess.run(cmd, cwd=repo, capture_output=True, text=True)
    print(p.stdout[-4000:])
    if p.returncode:
        print(p.stderr[-2000:])
    secs = time.perf_counter() - t0
    cache = e_cache_check(cmd)
    if a.mock:
        runs = sorted((repo / "eval" / "runs-mock").iterdir())
        checked = check_run(runs[-1], None)
        v = checked["verdict"]
        report = {"E harness mock": {"ok": p.returncode == 0 and v["passed"], "detail": [f"node eval/run_eval.js --arm one --mock in the scratch copy, on data/cases-grown: {v['cases_matched']} of {v['of_cases']} cases, state {v['state_matched']} of {v['of_state']}, {v['claims_verified']} of {v['of_claims']} claims: {'BAR MET' if v['passed'] else 'BAR NOT MET'} (graph/check_case.mjs on {runs[-1].relative_to(ROOT)})"]},
                  "E cache_control": cache,
                  "E stage 0 request": asyncio.run(e_same_request(repo)),
                  "E untouched": {"ok": all((repo / f).read_bytes() == (ROOT / f).read_bytes() for f in ["eval/run_eval.js", "eval/check.js", "server.js", "skill/SKILL.md"]), "detail": ["the scratch copy's run_eval.js, check.js, server.js and SKILL.md are byte for byte the repo's"]}}
        (base / "mock_report.json").write_text(json.dumps(report, indent=2) + "\n")
        print_mock(report)
        return 0 if all(x["ok"] for x in report.values()) else 1
    # a paid E run: the Node record kept whole, its cost recomputed call by call at each call's tier
    node_label = sorted((repo / "eval" / ("runs-mock" if a.only else "runs")).iterdir())[-1].name
    node_rec_path = repo / "eval" / "results-arms" / f"{node_label}.json"
    node_rec = json.loads(node_rec_path.read_text()) if node_rec_path.exists() else json.loads((repo / "eval" / ("runs-mock" if a.only else "runs") / node_label / "result.json").read_text())
    traces_dir = repo / "eval" / "results-arms" / node_label
    cost, calls, by_brief = 0.0, 0, {}
    for tf in sorted(traces_dir.glob("*.trace.json")) if traces_dir.exists() else []:
        t = json.loads(tf.read_text())
        bc = 0.0
        for s in t["steps"]:
            if s.get("type") == "model_call":
                k = s["tokens"]
                bc += call_cost(a.model, k["in"] - k["cache_read"] - k["cache_write"], k["cache_write"], k["cache_read"], k["out"]) or 0.0
                calls += 1
        by_brief[t["case"]] = round(bc, 6)
        cost += bc
    upper_bound = False
    if not by_brief:   # --only: the Node harness writes no trace, so no per-call split; every token priced at the model's top tier, an upper bound
        tk, t = node_rec.get("tokens", {}), PRICES[a.model]["tiers"][-1]
        cost = (tk.get("input", 0) * t["input"] + tk.get("cache_write", 0) * t["cache_write_5m"] + tk.get("cache_read", 0) * t["cache_read"] + tk.get("output", 0) * t["output"]) / 1e6
        calls, upper_bound = node_rec.get("model_calls", 0), True
    ledger.add(label, a.stage, "E probe" if a.only else "run", cost, calls, f"Node harness; its own figure US${node_rec.get('cost_usd')}")
    counted = bool(node_rec.get("counted")) and not a.only and ledger.total <= CAP_USD
    rec = {"label": label, "work": "WORK-10", "arm": "E", "model": a.model, "effort": a.effort, "stage": a.stage, "counted": counted, "max_calls": a.max_calls,
           "command": " ".join(cmd), "cost_usd": round(cost, 6), "cost_is_upper_bound": upper_bound, "cost_by_brief_usd": by_brief, "model_calls": calls, "node_cost_usd": node_rec.get("cost_usd"),
           "verdict": node_rec.get("verdict"), "seconds": round(secs, 1), "forecast_usd": forecast, "cache_check": cache, "prices": "graph/prices.json",
           "framework_version": {"node": subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip(), "server_version": node_rec.get("server_version")},
           "node_record": node_rec}
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / f"{label}.json").write_text(json.dumps(rec, indent=2) + "\n")
    if traces_dir.exists():
        shutil.copytree(traces_dir, RESULTS / label)
    if forecast and cost > 2 * forecast:
        ledger.hold(a.stage, f"{label} cost US${cost:.4f}, more than twice its forecast US${forecast:.4f}")
    print(f"recorded {RESULTS / (label + '.json')}; cost US${cost:.4f} (Node's own figure US${node_rec.get('cost_usd')}); counted {counted}; ledger US${ledger.total:.4f}")
    return 0


# ---------- stage 0 ----------
async def read_folder(folder: Path, run_dir: Path, case_id: str, route: str) -> tuple[dict, list[dict]]:
    data = run_dir / case_id
    data.mkdir(parents=True)
    for f in sorted(folder.iterdir()):
        shutil.copyfile(f, data / f.name)
    async with ToolServer(data, f"S0{case_id}", route) as srv:
        await srv.call_json("set_case", {"case_id": case_id})
        src = await srv.call_json("list_sources", {})
        reads, raw = [], []
        for s in src["sources"]:
            if s["status"] == "READABLE":
                text, _ = await srv.call("read_source", {"file": s["file"]})
                raw.append((s["file"], text))
                reads.append(json.loads(text))
        tools = [t for t in await srv.tool_defs() if t["name"] != "set_case"]
        list_text, _ = await srv.call("list_sources", {})
    for t in tools:
        t["input_schema"] = {k: v for k, v in t["input_schema"].items() if k != "$schema"}
    return {"src": src, "list_text": list_text, "raw": raw, "tools": tools}, reads


def e_request(model: str, effort: str | None, f: dict) -> dict:
    """The prompt arm E reaches once it has read everything (the A1 pattern on record): the skill as
    system, the server's tools without set_case, the opening message, list_sources and every read."""
    skill = (ROOT / "skill" / "SKILL.md").read_text()
    import re
    system = re.sub(r"^---[\s\S]*?\n---\n", "", skill).strip()
    msgs = [{"role": "user", "content": "Write this week's brief."},
            {"role": "assistant", "content": [{"type": "tool_use", "id": "toolu_e0", "name": "list_sources", "input": {}}]},
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_e0", "content": f["list_text"]}]},
            {"role": "assistant", "content": [{"type": "tool_use", "id": f"toolu_e{i + 1}", "name": "read_source", "input": {"file": n}} for i, (n, _) in enumerate(f["raw"])]},
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": f"toolu_e{i + 1}", "content": t} for i, (_, t) in enumerate(f["raw"])]}]
    body = {"model": model, "system": system, "tools": f["tools"], "messages": msgs, "cache_control": {"type": "ephemeral"}}
    if effort:
        body["output_config"] = {"effort": effort}
    return body


COUNT_KEYS = ["model", "system", "messages", "tools", "output_config", "cache_control", "thinking", "tool_choice"]


def median_output(arm_name: str) -> float | None:
    outs = []
    for p in (ROOT / "eval" / "results-arms").glob("*.json"):
        r = json.loads(p.read_text())
        if r.get("arm_name") == arm_name and r.get("counted"):
            outs.append(r["tokens"]["output"] / r["briefs"])
    return statistics.median(outs) if outs else None


async def stage0(a) -> int:
    import sb_graph
    stamp = now_local().strftime("%Y%m%d%H%M%S")
    out_dir = RESULTS / "stage0"
    run_dir = HERE / "runs" / f"S0{stamp}"
    run_dir.mkdir(parents=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"stage 0 {stamp}: queries v{Q.load()['version']} {Q.queries_hash()[:16]}, route {a.route}{', counting with the API' if a.count else ', no API call'}")
    # 1. recall: K and V at k = 5, 10, 20, 40 on the grown week, from the server's own reads
    recall_in, entries_n = {"K": {}, "V": {}}, {}
    for case_id, folder in BRIEFS:
        f, reads = await read_folder(GROWN / folder, run_dir / "recall", case_id, a.route)
        entries = sb_index.entries_from_reads(reads)
        entries_n[case_id] = len(entries)
        qs = Q.fill(f["src"]["week_ending"], f["src"]["latest_tracker_run"])
        for arm, R in (("K", sb_index.Keyword(entries)), ("V", sb_index.Vector(entries))):
            for k in K_RECALL:
                lines, _ = sb_index.retrieve(R, qs, k)
                recall_in[arm].setdefault(str(k), {})[case_id] = [e["ref"] for e in lines]
    (out_dir / "retrieved.json").write_text(json.dumps(recall_in) + "\n")
    recall = json.loads(subprocess.run(["node", str(HERE / "check_case.mjs"), "--recall", str(out_dir / "retrieved.json")], check=True, capture_output=True, text=True).stdout)["recall"]
    (out_dir / "recall.json").write_text(json.dumps({"queries_hash": Q.queries_hash(), "index_entries": entries_n, "recall": recall}, indent=2) + "\n")
    print("\nrecall (expected references among the lines shown), by brief")
    print("  arm  k   " + " ".join(f"{c[:8]:>9}" for c, _ in BRIEFS))
    stop_rule = []
    for arm in ("K", "V"):
        for k in K_RECALL:
            row = recall[arm][str(k)]
            print(f"  {arm}   {k:<3} " + " ".join(f"{row[c]['found']:>4}/{row[c]['of']:<4}" for c, _ in BRIEFS))
            if k == K_PAID:
                for c, _ in BRIEFS:
                    for m in row[c]["missed"]:
                        stop_rule.append(f"{arm} {c}: {m['ref']} ({m['title']}, query {Q.load()['templates'][m['section']]!r})")
    # 2. the exact draft requests, captured from the draft node with the stand-in, for both models
    reqs = {}
    combos = [(SMALLEST, None), (LARGEST, "high")]
    with StandIn("capture", out_dir / "requests") as si:
        graph = sb_graph.build()
        for arm in ("P", "PG", "K", "V"):
            for model, effort in combos:
                tag = f"{model}{'-' + effort if effort else ''}"
                llm = sb_draft.make_model(model, effort, base_url=si.url, api_key="capture-no-key")
                for case_id, folder in BRIEFS:
                    cid = f"{arm}.{tag}.{case_id}"
                    si.case(cid)
                    await run_brief(graph, case_id, (CASES if arm == "P" else GROWN) / folder, run_dir / "capture" / arm / tag, f"S0{stamp}", arm, llm, a.route, f"S0{stamp}-{cid}")
                    reqs[cid] = out_dir / "requests" / f"{cid}.request.json"
    erq = {}
    for case_id, folder in BRIEFS:
        f, _ = await read_folder(GROWN / folder, run_dir / "e", case_id, a.route)
        for model, effort in combos:
            tag = f"{model}{'-' + effort if effort else ''}"
            p = out_dir / "requests" / f"E.{tag}.{case_id}.request.json"
            p.write_text(json.dumps(e_request(model, effort, f)) + "\n")
            erq[f"E.{tag}.{case_id}"] = p
    print(f"\ncaptured {len(reqs)} draft requests and built {len(erq)} E requests in {(out_dir / 'requests').relative_to(ROOT)}")
    if stop_rule:
        print(f"\nSTOP RULE (stage 0, step 5): at k = {K_PAID}, {len(stop_rule)} expected references are not retrieved:")
        for s in stop_rule:
            print(f"  {s}")
    if not a.count:
        print("\nno token count (pass --count to count every request with the API's token counting endpoint and write the forecast)")
        return 0
    # 3. count every request with the token counting endpoint, and forecast
    import anthropic
    client = anthropic.Anthropic(api_key=api_key())
    counts = {}
    for cid, p in {**reqs, **erq}.items():
        body = json.loads(p.read_text())
        counts[cid] = client.messages.count_tokens(**{k: body[k] for k in COUNT_KEYS if k in body}).input_tokens
    out_med = {SMALLEST: median_output("A1"), f"{LARGEST}-high": median_output("Ceiling")}
    per = {}
    for cid, n in counts.items():
        arm, tag, case_id = cid.split(".")
        model = tag.replace("-high", "")
        o = out_med[tag] or 0
        if arm == "E":
            # the A1 pattern: list (small), read everything, draft, read back; the read-everything prompt written to cache once and read back once
            cost = (call_cost(model, 0, n, 0, o) or 0) + (call_cost(model, 0, 0, n, 200) or 0)
        else:
            cost = call_cost(model, n, 0, 0, o) or 0     # one call, no cache_control: the whole prompt priced as fresh input at its tier
        per.setdefault(arm, {}).setdefault(tag, {})[case_id] = round(cost, 6)
    fc = {"stage0": stamp, "queries_hash": Q.queries_hash(), "counts": counts, "median_output_per_brief": out_med, "per_brief_usd": per,
          "per_run_usd": {arm: {tag: round(sum(v.values()), 6) for tag, v in t.items()} for arm, t in per.items()},
          "method": "token counts from messages.count_tokens on the exact requests (an estimate, per the token counting page); output tokens are each model's median output a brief in its WORK-09 records; the graph's one call priced as fresh input at its tier (no cache_control); E priced as one write and one read of its read-everything prompt plus the median output"}
    FORECAST.write_text(json.dumps(fc, indent=2) + "\n")
    Ledger(LEDGER).add(f"S0{stamp}", 0, "token count", 0.0, 0, f"{len(counts)} count_tokens requests, free")
    print("\nforecast a run (US$):")
    for arm, t in fc["per_run_usd"].items():
        print(f"  {arm:3} " + ", ".join(f"{tag} {v:.4f}" for tag, v in t.items()))
    print(f"\nwritten {FORECAST.relative_to(ROOT)} and {(out_dir / 'recall.json').relative_to(ROOT)}")
    return 0


async def probe(a) -> int:
    """One draft request for 01_clean on arm P, the smallest model, max_tokens 1: does the API accept
    the output schema's grammar? Built by the same functions as the draft node. --dry sends it to the
    local stand-in instead (free) and compares it with the mock's request."""
    stamp = now_local().strftime("%Y%m%d%H%M%S")
    label = f"PROBE{stamp}-P-{model_tag(SMALLEST)}"
    run_dir = HERE / ("runs-mock" if a.dry else "runs") / label
    f, reads = await read_folder(CASES / "01_clean", run_dir, "01_clean", a.route)
    entries = sb_index.in_file_order(sb_index.entries_from_reads(reads))
    system, _ = sb_draft.instructions()
    msgs = [{"role": "system", "content": system}, *sb_draft.messages(f["src"], entries)]
    if a.dry:
        with StandIn("capture", run_dir / "requests") as si:
            si.case("01_clean")
            await sb_draft.make_model(SMALLEST, None, base_url=si.url, api_key="capture-no-key", max_tokens=1).ainvoke(msgs)
        mine = json.loads((run_dir / "requests" / "01_clean.request.json").read_text())
        node = json.loads(sorted((HERE / "runs-mock").glob("flat-P/requests/01_clean.request.json"))[0].read_text())
        same = {k: v for k, v in mine.items() if k != "max_tokens"} == {k: v for k, v in node.items() if k != "max_tokens"}
        print(f"dry probe: the request equals the draft node's in every key but max_tokens: {same}; max_tokens {mine['max_tokens']} (the node's {node['max_tokens']})")
        return 0 if same else 1
    ledger = Ledger(LEDGER)
    t0 = time.perf_counter()
    try:
        out = await sb_draft.make_model(SMALLEST, None, api_key=api_key(), max_tokens=1).ainvoke(msgs)
    except Exception as e:
        print(f"probe {label}: REJECTED after {time.perf_counter() - t0:.1f} s\n{type(e).__name__}: {e}")
        body = getattr(e, "body", None) or getattr(getattr(e, "response", None), "text", None)
        if body:
            print(f"full error body: {body}")
        ledger.add(label, 1, "probe", 0.0, 1, f"rejected: {type(e).__name__}")
        return 1
    raw = out["raw"]
    u = raw.usage_metadata or {}
    d = u.get("input_token_details") or {}
    cr, cw = d.get("cache_read") or 0, (d.get("cache_creation") or 0) + (d.get("ephemeral_5m_input_tokens") or 0)
    fresh = (u.get("input_tokens") or 0) - cr - cw
    cost = call_cost(SMALLEST, fresh, cw, cr, u.get("output_tokens") or 0) or 0.0
    meta = raw.response_metadata or {}
    ledger.add(label, 1, "probe", cost, 1, f"accepted; stop_reason {meta.get('stop_reason')}")
    rec = {"label": label, "status": "accepted", "stop_reason": meta.get("stop_reason"), "model": meta.get("model") or meta.get("model_name"), "id": meta.get("id"),
           "tokens": {"in": u.get("input_tokens"), "fresh": fresh, "cache_read": cr, "cache_write": cw, "out": u.get("output_tokens")}, "cost_usd": round(cost, 6), "seconds": round(time.perf_counter() - t0, 2)}
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / f"{label}.json").write_text(json.dumps(rec, indent=2) + "\n")
    print(f"probe {label}: ACCEPTED; stop_reason {rec['stop_reason']}; {rec['tokens']['in']} in, {rec['tokens']['out']} out; US${cost:.6f}; ledger US${ledger.total:.6f}")
    return 0


async def stage0_recount(a) -> int:
    """After the schema change: capture every graph arm's draft request on the smallest model again and
    count it (free), updating the forecast; the old figures are kept beside the new ones."""
    import sb_graph
    stamp = now_local().strftime("%Y%m%d%H%M%S")
    out_dir, run_dir = RESULTS / "stage0" / f"recount-{stamp}", HERE / "runs" / f"S0R{stamp}"
    run_dir.mkdir(parents=True)
    fc = json.loads(FORECAST.read_text())
    old_run = {arm: fc["per_run_usd"][arm][SMALLEST] for arm in ("P", "PG", "K", "V", "F")}
    import anthropic
    client = anthropic.Anthropic(api_key=api_key())
    out_med, counts, n = fc["median_output_per_brief"][SMALLEST], {}, 0
    with StandIn("capture", out_dir / "requests") as si:
        graph, llm = sb_graph.build(), sb_draft.make_model(SMALLEST, None, base_url=si.url, api_key="capture-no-key")
        for arm in ("P", "PG", "K", "V", "F"):
            per = {}
            for case_id, folder in BRIEFS:
                cid = f"{arm}.{SMALLEST}.{case_id}"
                si.case(cid)
                await run_brief(graph, case_id, (CASES if arm == "P" else GROWN) / folder, run_dir / arm, f"S0R{stamp}", arm, llm, a.route, f"S0R{stamp}-{cid}")
                body = json.loads((out_dir / "requests" / f"{cid}.request.json").read_text())
                counts[cid] = client.messages.count_tokens(**{k: body[k] for k in COUNT_KEYS if k in body}).input_tokens
                n += 1
                per[case_id] = round(call_cost(SMALLEST, counts[cid], 0, 0, out_med) or 0, 6)
            fc["per_brief_usd"][arm][SMALLEST] = per
            fc["per_run_usd"][arm][SMALLEST] = round(sum(per.values()), 6)
    fc.setdefault("before_schema_change", {"per_run_usd_smallest": old_run})
    fc["counts_after_schema_change"] = counts
    fc["recount"] = stamp
    fc["note"] = "graph arms recounted on the smallest model after the flat output schema (16 Nov 2026); the largest model's graph figures are from before it, and stage 3 is dropped"
    FORECAST.write_text(json.dumps(fc, indent=2) + "\n")
    Ledger(LEDGER).add(f"S0R{stamp}", 0, "token count", 0.0, 0, f"{n} count_tokens requests after the schema change, free")
    print(f"recount {stamp}: {n} requests counted")
    for arm in ("P", "PG", "K", "V", "F"):
        c = [counts[f"{arm}.{SMALLEST}.{b}"] for b, _ in BRIEFS]
        new = fc["per_run_usd"][arm][SMALLEST]
        print(f"  {arm:3} tokens {min(c):,} to {max(c):,}; forecast a run US${old_run[arm]:.4f} -> US${new:.4f} ({(new - old_run[arm]) / old_run[arm] * 100:+.1f}%)")
    return 0


async def stage0_f(a) -> int:
    """Stage 0 for arm F alone: its recall (every expected reference among the lines it keeps), the
    exact draft request captured from the node, and, with --count, its token count and forecast."""
    import sb_graph
    stamp = now_local().strftime("%Y%m%d%H%M%S")
    out_dir, run_dir = RESULTS / "stage0", HERE / "runs" / f"S0F{stamp}"
    run_dir.mkdir(parents=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"stage 0, arm F {stamp}: route {a.route}{', counting with the API' if a.count else ', no API call'}")
    kept, weeks = {}, {}
    for case_id, folder in BRIEFS:
        f, reads = await read_folder(GROWN / folder, run_dir / "recall", case_id, a.route)
        w, bad = sb_index.weeks_of(reads)
        if bad:
            print(f"stopped: arm F cannot read the week of {bad}")
            return 2
        lines = sb_index.by_week(sb_index.entries_from_reads(reads), w, f["src"]["week_ending"])
        kept[case_id] = [e["ref"] for e in lines]
        weeks[case_id] = {"kept_files": sorted({e["file"] for e in lines}), "fallback": sorted(n for n, (_, how) in w.items() if "fallback" in how)}
    (out_dir / "retrieved_F.json").write_text(json.dumps({"F": {"all": kept}}) + "\n")
    recall = json.loads(subprocess.run(["node", str(HERE / "check_case.mjs"), "--recall", str(out_dir / "retrieved_F.json")], check=True, capture_output=True, text=True).stdout)["recall"]["F"]["all"]
    (out_dir / "recall_F.json").write_text(json.dumps({"recall": recall, "weeks": weeks}, indent=2) + "\n")
    print("\nrecall, arm F (expected references among the lines kept), by brief")
    for c, _ in BRIEFS:
        r = recall[c]
        print(f"  {c:16} {r['found']}/{r['of']}  {len(kept[c])} lines from {weeks[c]['kept_files']}{'; missed ' + str([m['ref'] for m in r['missed']]) if r['missed'] else ''}")
    full = sum(1 for c, _ in BRIEFS if not recall[c]["missed"])
    print(f"every expected reference kept in {full} of {len(BRIEFS)} briefs")
    reqs = {}
    with StandIn("capture", out_dir / "requests") as si:
        graph, llm = sb_graph.build(), sb_draft.make_model(SMALLEST, None, base_url=si.url, api_key="capture-no-key")
        for case_id, folder in BRIEFS:
            cid = f"F.{SMALLEST}.{case_id}"
            si.case(cid)
            await run_brief(graph, case_id, GROWN / folder, run_dir / "capture", f"S0F{stamp}", "F", llm, a.route, f"S0F{stamp}-{cid}")
            reqs[cid] = out_dir / "requests" / f"{cid}.request.json"
    print(f"\ncaptured {len(reqs)} draft requests")
    if not a.count:
        return 0
    import anthropic
    client = anthropic.Anthropic(api_key=api_key())
    fc = json.loads(FORECAST.read_text())
    out_med = fc["median_output_per_brief"][SMALLEST]
    per = {}
    for cid, p in reqs.items():
        body = json.loads(p.read_text())
        n = client.messages.count_tokens(**{k: body[k] for k in COUNT_KEYS if k in body}).input_tokens
        fc["counts"][cid] = n
        per[cid.split(".")[2]] = round(call_cost(SMALLEST, n, 0, 0, out_med) or 0, 6)
    fc["per_brief_usd"]["F"] = {SMALLEST: per}
    fc["per_run_usd"]["F"] = {SMALLEST: round(sum(per.values()), 6)}
    fc["stage0_F"] = stamp
    FORECAST.write_text(json.dumps(fc, indent=2) + "\n")
    Ledger(LEDGER).add(f"S0F{stamp}", 0, "token count", 0.0, 0, f"{len(reqs)} count_tokens requests for arm F, free")
    counts = {c: fc["counts"][f"F.{SMALLEST}.{c}"] for c, _ in BRIEFS}
    lo, hi = min(counts, key=counts.get), max(counts, key=counts.get)
    print(f"\ntokens, {SMALLEST}: lowest {lo} {counts[lo]:,}, highest {hi} {counts[hi]:,}; forecast a run US${fc['per_run_usd']['F'][SMALLEST]:.4f}")
    return 0


WEEK_BEFORE = os.listdir(ROOT / "data" / "week")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", choices=["stage0", "probe"])
    ap.add_argument("--dry", action="store_true", help="probe: send it to the local stand-in instead (free)")
    ap.add_argument("--arm", choices=ARMS)
    ap.add_argument("--model", default=SMALLEST)
    ap.add_argument("--effort")
    ap.add_argument("--mock", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--label")
    ap.add_argument("--stage", type=int, default=None)
    ap.add_argument("--max-calls", type=int, default=30)
    ap.add_argument("--route", choices=["adapter", "sdk"], default=ROUTE)
    ap.add_argument("--count", action="store_true", help="stage0: count tokens with the API and write the forecast")
    ap.add_argument("--release-hold", action="store_true")
    ap.add_argument("--test-brief", action="store_true", help="one brief (with --only) on Megat's word while the stage is held; the cap still applies")
    ap.add_argument("--recount", action="store_true", help="stage0: recount the graph arms' requests after a change to them (free token counts)")
    ap.add_argument("--mock-truncate", help="mock only: the stand-in ends this brief's draft call on max_tokens, to test the guard")
    ap.add_argument("--illustration", action="store_true", help="mark a run as illustration, outside the verdict (stage 1's K and V runs)")
    a = ap.parse_args()
    if a.command == "probe":
        return asyncio.run(probe(a))
    if a.command == "stage0":
        if a.recount:
            return asyncio.run(stage0_recount(a))
        return asyncio.run(stage0_f(a) if a.arm == "F" else stage0(a))
    if not a.arm:
        ap.error("--arm or stage0 is required")
    if not a.mock and a.stage is None:
        ap.error("a paid run names its --stage (1, 2 or 3)")
    if a.arm == "E":
        return e_arm(a)
    return asyncio.run(graph_arm(a))


if __name__ == "__main__":
    sys.exit(main())
