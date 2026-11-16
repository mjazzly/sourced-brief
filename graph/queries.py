"""WORK-10, decision 6: the fixed section queries, their hash, and the one tokenizer that both the
keyword index (arm K) and the queries use. Standard library only.

The templates live in graph/queries.json and were fixed, and their hash written into
WORK-10-DESIGN.md, before any recall was measured. Nothing here reads eval/expected/.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
QUERIES_FILE = HERE / "queries.json"
SECTIONS = ["what_moved", "what_is_due", "what_changed", "decisions", "open_questions"]

# ids kept whole: run ids (R2026-10-30-1, N2026-10-29-1), answer ids (D202610300900-Q03),
# action ids (A005), ISO dates (2026-10-30); then any other run of letters and digits
_ID = r"[A-Za-z]{1,3}\d{4}(?:-\d{2}-\d{2}-\d+|\d*(?:-[A-Za-z0-9]+)+)|\bA\d{3}\b|\b\d{4}-\d{2}-\d{2}\b"
_TOKEN = re.compile(rf"(?:{_ID})|[A-Za-z0-9]+")


def tokenize(text: str) -> list[str]:
    """Lowercase; ids and ISO dates kept whole; every other token split on non-alphanumerics."""
    return [t.lower() for t in _TOKEN.findall(text or "")]


def load() -> dict:
    return json.loads(QUERIES_FILE.read_text(encoding="utf8"))


def queries_hash(q: dict | None = None) -> str:
    """sha256 of the version, tokenizer and templates, canonical JSON (sorted keys, no spaces)."""
    q = q or load()
    canon = json.dumps({"tokenizer": q["tokenizer"], "templates": q["templates"], "version": q["version"]},
                       sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canon.encode("utf8")).hexdigest()


def fill(week_ending: str, latest_run: str, q: dict | None = None) -> dict[str, str]:
    """The five queries for one brief, from list_sources' week ending and latest tracker run."""
    q = q or load()
    return {k: q["templates"][k].format(week_ending=week_ending, latest_run=latest_run) for k in SECTIONS}


if __name__ == "__main__":
    q = load()
    print(f"queries v{q['version']} hash {queries_hash(q)}")
    for k, v in fill("2026-10-30", "R2026-10-30-1", q).items():
        print(f"  {k:15} {v!r} -> {tokenize(v)}")
