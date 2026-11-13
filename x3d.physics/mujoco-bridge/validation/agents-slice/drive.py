"""Drive the x3d_mcp bridge tools over stdio, exactly as an MCP client (an agent) does.

Run: ~/Projects/x3d/x3d_mcp/.venv/bin/python drive.py
Writes calls.json (every request and response) and the files the tools produce.
"""
import asyncio
import json
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

HERE = Path(__file__).resolve().parent
HOME = Path.home()
SERVER = HOME / "Projects/x3d/x3d_mcp-agents-slice/src/server.py"
SCENE = HOME / "Projects/x3d/work/x3d-mujoco-bridge/bridge/samples/contact-arm.x3d"


async def main():
    log = []
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER)])
    async with stdio_client(params) as (r, w), ClientSession(r, w) as s:
        init = await s.initialize()
        tools = [t.name for t in (await s.list_tools()).tools]
        log.append({"server": init.serverInfo.name, "toolsListed": len(tools),
                    "bridgeTools": [t for t in tools if t in ("validate_scene", "mjcf_to_x3d", "simulate")]})

        async def call(name, args):
            res = await s.call_tool(name, args)
            out = json.loads(res.content[0].text)
            log.append({"call": name, "arguments": args, "response": out})
            return out

        conv = await call("mjcf_to_x3d", {"path": str(HERE / "pendulum.xml"), "keyframe": "tilted"})
        (HERE / "pendulum.x3d").write_text(conv["x3d"])
        await call("validate_scene", {"content": conv["x3d"]})
        await call("simulate", {"path": str(HERE / "pendulum.xml"), "keyframe": "tilted", "steps": 1000,
                                "max_returned_samples": 5})
        out = HERE / "agent-trial.zip"
        out.unlink(missing_ok=True)
        await call("simulate", {"path": str(SCENE), "package_out": str(out), "max_returned_samples": 5})
        await call("validate_scene", {"path": str(out)})
        await call("simulate", {"content": '<mujoco><include file="/etc/passwd"/></mujoco>'})  # must be refused
    # Keep the log readable: drop the long X3D text from the stored response (it is saved as pendulum.x3d).
    for e in log:
        if e.get("call") == "mjcf_to_x3d":
            e["response"]["x3d"] = f"<{len(e['response']['x3d'])} characters, saved as pendulum.x3d>"
    (HERE / "calls.json").write_text(json.dumps(log, indent=2, ensure_ascii=False))
    for e in log:
        if "call" not in e:
            print(e)
            continue
        r = e["response"]
        brief = r.get("error") or {k: r[k] for k in ("valid", "kind", "source", "steps", "controller", "losses", "package", "bridge") if k in r}
        if "trial" in r:
            brief["final_qpos"] = r["trial"]["metrics"]["finalQpos"]
            brief["peakContacts"] = r["trial"]["metrics"]["peakContacts"]
        if "validation" in r:
            brief["validation"] = {"xsd": r["validation"]["xsd"]["valid"], "semanticErrors": r["validation"]["semantic"]["errors"]}
        print(e["call"], json.dumps(brief, ensure_ascii=False)[:700])


asyncio.run(main())
