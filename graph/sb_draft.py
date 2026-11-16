"""WORK-10, decision 10a: the drafter's instructions, its output schema and the model it calls.

The instructions are built from skill/SKILL.md at run time: CONTEXT, ROLE, OUTPUT, WHEN TO STOP and
RULES AND STYLE are copied byte for byte; STEPS is replaced by graph/draft_step.md; INPUTS AND
TOOLS describes tools the drafter does not have in the graph and is left out. The mock fails if a
copied part differs from SKILL.md (check_copies).

The call is ChatAnthropic with with_structured_output(method="json_schema"), which binds
output_config.format into the request (langchain_anthropic/chat_models.py, the json_schema branch
of with_structured_output), confirmed in the installed langchain-anthropic 1.7.10 source in session
2. Opus 5.5 rejects a forced tool call, so the function_calling method is never used.

No cache_control (WORK-10-DESIGN.md section 4, as changed in session 2): the graph makes one call a
brief, and a cache written at the end of one brief's prompt is never read by the next, which shares
only the instructions with it; a top-level cache_control would price every input token as a cache
write for no return. The mock fails if a graph request carries cache_control anywhere.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SKILL = ROOT / "skill" / "SKILL.md"
STEP = HERE / "draft_step.md"

SECTIONS = ["what_moved", "what_is_due", "what_changed", "decisions", "open_questions"]
KINDS_SIMPLE = ["number", "text", "owner", "status", "date", "period", "metric", "run_id"]
STOP_REASONS = ["disagreement", "no_source", "confidential", "arithmetic"]
COPIED = ["CONTEXT", "ROLE, READER AND TASK", "OUTPUT", "WHEN TO STOP AND WHAT TO DECLINE", "RULES AND STYLE"]
MAX_TOKENS = 32000   # raised from 16,000 (the Node harness's per-call value) on 16 Nov 2026: one call carries the
                     # thinking and the whole draft, and 2 of 8 briefs hit 16,000; streamed, so no request timeout


def _skill_parts() -> tuple[str, str, dict[str, str]]:
    text = SKILL.read_text(encoding="utf8")
    body = re.sub(r"^---\n[\s\S]*?\n---\n", "", text).strip()
    head, *rest = re.split(r"(?m)^(?=## )", body)
    parts = {}
    for p in rest:
        title = p.splitlines()[0][3:].strip()
        parts[title] = p.rstrip() + "\n"
    version = (re.search(r"Version: (v[\d.]+)", text) or [None, "unknown"])[1]
    return head, version, parts


def instructions() -> tuple[str, str]:
    """The drafter's system text and its version label."""
    head, version, parts = _skill_parts()
    head = head.replace(f"Version: {version},", f"Version: {version}-graph,", 1)
    order = ["CONTEXT", "ROLE, READER AND TASK", "STEPS", "OUTPUT", "WHEN TO STOP AND WHAT TO DECLINE", "RULES AND STYLE"]
    out = [head.rstrip() + "\n"]
    for title in order:
        out.append(STEP.read_text(encoding="utf8").rstrip() + "\n" if title == "STEPS" else parts[title])
    return "\n".join(out).rstrip() + "\n", f"{version}-graph"


def check_copies() -> list[str]:
    """Every copied part sits in the instructions exactly as in SKILL.md."""
    _, _, parts = _skill_parts()
    system, _ = instructions()
    skill = SKILL.read_text(encoding="utf8")
    fails = []
    for t in COPIED:
        if t not in parts:
            fails.append(f"SKILL.md has no section {t}")
        elif parts[t].rstrip() not in system or parts[t].rstrip() not in skill:
            fails.append(f"section {t} differs from SKILL.md")
    if "## INPUTS AND TOOLS" in system or "## VERSION LOG" in system:
        fails.append("a part that is not copied is in the instructions")
    return fails


def sha12(s: str) -> str:
    return hashlib.sha256(s.encode("utf8")).hexdigest()[:12]


