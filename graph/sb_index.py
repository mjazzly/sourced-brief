"""WORK-10: the index and the two retrievers.

One entry per document line or CSV row, carrying its reference in the server's grammar
("project_note.md line 9", "tracker.csv A007", "answers.csv D202610300900-Q03",
"decision_log.csv line 10"). Every entry comes from a read_source result, so a declined file never
reaches the index. Blank lines and CSV header lines are left out; they cannot be cited.

  K  BM25 (bm25s 0.3.16, Lucene variant, its defaults), over the tokenizer in graph/queries.py
  V  fastembed 0.9.1 with BAAI/bge-small-en-v1.5 (ONNX, 384 dimensions, local, no key), in
     langchain-core's InMemoryVectorStore; passages embedded with passage_embed, queries with query_embed

Retrieval for a brief: the top k entries for each section's fixed query, merged, deduplicated and
put back in file and line order. Nothing here reads eval/expected/.
"""
from __future__ import annotations

import csv
import io
import time
from pathlib import Path

from queries import SECTIONS, tokenize

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
EMBED_MODEL = "BAAI/bge-small-en-v1.5"


def entries_from_reads(reads: list[dict]) -> list[dict]:
    """reads: read_source results in list_sources order. Returns entries with file, ref, text, order."""
    out = []
    for fi, r in enumerate(reads):
        f = r["file"]
        if "rows" in r:   # tracker.csv, answers.csv: rows by id
            for ri, row in enumerate(r["rows"]):
                text = "; ".join(f"{k}: {v}" for k, v in row.items() if k != "ref" and v != "")
                out.append({"file": f, "ref": row["ref"], "text": text, "order": (fi, ri)})
            continue
        header = None
        for li, raw in enumerate(r["lines"]):
            n, _, line = raw.partition(": ")
            n = int(n)
            if f.endswith(".csv"):
                if n == 1:
                    header = next(csv.reader(io.StringIO(line)))
                    continue
                vals = next(csv.reader(io.StringIO(line)), [])
                if not any(v.strip() for v in vals):
                    continue
                text = "; ".join(f"{h}: {v}" for h, v in zip(header or [], vals) if v != "")
            else:
                if not line.strip():
                    continue
                text = line
            out.append({"file": f, "ref": f"{f} line {n}", "text": text, "order": (fi, li)})
    return out


def in_file_order(entries: list[dict]) -> list[dict]:
    return sorted(entries, key=lambda e: e["order"])


class Keyword:
    name = "bm25"

    def __init__(self, entries: list[dict]):
        import bm25s
        t0 = time.perf_counter()
        self.entries = entries
        self.bm = bm25s.BM25()
        self.bm.index([tokenize(e["text"]) for e in entries], show_progress=False)
        self.seconds = time.perf_counter() - t0

    def top(self, query: str, k: int) -> list[dict]:
        k = min(k, len(self.entries))
        ids, _ = self.bm.retrieve([tokenize(query)], k=k, show_progress=False)
        return [self.entries[int(i)] for i in ids[0]]


class _FastEmbed:
    """langchain-core Embeddings over fastembed, built lazily so K never loads the model."""

    def __init__(self):
        from fastembed import TextEmbedding
        self.model = TextEmbedding(model_name=EMBED_MODEL, cache_dir=str(MODELS))

    def embed_documents(self, texts):
        return [v.tolist() for v in self.model.passage_embed(list(texts))]

    def embed_query(self, text):
        return next(iter(self.model.query_embed([text]))).tolist()


_EMBED = None


def embedder():
    global _EMBED
    if _EMBED is None:
        from langchain_core.embeddings import Embeddings

        class FastEmbedEmbeddings(Embeddings):
            def __init__(self):
                self.inner = _FastEmbed()

            def embed_documents(self, texts):
                return self.inner.embed_documents(texts)

            def embed_query(self, text):
                return self.inner.embed_query(text)

        _EMBED = FastEmbedEmbeddings()
    return _EMBED


class Vector:
    name = "vector"

    def __init__(self, entries: list[dict]):
        from langchain_core.vectorstores import InMemoryVectorStore
        t0 = time.perf_counter()
        self.entries = entries
        self.store = InMemoryVectorStore(embedding=embedder())
        self.store.add_texts([e["text"] for e in entries], metadatas=[{"i": i} for i in range(len(entries))], ids=[str(i) for i in range(len(entries))])
        self.seconds = time.perf_counter() - t0

    def top(self, query: str, k: int) -> list[dict]:
        hits = self.store.similarity_search_with_score(query, k=min(k, len(self.entries)))
        return [self.entries[d.metadata["i"]] for d, _ in hits]


