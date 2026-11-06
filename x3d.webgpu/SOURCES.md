# Sources

Date 2026-11-06. Status: every source behind this folder, grouped by the file that leans on it most, with how it was read and its as-of date. A source used by several files is listed once, with the others under "also".

How a source was read:
- **opened**: fetched with `curl` (registry.npmjs.org, raw.githubusercontent.com, the Web3D SVN mirror on SourceForge, arxiv.org/abs, pypi.org, index.crates.io, en.wikipedia.org with `action=raw`) and read, grepped or parsed with `python3 -I`. Tarballs were unpacked and never executed.
- **measured**: run here with a named instrument (Playwright and headless Chromium, `gzip -9`, `sha256sum`, a WebGL or WebGPU spy).
- **local**: a file in this repository or a sibling project clone.
- **search only**: seen only through a server-side web search paraphrase. Facts resting on it are S, and the URL needs a hand fetch (the host was blocked: github.com pages, web3d.org, developer.chrome.com, babylonjs.com, castle-engine.io and others).
- **notes**: the project's private notes. Background only, graded S unless re-measured; not published.

All research and the adversarial re-check (43 claims, 42 verdict rows, 4 refuted, 9 regraded) ran on 2026-11-06.

## STATE.md

| source | where | how | as of | also |
|---|---|---|---|---|
| x_ite npm metadata (`.time`, maintainers, 305 versions) | registry.npmjs.org/x_ite | opened | 2026-11-06 | PATHS, ARCHITECTURE, BENCHMARK |
| x_ite 16.7.0 tarball: `dist/x_ite.js`, `x_ite.min.js`, `x_ite.d.ts`, `X3DUOM.xml`, `assets/components/*.js`, `assets/lib` | registry.npmjs.org/x_ite/-/x_ite-16.7.0.tgz | opened (grep, wc, gzip, python3 -I) | 2026-10-31 release | all files |
| X_ITE README, `docs/_config.yml`, `docs/_posts/what's-new.md`, `features.md`, `reference/browser-services.md`, GaussianSplats docs | raw.githubusercontent.com/create3000/x_ite/main/... | opened | 2026-11-06 | HYPER |
| X_ITE `development` branch `package.json` and `Context.js`; `webgpu` branch probe (404) | raw.githubusercontent.com/create3000/x_ite/development/... | opened | 2026-11-06 | |
| X_ITE `SupportedProfiles.js` | raw.githubusercontent.com/create3000/x_ite/main/src/x_ite/Configuration/SupportedProfiles.js | opened | 2026-11-06 | SPEC section 4 |
| GitHub search counts for create3000/x_ite (webgpu issues, PRs, commits, code; webgl controls) | GitHub search API | opened (search endpoints) | 2026-11-06 | |
| x3d-public "GPU APIs and X3D" (2023-07), "WebGPU available major browsers" (2026-01), "webgl-vs-webgpu-explained" (2026-04), "Vulcan, Metal, WebGPU impact on x3d NG" (2019-05) | web3d.org/pipermail/x3d-public_web3d.org/ | search only | 2026-11-06 | SPEC TBD-20 |
| x3dom npm metadata and 1.8.3 tarball; master `package.json` and CHANGELOG | registry.npmjs.org/x3dom; raw.githubusercontent.com/x3dom/x3dom/master/ | opened | 2026-11-06 | |
| sunrize, x3d-tidy, x3d-image, x_ite-node, three-x3d-loader, @es3d/es3d npm metadata and READMEs | registry.npmjs.org | opened | 2026-11-06 | |
| npm search (`x3d`, `three x3d`, `babylon x3d`, `keywords:x3d`) | registry.npmjs.org/-/v1/search | opened | 2026-11-06 | |
| x3d.py on PyPI and wheel 4.0.65.8 | pypi.org/pypi/x3d/json | opened | 2026-11-01 release | |
| Castle Game Engine README, cge-www `roadmap.adoc` and `web.adoc`, Castle Model Viewer README | raw.githubusercontent.com/castle-engine/... | opened | 2026-11-06 | PATHS |
| Castle Game Engine 7.0-alpha.3 release notes | castle-engine.io/release_7.0-alpha.3 | search only | 2026-11-06 | |
| Titania and Sunrize READMEs | raw.githubusercontent.com/create3000/titania, /sunrize | opened | 2026-11-06 | |
| FreeWRL files RSS | sourceforge.net/projects/freewrl/rss | opened | 2026-11-06 | |
| Instant Reality 2.5.1 news item | web3d.org/node/1878 | search only | 2026-11-06 | |
| X3DUOM 4.0 (md5 2159fd2d) and 4.1 (md5 5d81124d), both generated 2026-10-31; `x3d-4.1.xsd` | sourceforge.net/p/x3d/code/HEAD/tree/www.web3d.org/specifications/ | opened (ElementTree) | r40447 at 2026-11-06 22:16 | SPEC, PATHS, ARCHITECTURE, HYPER |
| Web3D SVN log and `x3d/tools` listing | sourceforge.net/p/x3d/code/HEAD/log/?path=/www.web3d.org | opened | 2026-11-06 | |
| ISO/IEC 19775-1:2023 listing; 19776-5 WD1 JSON draft; X3D standards progress | scc-ccn.ca; web3d.org | search only | 2026-11-06 | SPEC TBD-23 |
| Wikipedia: X3D | en.wikipedia.org (action=raw) | opened | 2026-11-06 | |
| three npm metadata; tarballs 0.185.0, 0.186.0, 0.187.0 | registry.npmjs.org/three | opened (find, du, wc, gzip -9) | 0.187.0 of 2026-10-30 | PATHS, BENCHMARK |
| three.js dev: `examples/files.json`, `WebGPURenderer.js`, `GLTFLoader.js`, `transpiler/GLSLDecoder.js`, `StandardNodeLibrary.js` | raw.githubusercontent.com/mrdoob/three.js/dev/ | opened | 2026-11-06 | PATHS |
| @babylonjs/core 9.35.0 and @babylonjs/loaders 9.35.0 tarballs; babylonjs 9.35.0 UMD | registry.npmjs.org | opened | 2026-11-06 release | PATHS, BENCHMARK, BABYLON.md |
| playcanvas 2.23.3, @sparkjsdev/spark 2.4.0, @needle-tools/engine 6.0.0-alpha.7, @google/model-viewer 4.4.0 tarballs; filament npm | registry.npmjs.org | opened | 2026-11-06 | |
| Filament README and RELEASE_NOTES | raw.githubusercontent.com/google/filament/main/ | opened | 2026-11-06 | |
| Godot `version.py` and `platform/web/detect.py` | raw.githubusercontent.com/godotengine/godot/master/ | opened | 2026-11-06 | |
| Bevy crates and tags (0.20.0 of 2026-10-08, 0.20.1 of 2026-10-28; tag v0.20.1 `Cargo.toml`) | index.crates.io; raw.githubusercontent.com/bevyengine/bevy/v0.20.1/ | opened | 2026-11-06 | ARCHITECTURE |
| Unity 6.6 WebGPU, Babylon 9.0, Bevy 0.19, PlayCanvas splat LOD, Unreal WebGPU coverage | secondary news and forum pages | search only | 2026-11-06 | |
| GodotCon Boston 2026 WebGPU backend talk | talks.godotengine.org | search only | 2026-11-06 | |
| gpuweb Implementation-Status wiki | raw.githubusercontent.com/wiki/gpuweb/gpuweb/Implementation-Status.md | opened | 2026-11-06 | SPEC, ARCHITECTURE, HYPER |
| WebGPU spec and WGSL spec sources (`spec/index.bs`, `wgsl/index.bs`), proposals (compatibility-mode, immediate-data, bindless, texel-buffers, pipeline-statistics-query, subgroups, primitive-index) | raw.githubusercontent.com/gpuweb/gpuweb/main/ | opened | 2026-11-06 | SPEC, PATHS |
| Chromium WebGPU blocklist `gpu/config/webgpu_blocklist_impl.cc` | raw.githubusercontent.com/chromium/chromium/main/ | opened | 2026-11-06 | ARCHITECTURE |
| Dawn `PhysicalDeviceD3D12.cpp` and `gpu_info.json` | raw.githubusercontent.com/google/dawn/main/ | opened | 2026-11-06 | |
| Wikipedia: WebGPU, Firefox version history, Safari | en.wikipedia.org (action=raw) | opened | 2026-11-06 | |
| Chrome "What's New in WebGPU" 146, 149-150, 155-156; Chrome stable dates | developer.chrome.com | search only | 2026-11-06 | SPEC TBD-27 |
| Safari 27 WGSL clip planes | secondary news | search only | 2026-11-06 | |
| webgl-dev-list thread on multi-draw-indirect | groups.google.com | search only | 2026-11-06 | |
| Babylon forum "Why WebGPU backend is slower?" | forum.babylonjs.com | search only | 2026-11-06 | SPEC R-RENDER-23 |
| sandbox WebGPU and WebGL2 probe (flag ablation, compute readback, offscreen triangle, canvas present, about:blank re-probe) | Playwright 1.63.0, Chromium 153.0.8010.12 headless, Linux; scripts not published | measured | 2026-11-06 | SPEC V-PROBE, BENCHMARK |
| owner's real-machine report (Windows, Chrome 156, Intel UHD 620, 1105x576, 59.7 fps median on Loomsong, X_ITE 16.5.1) | x3d.music `docs/FACTS.md` | local | 2026-11-03 | PATHS, BENCHMARK |
| project notes: X_ITE field guide, SAI and picking, draw measurement, splat loading hang, ecosystem state | private notes | notes | 2026-10-11 to 2026-11-02 | SPEC, HYPER |