# ---------- the output: one flat list of sentences, one claim shape, and the stops ----------
# The API compiles the schema into a grammar. The first form (five copies of the sentence shape, one
# a section, each claim a choice of two shapes) was refused on 16 Nov 2026: "The compiled grammar is
# too large". This form names the section on each sentence and gives every claim all eight fields,
# empty where its kind uses none; to_sections() turns it back into the draft draft_brief takes.
CLAIM_FIELDS = ["kind", "ref", "value", "metric", "new_ref", "new_value", "old_ref", "old_value"]
_claim = {"type": "object", "additionalProperties": False, "required": CLAIM_FIELDS,
          "properties": {"kind": {"type": "string", "enum": [*KINDS_SIMPLE, "change"]}, **{f: {"type": "string"} for f in CLAIM_FIELDS[1:]}}}
_sentence = {"type": "object", "additionalProperties": False, "required": ["section", "text", "claims"],
             "properties": {"section": {"type": "string", "enum": SECTIONS}, "text": {"type": "string"}, "claims": {"type": "array", "items": _claim}}}
OUTPUT_SCHEMA = {
    "title": "brief_draft",
    "description": "The week's draft: every sentence with its section and its claims, and the stops.",
    "type": "object", "additionalProperties": False, "required": ["stops", "sentences"],
    "properties": {
        "stops": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["reason", "text"],
                                             "properties": {"reason": {"type": "string", "enum": STOP_REASONS}, "text": {"type": "string"}}}},
        "sentences": {"type": "array", "items": _sentence},
    },
}


def lines_text(entries: list[dict]) -> str:
    """The lines the drafter sees: reference, then the line or the row with its column names; by file, in file order."""
    out, last = [], None
    for e in entries:
        if e["file"] != last:
            out.append(f"\n### {e['file']}")
            last = e["file"]
        out.append(f"[{e['ref']}] {e['text']}")
    return "\n".join(out).strip()


def sources_text(src: dict) -> str:
    declined = [s["file"] for s in src["sources"] if s["status"] == "DECLINED"]
    names = [s["file"] for s in src["sources"]]
    return "\n".join([
        f"Week ending: {src['week_ending']}",
        f"Latest tracker run: {src['latest_tracker_run']}",
        f"Declined as confidential: {', '.join(declined) if declined else 'none'}",
        f"Files in the week folder ({len(names)}): {', '.join(names)}",
    ])


def messages(src: dict, entries: list[dict]) -> list[dict]:
    """The one user turn; the fixed instructions go first as the system message, so they lead every request."""
    return [{"role": "user", "content": f"Write this week's brief.\n\n## Sources\n{sources_text(src)}\n\n## Lines\n{lines_text(entries)}"}]


def make_model(model: str, effort: str | None, base_url: str | None = None, api_key: str | None = None, max_tokens: int = MAX_TOKENS):
    """The drafter's model: ChatAnthropic, structured output by the API's JSON schema, raw message kept."""
    from langchain_anthropic import ChatAnthropic
    kw = dict(model=model, max_tokens=max_tokens, max_retries=2, streaming=True)   # no cache_control: see the module note
    if effort:
        kw["effort"] = effort
    if base_url:
        kw["base_url"] = base_url
    if api_key:
        kw["api_key"] = api_key
    llm = ChatAnthropic(**kw)
    return llm.with_structured_output(OUTPUT_SCHEMA, method="json_schema", include_raw=True)


def _claim_back(c: dict) -> dict:
    if c.get("kind") == "change":
        return {"kind": "change", "metric": c.get("metric", ""), "new_ref": c.get("new_ref", ""), "new_value": c.get("new_value", ""), "old_ref": c.get("old_ref", ""), "old_value": c.get("old_value", "")}
    return {"kind": c.get("kind"), "ref": c.get("ref", ""), "value": c.get("value", "")}


def to_sections(draft: dict) -> dict:
    """The flat reply as draft_brief takes it: the five sections in order, each sentence's order kept,
    each claim with only the fields its kind uses (the shape the server's schema and SKILL.md give)."""
    out = {k: [] for k in SECTIONS}
    for s in draft.get("sentences", []):
        out[s["section"]].append({"text": s["text"], "claims": [_claim_back(c) for c in s.get("claims", [])]})
    return out


if __name__ == "__main__":
    s, v = instructions()
    print(f"instructions {v}, {len(s)} characters, sha {sha12(s)}; copy check: {check_copies() or 'ok'}")
    print(json.dumps(OUTPUT_SCHEMA)[:200], "...")
