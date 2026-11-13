# Deploying the X3D ⇄ MuJoCo bridge 0.2.0

The app is a **static website**: one `index.html` (MuJoCo's WebAssembly is inside it) plus the `vendor/` folder (X_ITE) and `legal/`. There is no server code, no database and no build step. All physics runs in the visitor's browser.

| You want | Do this |
|---|---|
| To try it on your own computer | §1 |
| A public website | §2 |
| AI assistants to use it | §4 |
| Thousands of simulations on a GPU | §5 |

## 1. Run it locally (no install beyond Python 3)

```bash
python3 start.py
```

- Windows: double-click `START-Windows.cmd`.
- WSL: run `./START-WSL.sh`, then open the printed address in a browser.

The browser opens the **guided tour**. The full lab is at `?lab=1` and the original workbench at `?workspace=1`. The launcher only serves files on `127.0.0.1`. It has to be served over http: opening `index.html` straight from disk (`file://`) won't load the 3D runtime.

## 2. Host it as a static website

Upload the **contents of `dist/`** to any static host, keeping the folder structure. Every path inside is relative, so it also works in a sub-folder (`https://example.org/bridge/`).

| Host | Steps |
|---|---|
| GitHub Pages | Put the contents of `dist/` in the Pages branch or folder. |
| Netlify / Cloudflare Pages | Drag the `dist/` folder into the dashboard ("deploy manually"). |
| S3 + CloudFront, or any CDN | Upload `dist/` and point the distribution at `index.html`. |
| nginx | `root /srv/bridge/dist;`, plus the snippet below. |

Recommended headers (the app works without them; they make it fast):

```nginx
gzip on; gzip_types text/html application/javascript text/css application/json;   # index.html: 30 MB → ~8 MB
location = /index.html { add_header Cache-Control "no-cache"; }
location /vendor/      { add_header Cache-Control "public, max-age=31536000, immutable"; }
types { font/woff2 woff2; application/wasm wasm; }
```

Size: about 30 MB for `index.html` (8 MB compressed) plus 21 MB in `vendor/`, of which a visitor loads only the parts in use. Requirements: any current browser with WebGL 2. This release was tested in Chromium 145, Firefox 146 and WebKit 26.

Privacy: the site makes no third-party requests. The fonts come from `vendor/`, and nothing a visitor does is sent anywhere.

## 3. Check what you deploy

`SHA256SUMS.txt` lists a hash for every file in this package. Check them with:

```bash
shasum -a 256 -c SHA256SUMS.txt
```

The evidence for this release is in `reports/`:

- `GATE-0.md`: what was tested, with numbers.
- `LICENSE-REVIEW.md`, `THREAT-MODEL.md`.
- `AGENTS-SLICE.md`: the MCP tools.

## 4. AI assistants: the MCP tools

The tools `validate_scene`, `mjcf_to_x3d` and `simulate` live in the x3d_mcp server. `mcp/x3d_mcp-bridge-tools.patch` adds them to a checkout of x3d_mcp:

```bash
cd x3d_mcp && git am /path/to/mcp/x3d_mcp-bridge-tools.patch
pip install -e '.[bridge]'          # MuJoCo 3.17.0, the same engine as the browser build
a hosted model mcp add x3d-bridge -- python "$PWD/src/server.py"
```

## 5. GPU sweeps (sketch)

Upload `gpu/mujoco_bridge_gpu.ipynb` to Google Colab, choose a GPU runtime, and run the cells top to bottom with `PROFILE = "smoke"`. Its doctor cell must be all ✅ before larger profiles. **It has not been run on a GPU yet.**

## 6. From here to planet scale

This release is phase 0 plus the agents slice: local only, by design. The guided tour's §6 (and `PLAN.md` in the project folder) draws the route:

- phase 1: any robot model, exact replay;
- phase 2: SDKs and transports;
- phase 3: a hosted beta with a CDN, a stateless API, sandboxed jobs and storage;
- phase 4: multiple regions, a metered GPU queue and an open registry.

Step 2 above is already the first box of the phase 3 drawing: the app is static, so a CDN can serve it to any number of visitors without new code.

## Licence

Apache-2.0 (`LICENSE`); third-party notices in `NOTICE` and `THIRD_PARTY_NOTICES.txt` (copies in `dist/legal/`).