## PATHS.md

| source | where | how | as of | also |
|---|---|---|---|---|
| glTF extension registry README | raw.githubusercontent.com/KhronosGroup/glTF/main/extensions/README.md | opened | 2026-11-06 | HYPER |
| KHR_interactivity `Specification.adoc` (status line; 135 operation names) | .../extensions/2.0/Khronos/KHR_interactivity/ | opened | 2026-11-06 | HYPER |
| KHR_gaussian_splatting README; KHR_node_selectability README | .../extensions/2.0/Khronos/ | opened | 2026-11-06 | HYPER |
| Khronos press release and blog on KHR_interactivity (public comment 2024-06, ratification submission 2026-07-16) | khronos.org | search only | 2026-11-06 | |
| KHR_gaussian_splatting ratification date (about 2026-09-03) | radiancefields.com | search only | 2026-11-06 | HYPER |
| naga README; wgpu CHANGELOG and `Cargo.toml` (trunk) | raw.githubusercontent.com/gfx-rs/wgpu/trunk/ | opened | 2026-11-06 | ARCHITECTURE, HYPER |
| WGSL reserved words | raw.githubusercontent.com/gpuweb/gpuweb/main/wgsl/wgsl.reserved.bs.include | opened | 2026-11-06 | SPEC |
| Castle Model Converter (glTF output "planned") | castle-engine.io/castle-model-converter | search only | 2026-11-06 | |
| Babylon X3D section (path G; 17.5 to 32 pw) | [BABYLON.md](BABYLON.md) | local | 2026-11-06 | SPEC, ARCHITECTURE |
| Collider feasibility (X_ITE 16.5.1: draws per USE, program counts, freeze trap, tone mapping and ComposedShader, line widths) | [../docs/COLLIDER-XITE-FEASIBILITY.md](../docs/COLLIDER-XITE-FEASIBILITY.md) | local | 2026-11-06 | SPEC, ARCHITECTURE, BENCHMARK |
| Collider HEP kit (GLSL generators, built-in counts) | [../kit/examples/hep/](../kit/examples/hep/) | local (grep) | 2026-11-06 | BENCHMARK |
| Blender X3D add-on README (TimeSensor chains to keyframes, HAnim to armature) | the x3d-blender-io clone, `README.md` | local | 2026-11-06 | |
| project notes: an earlier three.js 0.186.1 WebGPU engine with its own X3D loader (Material Odyssey), SwiftShader only | private notes | notes | 2026-10-12 | |

