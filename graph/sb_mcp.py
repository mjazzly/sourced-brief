"""WORK-10, decision 7: the graph's client for the existing tool server (server.js), unchanged.

One server process per brief, started on that brief's copy of the week folder, with
SOURCED_BRIEF_DATA and SOURCED_BRIEF_RUN_ID in its environment, and one session held open for every
call of the brief. Two routes:

  adapter  langchain.mcp.MCPAdapter (beta, langchain[mcp] 1.5.0) over an MCPConfig stdio entry with
           command, args and env; its context held open for the whole brief; tools called as
           LangChain tools with a tool call, so the result is a ToolMessage (status "error" when the
           server reports isError)
  sdk      the official mcp 2.3.0 SDK: Client(StdioServerParameters(command, args, env)), call_tool

The mock gives the adapter route one attempt and decides from run_log.csv: one "load" line per
brief (each server.js process writes one when it opens the folder), case_id on every line after
set_case, and the run id the runner passed. server.js reports no process id, and stays unchanged.
"""
from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SERVER = ROOT / "server.js"
ROUTES = ["adapter", "sdk"]


def node_path() -> str:
    p = shutil.which("node")
    if not p:
        raise RuntimeError("node is not on PATH; the tool server is a Node program")
    return p


class ToolServer:
    """async with ToolServer(data_dir, run_id, route) as s: text, is_error = await s.call(name, args)"""

    def __init__(self, data_dir: Path, run_id: str, route: str = "adapter"):
        if route not in ROUTES:
            raise ValueError(f"route must be one of {ROUTES}")
        self.data_dir, self.run_id, self.route = Path(data_dir), run_id, route
        self.env = {"SOURCED_BRIEF_DATA": str(self.data_dir), "SOURCED_BRIEF_RUN_ID": run_id}
        self.calls = 0
        self._tools: dict = {}
        self._ctx = None

    async def __aenter__(self):
        if self.route == "adapter":
            from langchain.mcp import MCPAdapter
            cfg = {"mcpServers": {"sourced_brief": {"command": node_path(), "args": [str(SERVER)], "env": self.env, "cwd": str(ROOT)}}}
            self._ctx = MCPAdapter(cfg)
            await self._ctx.__aenter__()
            self._tools = {t.name: t for t in await self._ctx.list_tools()}
        else:
            from mcp import Client, StdioServerParameters
            params = StdioServerParameters(command=node_path(), args=[str(SERVER)], env=self.env, cwd=str(ROOT))
            self._ctx = Client(params)
            self._client = await self._ctx.__aenter__()
            res = await self._client.list_tools()
            self._tools = {t.name: t for t in res.tools}
        return self

    async def __aexit__(self, *exc):
        if self._ctx is not None:
            await self._ctx.__aexit__(*exc)
            self._ctx = None

    def tool_names(self) -> list[str]:
        return sorted(self._tools)

    async def tool_defs(self) -> list[dict]:
        """The server's tools as the Messages API takes them (name, description, input_schema), list order kept."""
        if self.route == "adapter":
            remote = await self._ctx.client.list_tools()
        else:
            remote = (await self._client.list_tools()).tools
        out = []
        for t in remote:
            schema = getattr(t, "input_schema", None) or getattr(t, "inputSchema", None) or {"type": "object", "properties": {}}
            out.append({"name": t.name, "description": t.description or "", "input_schema": schema})
        return out

    async def call(self, name: str, args: dict) -> tuple[str, bool]:
        self.calls += 1
        if self.route == "adapter":
            tool = self._resolve(name)
            msg = await tool.ainvoke({"type": "tool_call", "name": tool.name, "args": args, "id": f"call_{uuid.uuid4().hex[:12]}"})
            return _text(msg.content), getattr(msg, "status", "success") == "error"
        res = await self._client.call_tool(name, args)
        text = "\n".join(getattr(b, "text", "") for b in res.content if getattr(b, "type", "") == "text")
        return text, bool(getattr(res, "is_error", False))

    async def call_json(self, name: str, args: dict) -> dict:
        text, err = await self.call(name, args)
        if err:
            raise RuntimeError(f"{name}: {text}")
        return json.loads(text)

    def _resolve(self, name: str):
        if name in self._tools:
            return self._tools[name]
        hits = [t for n, t in self._tools.items() if n.endswith(f"_{name}")]   # a server prefix, if the config adds one
        if len(hits) == 1:
            return hits[0]
        raise KeyError(f"no tool {name}; the server offers {sorted(self._tools)}")


def _text(content) -> str:
    if isinstance(content, str):
        return content
    parts = []
    for b in content or []:
        if isinstance(b, dict) and b.get("type") == "text":
            parts.append(b.get("text", ""))
        elif isinstance(b, str):
            parts.append(b)
    return "\n".join(parts)