def retrieve(retriever, queries: dict[str, str], k: int) -> tuple[list[dict], dict[str, list[str]]]:
    """The merged lines in file order, and the references each section's query returned, in rank order."""
    by_section, seen = {}, {}
    for s in SECTIONS:
        hits = retriever.top(queries[s], k)
        by_section[s] = [e["ref"] for e in hits]
        for e in hits:
            seen[e["ref"]] = e
    return in_file_order(list(seen.values())), by_section


# ---------- arm F: filter by week (added after stage 0's finding) ----------
# A file's week is read from its own content as read_source returns it, never from its name:
#   a document: the first line carrying "week ending <yyyy-mm-dd>" (the title line)
#   a CSV: the latest run id (R<date>-n, N<date>-n, D<yyyymmdd><hhmm>) or timestamp (<date>T<time>) in
#   its rows, and the week is the one ending on the Friday on or after that date
#   the fallback, for a CSV with no run id and no timestamp: the latest date (yyyy-mm-dd) in its rows,
#   to the Friday on or after it (Megat, 16 Nov 2026; in this data it applies to merged.csv only)
import re as _re
from datetime import date as _date, timedelta as _td

_WEEK_LINE = _re.compile(r"week ending (\d{4}-\d{2}-\d{2})")
_RUN = _re.compile(r"\b[RN](\d{4}-\d{2}-\d{2})-\d+\b")
_ANS = _re.compile(r"\bD(\d{4})(\d{2})(\d{2})\d{4}\b")
_STAMP = _re.compile(r"\b(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}")
_DATE = _re.compile(r"(?<![\w-])(\d{4}-\d{2}-\d{2})(?![\w-])")


class WeekUnreadable(Exception):
    pass


def _friday_on_or_after(iso: str) -> str:
    d = _date.fromisoformat(iso)
    return (d + _td(days=(4 - d.weekday()) % 7)).isoformat()


def file_week(read: dict) -> tuple[str, str]:
    """(week ending, how it was read) for one read_source result; raises WeekUnreadable."""
    f = read["file"]
    if f.endswith(".md"):
        for raw in read.get("lines", []):
            n, _, line = raw.partition(": ")
            m = _WEEK_LINE.search(line)
            if m:
                return m.group(1), f"line {n}: \"week ending {m.group(1)}\""
        raise WeekUnreadable(f"{f}: no line carries \"week ending <date>\"")
    values = []
    if "rows" in read:
        for row in read["rows"]:
            values += [str(v) for k, v in row.items() if k != "ref"]
    else:
        values = [raw.partition(": ")[2] for raw in read.get("lines", [])[1:]]
    dates = []
    for v in values:
        dates += [(m.group(1), "run id") for m in _RUN.finditer(v)]
        dates += [(f"{m.group(1)}-{m.group(2)}-{m.group(3)}", "answer id") for m in _ANS.finditer(v)]
        dates += [(m.group(1), "timestamp") for m in _STAMP.finditer(v)]
    if not dates:   # the fallback: the latest plain date in its rows
        dates = [(m.group(1), "date in its rows (fallback: no run id or timestamp)") for v in values for m in _DATE.finditer(v)]
    if not dates:
        raise WeekUnreadable(f"{f}: no run id, timestamp or date in its rows")
    latest, kind = max(dates)
    return _friday_on_or_after(latest), f"latest {kind} {latest}"


def weeks_of(reads: list[dict]) -> tuple[dict, list[str]]:
    """{file: (week, how)} for every read, and the files whose week could not be read."""
    out, bad = {}, []
    for r in reads:
        try:
            out[r["file"]] = file_week(r)
        except WeekUnreadable as e:
            bad.append(str(e))
    return out, bad


def by_week(entries: list[dict], weeks: dict, week_ending: str) -> list[dict]:
    """Every entry from files of the current week and the week before it, in file and line order."""
    keep = {week_ending, (_date.fromisoformat(week_ending) - _td(days=7)).isoformat()}
    return in_file_order([e for e in entries if weeks[e["file"]][0] in keep])