## ARCHITECTURE.md

| source | where | how | as of | also |
|---|---|---|---|---|
| crates.io sparse index: wgpu, naga, bevy, bevy_render, kiss3d, three-d, fyrox, rend3, x3d, vrml, vrml97, roxmltree, quick-xml, slotmap, wasm-bindgen, rquickjs, boa_engine, naga_oil, encase, gltf, ktx2, basis-universal, fontdue, glyphon, web-audio-api, hecs, bevy_ecs | index.crates.io | opened (`pubtime`) | 2026-11-06 | |
| `x3d`, `vrml`, `vrml97` 0.1.0 crate tarballs (README, Cargo.toml, line count, `data/x_ite-nodes.json`) | static.crates.io/crates/ | opened (read, not built) | 2026-10-11 release | SPEC TBD-24 |
| three-d, kiss3d, Fyrox, rend3 READMEs and Cargo files | raw.githubusercontent.com | opened | 2026-11-06 | |
| rend3 archive status; wgpu issue 1464 (wasm size); Bevy wasm sizes; vello_hybrid WebGL backend | github.com, ecosyste.ms, Reddit, bevy cheatbook | search only | 2026-11-06 | |
| Web3D example archives and ConformanceNist directory pages | sourceforge.net/p/x3d/code/HEAD/tree/www.web3d.org/x3d/content/examples/ | opened | 2026-11-06 | SPEC V-CORPUS |
| create3000/x_ite-tests `package.json` (vitest) | raw.githubusercontent.com/create3000/x_ite-tests/main/ | opened | 2026-11-06 | |
| the x3d_mcp validator fork's schemas (`x3d-4.1.xsd`, `x3d-4.1.dtd`, `X3dUnifiedObjectModel-4.1.xml`) | the x3d_mcp clone, `src/validation/schemas/` | local | 2026-11-06 | SPEC R-TETHER-06 |
| 19775-1 clause 4.4.8 event model | working knowledge; web3d.org blocked | not opened (L) | n/a | SPEC TBD-04 |

