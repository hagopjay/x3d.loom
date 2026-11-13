#!/usr/bin/env python3
"""Assemble the release ZIPs (run from bridge/ after `npm run build`).

  python3 -I scripts/package-release.py --out ../release [--x3d-mcp ~/Projects/x3d/x3d_mcp-agents-slice]

Writes:
  X3D-MuJoCo-Bridge-<version>.zip         deployable: dist/ + launchers + docs + samples + reports + MCP patch + GPU notebook
  X3D-MuJoCo-Bridge-<version>-source.zip  `git archive` of HEAD (the open-source tree)
  SHA256SUMS.txt                          hashes of both ZIPs
The deployable ZIP carries its own SHA256SUMS.txt for every file inside. Refuses to run on a dirty tree.
"""
import argparse, hashlib, io, json, subprocess, sys, zipfile
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--out", default="../release")
ap.add_argument("--x3d-mcp", default=str(Path.home() / "Projects/x3d/x3d_mcp-agents-slice"))
args = ap.parse_args()
ROOT = Path.cwd()
version = json.loads((ROOT / "package.json").read_text())["version"]
NAME = f"X3D-MuJoCo-Bridge-{version}"
out = Path(args.out).resolve()
out.mkdir(parents=True, exist_ok=True)

def git(*a, cwd=ROOT) -> bytes:
    return subprocess.run(["git", *a], cwd=cwd, check=True, capture_output=True).stdout

if git("status", "--porcelain").strip():
    sys.exit("refusing: bridge/ has uncommitted changes; commit first so the source ZIP matches")
head = git("rev-parse", "--short", "HEAD").decode().strip()
if not (ROOT / "dist/index.html").is_file() or not (ROOT / "dist/legal/LICENSE").is_file():
    sys.exit("run `npm run build` first")

files: dict[str, bytes] = {}
def add_tree(src: Path, dest: str):
    for p in sorted(src.rglob("*")):
        if p.is_file() and p.name != ".DS_Store":
            files[f"{dest}/{p.relative_to(src).as_posix()}"] = p.read_bytes()
def add(src: str, dest: str | None = None):
    files[dest or src] = (ROOT / src).read_bytes()

add_tree(ROOT / "dist", "dist")
for f in ["start.py", "START-Windows.cmd", "START-WSL.sh", "README.md", "DEPLOY.md", "LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.txt", "PROVENANCE.json"]:
    add(f)
for f in ["GATE-0.md", "LICENSE-REVIEW.md", "THREAT-MODEL.md", "AGENTS-SLICE.md"]:
    add(f, f"reports/{f}")
add_tree(ROOT / "docs", "docs")
add_tree(ROOT / "samples", "samples")
add("gpu/mujoco_bridge_gpu.ipynb", "gpu/mujoco_bridge_gpu.ipynb")
mcp = Path(args.x3d_mcp).expanduser()
if (mcp / ".git").exists():
    patch = git("format-patch", "--stdout", "--binary", "origin/main..HEAD", cwd=mcp)
    files["mcp/x3d_mcp-bridge-tools.patch"] = patch
    mcp_head = git("rev-parse", "--short", "HEAD", cwd=mcp).decode().strip()
else:
    sys.exit(f"x3d_mcp worktree not found at {mcp}")

build = {"name": NAME, "version": version, "bridgeCommit": head, "x3dMcpCommit": mcp_head,
         "contract": "x3d-mujoco/0.1", "engines": {"MuJoCo": "3.17.0", "X_ITE": "16.7.0"},
         "indexHtmlSha256": hashlib.sha256(files["dist/index.html"]).hexdigest(), "license": "Apache-2.0"}
files["BUILD-INFO.json"] = (json.dumps(build, indent=2) + "\n").encode()
files["SHA256SUMS.txt"] = "".join(f"{hashlib.sha256(b).hexdigest()}  {n}\n" for n, b in sorted(files.items())).encode()

EXEC = {"start.py", "START-WSL.sh"}
deploy = out / f"{NAME}.zip"
with zipfile.ZipFile(deploy, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for n, b in sorted(files.items()):
        zi = zipfile.ZipInfo(f"{NAME}/{n}", date_time=(2026, 11, 7, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = (0o755 if n in EXEC else 0o644) << 16
        z.writestr(zi, b)
src = out / f"{NAME}-source.zip"
src.write_bytes(git("archive", "--format=zip", f"--prefix={NAME}-source/", "HEAD"))
sums = "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in (deploy, src))
(out / "SHA256SUMS.txt").write_text(sums)
print(json.dumps({**build, "files": len(files), "deployZip": f"{deploy} ({deploy.stat().st_size/1e6:.1f} MB)",
                  "sourceZip": f"{src} ({src.stat().st_size/1e6:.1f} MB)"}, indent=2))
