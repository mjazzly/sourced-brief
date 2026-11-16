"""WORK-10: a local stand-in for the Messages API, for the mock and for stage 0's request capture.
No request leaves the machine. Runs as its own process, so the graph process never opens
eval/expected/.

  --mode mock     the scripted drafter, as eval/mock.js: returns the case's expected sentences (and the
                  planted trap where the case has one) and the stop the case's gate calls for. Reads
                  eval/expected/, which is why it is a separate process from the graph.
  --mode capture  returns an empty draft; reads nothing. Stage 0 uses it to record the exact request
                  the draft node sends, which it then counts.

Every request body is written, as received, to <record dir>/<case>.request.json.
POST /mock/case {"case": "02_disagreement"} names the brief the next request belongs to.

  python mock_model.py --mode mock --record <dir>      (prints "port <n>" when ready)
"""
from __future__ import annotations

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTIONS = ["what_moved", "what_is_due", "what_changed", "decisions", "open_questions"]
STOP_TEXT = {   # the texts of eval/mock.js
    "disagreement": "tracker.csv A005 is due 2026-11-04; project_note.md gives 6 November for the same action.",
    "no_source": "No document this week carries a decision line and no source disagrees with another, so What needs a decision has nothing to cite.",
    "arithmetic": "The project note asks for the Q3 returns rate; the answer blocks give orders and returns for Q3 and no block gives the rate.",
    "confidential": "supplier_note.md is marked confidential on its first line and was declined.",
}


def scripted(case: str) -> dict:
    exp = {p.stem: json.loads(p.read_text()) for p in (ROOT / "eval" / "expected").glob("*.json")}
    e = exp[case]
    base = e if e.get("sentences") else exp[e["based_on"]]
    allsent = [*base["sentences"], *base.get("mock_extra", [])]
    fields = ["kind", "ref", "value", "metric", "new_ref", "new_value", "old_ref", "old_value"]
    # the flat form the graph's schema asks for: section order, then each sentence's own order
    sentences = [{"section": k, "text": s["text"], "claims": [{f: str(c.get(f, "")) for f in fields} for c in s["claims"]]} for k in SECTIONS for s in allsent if s["section"] == k]
    gate = base.get("gate") if e.get("sentences") else None
    return {"stops": [{"reason": gate, "text": STOP_TEXT[gate]}] if gate else [], "sentences": sentences}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["mock", "capture"], required=True)
    ap.add_argument("--record", required=True)
    ap.add_argument("--truncate", help="end this case's reply on max_tokens with the JSON cut off, to test the runner's guard")
    a = ap.parse_args()
    rec = Path(a.record)
    rec.mkdir(parents=True, exist_ok=True)
    state = {"case": None, "n": 0}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _json(self, code, obj):
            b = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(b)))
            self.send_header("request-id", f"req_mock_{state['n']}")
            self.end_headers()
            self.wfile.write(b)

        def _sse(self, req, text, stop):
            """The Messages API's streamed reply: message_start, one text block in deltas, message_delta with the stop reason and the usage, message_stop."""
            zero = {"input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}
            events = [("message_start", {"type": "message_start", "message": {"id": f"msg_mock_{state['n']}", "type": "message", "role": "assistant", "model": req.get("model"), "content": [], "stop_reason": None, "stop_sequence": None, "usage": zero}}),
                      ("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}})]
            for i in range(0, len(text), 2000):
                events.append(("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text[i:i + 2000]}}))
            events += [("content_block_stop", {"type": "content_block_stop", "index": 0}),
                       ("message_delta", {"type": "message_delta", "delta": {"stop_reason": stop, "stop_sequence": None}, "usage": zero}),
                       ("message_stop", {"type": "message_stop"})]
            self.send_response(200)
            self.send_header("content-type", "text/event-stream")
            self.send_header("request-id", f"req_mock_{state['n']}")
            self.end_headers()
            for name, data in events:
                self.wfile.write(f"event: {name}\ndata: {json.dumps(data)}\n\n".encode())
            self.wfile.flush()

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("content-length", 0)))
            if self.path == "/mock/case":
                state["case"] = json.loads(body)["case"]
                return self._json(200, {"ok": True})
            if self.path.startswith("/v1/messages"):
                state["n"] += 1
                case = state["case"] or "unknown"
                (rec / f"{case}.request.json").write_bytes(body)
                draft = scripted(case) if a.mode == "mock" else {"stops": [], "sentences": []}
                req = json.loads(body)
                text, stop = json.dumps(draft), "end_turn"
                if a.truncate and case == a.truncate:
                    text, stop = text[: len(text) // 2], "max_tokens"
                if req.get("stream"):
                    return self._sse(req, text, stop)
                return self._json(200, {"id": f"msg_mock_{state['n']}", "type": "message", "role": "assistant", "model": req.get("model"),
                                        "content": [{"type": "text", "text": text}], "stop_reason": stop, "stop_sequence": None,
                                        "usage": {"input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}})
            return self._json(404, {"type": "error", "error": {"type": "not_found_error", "message": self.path}})

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    print(f"port {srv.server_address[1]}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