## BENCHMARK.md

| source | where | how | as of | also |
|---|---|---|---|---|
| dirac README, `docs/index.html`, `docs/manifest.json`, `serve.py` | raw.githubusercontent.com/hagopjay/dirac/main/ | opened | 2026-11-06 | |
| scene rebuild with `build_event_scene.py --look v3 --bloom` and sha256 against the manifest and `runs/hep-demo-v3-20261106/scenes.sha256` | [../kit/examples/hep/build_event_scene.py](../kit/examples/hep/build_event_scene.py) | measured (`python3 -I`, `sha256sum`) | 2026-11-06 | |
| per-frame draws and vertices, programs, frame-to-rAF ratio, timer query and adapter presence on the Dirac page mirror (66 files hash-matched) | headless Chrome for Testing 153.0.8010.12 (SwiftShader), Playwright, a WebGL2 prototype spy; scripts not published | measured | 2026-11-06 | SPEC R-SAI-03 |
| node and vertex counts of the hero scene | ElementTree counter over the rebuilt scenes | measured | 2026-11-06 | |
| look v2 frames and pile-up load numbers | [../runs/hep-demo-v2-20261106/frames/LOOK-V2.md](../runs/hep-demo-v2-20261106/frames/LOOK-V2.md) | local | 2026-11-06 | |
| look v3 | [../docs/COLLIDER-LOOK-V3.md](../docs/COLLIDER-LOOK-V3.md), [../COLLIDER.md](../COLLIDER.md) | local | 2026-11-06 | |
| stills harness (`glspy.js`, `shots.cjs`): the draws counter is cumulative | [../kit/examples/hep/render/](../kit/examples/hep/render/) | local | 2026-11-06 | |
| playwright npm metadata (1.65.0 of 2026-11-05) | registry.npmjs.org/playwright | opened | 2026-11-06 | |
| Chrome WebGPU developer features (100 µs timestamp quantisation) | developer.chrome.com/docs/web-platform/webgpu/developer-features | search only | 2026-11-06 | |
| web3dsurvey `EXT_disjoint_timer_query_webgl2` | web3dsurvey.com | search only | 2026-11-06 | |
| the owner's wish about metrics on his GPU (28 Oct) | private notes | notes (S) | 2026-10-28 | SPEC R-PERF-07, README G0 |

## HYPER.md

| source | where | how | as of | also |
|---|---|---|---|---|
| SPZ README (v4, ZSTD, "typically around 10x smaller") | raw.githubusercontent.com/nianticlabs/spz/main/README.md | opened | 2026-11-06 | |
| OpenUSD CHANGELOG (26.03 particle fields; 26.08) | raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/CHANGELOG.md | opened | 2026-11-06 | |
| gsplat, Spark, three-gpu-pathtracer, WebNN READMEs; `bevy_solari` | raw.githubusercontent.com | opened | 2026-11-06 | |
| npm metadata: splat-transform 3.10.3, spark 2.4.0, three-gpu-pathtracer 0.0.28, onnxruntime-web 1.31.1, webgpu (Dawn for Node) 0.6.2, @lookingglass/webxr 0.6.0 | registry.npmjs.org | opened | 2026-11-06 | |
| PyPI metadata: mitsuba 3.9.1, drjit 1.5.0, gsplat 1.5.3, slangpy, slangtorch, wgpu 0.33.0, pytorch3d 0.7.4 | pypi.org/pypi/ | opened | 2026-11-06 | |
| arXiv abs pages: 2308.04079, 2403.17888, 2412.12507, 2311.16493, 2003.08934, 2201.05989, 2305.17105, 2305.02678, 2406.12080, 2403.17898, 2402.00525, 2311.16043, 2311.12198, 2407.07090, 2409.06765, 2011.03277, 2007.08501, 2302.05543, 2402.15391, 2501.03575, 2501.18590, 2312.14132, 2503.11651, 2202.01284, 2408.14837, 2501.03847, 2503.03751, 2403.13064, 2312.09067, 2306.09310, 2403.01248, 2101.10994, 2310.08528, 2505.23716, 2311.12775, 2006.12057, 2503.14492 | arxiv.org/abs/ | opened (title meta) | 2026-11-06 | |
| arXiv abs pages (newer): WebSplatter 2602.03207, Visionary 2512.08478, ShadAR 2602.17481, AI Co-Artist 2512.08951, DarthShader 2409.01824, CrossTL 2508.21256, Thinking in Blender 2606.02580, WebGPU and OpenPBR path tracer 2407.19977, KoalaGS 2610.28615, LL3M 2508.08228, A LoD of Gaussians 2507.01110 | arxiv.org/abs/ | opened (title and abstract) | 2026-11-06 | STATE, SPEC |
| arXiv listing titles: 2308.01483, 2202.05977, 2407.14053, 2506.08064, 2606.00444 | arxiv.org/search | opened (titles only) | 2026-11-06 | |
| WebNN CRDs and Chrome 146 origin trial; subgroup-matrix status; WWDC 2026 visionOS Safari WebXR | w3.org, developer.chrome.com, web3dsurvey.com, developer.apple.com | search only | 2026-11-06 | |
| Loom definition, section 9.4 (video to world) | [../LOOM-v1.md](../LOOM-v1.md) | local | 2026-11-06 | |
| project notes: Splat Park v2 counts, the splat loading hang, the libxml2 wall, the Blacksburg tile | private notes | notes (S) | 2026-10-16 to 2026-10-17 | SPEC R-PARSE-11, R-SPLAT-03 |

## SPEC.md and README.md

These two files add no sources of their own: every rationale cell points at a row above through STATE.md, PATHS.md, ARCHITECTURE.md, BENCHMARK.md or HYPER.md. The adversarial verdicts that changed a grade or a number are applied in place and marked "corrected" in STATE.md.
