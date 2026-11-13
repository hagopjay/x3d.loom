# X3D ⇄ MuJoCo bridge: from prototype to planet scale

Plan written 2026-11-05 from the four files in `~/Downloads` (unpacked unchanged in `incoming/`): `X3D-MuJoCo-Proto-Bridge.zip` (bridge 0.1), `MuJoCo-Control-Contact-Lab.zip` (the learning workbench it grew from), `Contact-Arm-Bridge.x3d` (an exported scene) and `MuJoCo-Control-Contact-Lab.html` (the single-file build).
Grades as elsewhere: **Measured** (checked here), **Stated** (the package says so, not re-run here), **Estimate** (my arithmetic), **Conjecture**.

---

## 0. Decisions (2026-11-05, from the user)

- **First users: all four** (robotics researchers, X3D authors, agents, educators). The plan serves them as four thin slices on one shared contract, in the order their dependencies allow:
  1. **Agents** first (cheapest, and it exercises everything): the MCP tools over the contract.
  2. **Robotics researchers**: `mjcf-core/1` and the MuJoCo Menagerie loss scoreboard.
  3. **X3D authors**: RigidBodyPhysics and H-Anim profiles.
  4. **Educators**: the existing learning workbench rebuilt on the general contract (lessons, quizzes, shareable experiments).
  Each slice ships a demo and a conformance test; none waits for the others to be complete.
- **Open source from the start**: a public repository under Apache-2.0, created once the phase 0 licence review clears X_ITE and the salvaged workbench material (the repository goes public then, not before).
- **The MCP server lives inside the `x3d_mcp` fork**: X3D validation and physics share one agent surface.
- **Year one is local only** (browser, CLI, MCP over stdio): no hosted API, no accounts, no servers. Phases 3 and 4 below stay as the roadmap for later.
- **The GPU tier is in year one, without hosting**: batched GPU rollouts (MJX on JAX, or MuJoCo Warp) run as a Colab notebook on your Colab Pro G4, the same pattern as the jepa-bridge runs (a self-contained notebook, profiles from smoke to full, results to your Drive), fed and read back through the experiment-package format.

## 1. Where the prototype stands

| | | grade |
|---|---|---|
| Contract `x3d-mujoco/0.1`, physical profile `contact-arm/1` (two-hinge arm, tip-obstacle contact) | `docs/BRIDGE-CONTRACT.md`, JSON Schemas for recipe and command | Stated |
| Authority split: MuJoCo owns dynamics and observations; X3D owns presentation, selection, drag input and authoring intent; structural edits recompile and reset, targets keep state | the core idea, and the right one | Stated |
| Commands with ids, expected model revision, idempotent acknowledgements, stale-revision rejection (`target.set`, `model.replace`, `transport.set`, `reset`, `step`) | local synchronous dispatcher only; no network transport | Stated |
| Coordinates: MuJoCo Z-up wxyz to X3D Y-up axis-angle via a proper change of basis | tested against three.js | Stated |
| Portable `.x3d` (standard X3D 4.0 Interactive, physics in `MetadataSet`, stable logical ids) and an experiment ZIP (manifest, scene, MJCF, observations, commands, trial) | `Contact-Arm-Bridge.x3d` is one | Measured (read) |
| Curated importer: script-free node subset, rejects DTD/entities, bounded ZIP reads | a narrow reader, not a sanitiser | Stated |
| 84 Node checks + 2 X3D XML Schema checks pass | `BRIDGE-DELIVERY.json`, `validation/` | Stated |
| **Real browser rendering** | the package marks it unverified. **I ran it here**: `python3 start.py` on loopback, opened it in the built-in Chromium browser, pressed Run physics: MuJoCo 3.17 WASM drives the arm, X_ITE 16.7 renders it, no console errors | **Measured** (Chromium on this Mac only) |
| Everything runs in the visitor's browser; the Python launcher only serves static files | the key fact for scaling (section 4) | Stated + Measured |

What it is not yet (the package says so itself): a general MJCF ⇄ X3D converter, native X3D RigidBodyPhysics, lossless round-trips, multi-scene/PROTO identity, deterministic checkpoint replay, or any remote transport.

**Verdict:** an unusually honest, well-shaped seed. The contract (authority split, revisions, acknowledgements, loss reports, provenance) is the valuable part; the arm is just its first profile. Everything below grows the contract, not the arm.

## 2. Why both ecosystems would want it

- **X3D gains** a real dynamics engine without inventing one, an authoring role for physical parameters in a standard, ISO-backed, web-native format, and a reason for researchers to publish scenes in X3D (inspectable, viewable in any X3D browser, carrying units, conventions and provenance).
- **MuJoCo gains** a standard, browser-viewable, annotatable presentation and exchange layer for models and *experiments* (not just models): scenes with sensors, observations, command logs and declared losses travel together, and open in a web page with no install.
- **Researchers gain** reproducible experiment packages: a reviewer opens the package, sees the scene, replays the trial, and checks the numbers (once replay exists, phase 1).

## 3. Design principles that carry to scale

1. **Contract first.** The versioned protocol, schemas and profiles are the product; the UI, SDKs, MCP server and API are clients of it. Every phase ends with the contract frozen and conformance tests published.
2. **Authority is explicit, per field.** Never two writers of one value. Already true in 0.1; keep it when adding transports.
3. **Losses are first-class.** Every conversion returns a machine-readable loss report. "Lossless" is only ever claimed per profile, with a round-trip test proving it.
4. **Compute where it is cheapest.** MuJoCo in WASM puts interactive simulation on the researcher's own machine. Servers do what browsers cannot: batch rollouts, GPU sweeps, long jobs, conversion of large model libraries.
5. **Content-addressed, pinned, reproducible.** Every package records the engine version, the compiler options and the hashes of its inputs. Bit-identical replay is only promised on the same engine build and platform class; across platforms the promise is "within a stated tolerance", tested.
6. **Untrusted input everywhere.** XML (XXE, entity bombs), ZIP (bombs, path traversal), MJCF (`<include>` paths, plugins, huge meshes): parse in sandboxes with hard limits, never load native plugins from uploads.

## 4. The scale arithmetic (why planet scale is reachable)

Target: tens of thousands of researchers a day. Take 20,000 a day. All figures **Estimate**, to be replaced by measurements in phase 3.

| load | assumption | result |
|---|---|---|
| Interactive simulation | runs in the visitor's browser (WASM) | server cost ≈ static hosting: a CDN serving a ~10–30 MB app; 20,000 × 30 MB ≈ 600 GB a day of egress, cached |
| API calls (validate, convert, package, lookup) | 20 calls per researcher a day, ~50 ms CPU each | 400,000 calls ≈ 4.6 per second on average, ~50 per second at a 10× peak, ≈ 5.6 CPU-hours a day: a handful of small instances |
| Server-side rollouts | 10% of researchers run 10 jobs of 60 s CPU each | 2,000 × 10 × 60 s ≈ 333 CPU-hours a day ≈ 14 cores busy on average, autoscaled for peaks |
| GPU sweeps (RL, system identification) | via MuJoCo's batched backends (MJX on JAX, or MuJoCo Warp) for the few who need thousands of parallel worlds | a separate, quota-gated queue; the expensive tier, priced or grant-funded |
| Storage | 1 MB average package, 20% of researchers save 5 a day | 20 GB a day ≈ 7 TB a year before deduplication |

So "planet scale" here is mostly **correctness, reproducibility, security, versioning and community**, not raw compute. The heavy, costly tier is GPU batch simulation, and it should be metered from day one.

## 5. Phases

Each phase ends at a gate (Loom style): a written definition of done, conformance tests passing, and an evidence file. Durations assume one or two people plus agents; **Estimate**.

### Phase 0: harden the seed (2–4 weeks)
- A git repository (private until you decide), CI running `npm test`, the schema check and a real-browser smoke test (Playwright with Chromium, Firefox and WebKit, actual WebGL).
- Close the package's own open checks: drag, recompile, export and re-import, narrow layout and keyboard access, the Windows and WSL launchers.
- Licence review: MuJoCo (Apache-2.0), X_ITE (check its licence before redistributing it in a hosted product), the salvaged workbench material ("no new blanket licence is assigned"): decide the bridge's own licence (Apache-2.0 keeps parity with MuJoCo).
- Run the exported scenes through `x3d_mcp` validation (the user's fork) as a second validator, and register the schemas by their `$id`.
- Gate: everything green in three browsers; a threat model for the importer.

### Phase 1: from one arm to a general bridge (2–4 months)
- **Profiles as data**: a profile = parameter schema + compiler + X3D scene generator + identity map + loss report + tests. Ship `mjcf-core/1`: bodies, hinge/slide/ball/free joints, primitive geoms and meshes, actuators, sensors, equality constraints; then `menagerie/1` as the conformance target: convert every model in MuJoCo Menagerie to X3D and back, and publish a table of what survives (the loss report as a scoreboard).
- **Round-trip tests**: MJCF → X3D → MJCF must compile to the same `mjModel` (compare sizes, masses, inertias, joint ranges, geom parameters within tolerance); X3D presentation edits must survive through a preservation path, separate from the physics path.
- **Identity**: scene URI + instance path, so Inline and PROTO instances bind correctly; numeric engine ids never persist.
- **Replay**: real checkpoints from MuJoCo's full integration state (`mj_getState` with the integration signature), a command log with timestamps, and a replay test that reproduces a trial bit-for-bit on the same build.
- **Standards mapping, each as its own validated profile**: a tested subset of X3D RigidBodyPhysics (state where its contact model differs from MuJoCo's), H-Anim joints and segments to MuJoCo bodies for humanoids, and MuJoCo's own URDF import path as a third entry.
- Gate: Menagerie scoreboard published, replay proven, loss reports machine-readable.

### Phase 2: transports, SDKs, CLI and MCP (in parallel with phase 1, 2–3 months)
- **Asynchronous transport** (Web Worker first, then WebSocket) keeping ordered acknowledgements, expected revisions and authoritative timestamps, exactly as the contract warns.
- **Python package** (`x3d-mujoco`): the same contract on MuJoCo's Python bindings plus an X3D reader and writer; a CLI: `x3d-mujoco convert | validate | simulate | package | replay | diff`.
- **JavaScript/TypeScript package**: the browser bridge as a library (so X_ITE, X3DOM and three.js hosts can embed it).
- **MCP server**, so agents (a hosted model, the Loom) can author and run physics experiments. Tools: `validate_scene`, `mjcf_to_x3d`, `x3d_to_mjcf`, `compile`, `simulate(steps, controls)`, `measure_trial`, `export_package`, `replay_package`, `diff_packages`; resources: profiles, schemas, loss reports, Menagerie conformance table. Build it next to your `x3d_mcp` fork so validation and physics share one agent surface; local stdio first, then a remote, streamable-HTTP deployment that fronts the hosted API.
- Gate: the same experiment package produced by the browser, the Python CLI and the MCP server, byte-identical manifests.

### Phase 3: hosted beta (hundreds of researchers a day, 2–3 months)
- Static app on a CDN (the interactive path costs almost nothing per user).
- A stateless API (convert, validate, package, replay) behind a gateway; a job queue with sandboxed CPU workers for rollouts (gVisor or Firecracker, no network, CPU, memory and time limits, native plugins disabled).
- Content-addressed object storage for packages, Postgres for metadata, provenance and sharing; signed, permanent package links (citable; DOIs through Zenodo for published ones).
- Researcher sign-in with ORCID (identity researchers already have), quotas per account.
- Observability from the start: per-call latency, queue depth, failure classes, conversion loss rates.
- Gate: measured latency and cost per call replace the estimates in section 4; a security review of the upload paths.

### Phase 4: planet scale (tens of thousands a day, 6–12 months after beta)
- Multi-region API and workers, autoscaling on queue depth; the GPU tier (MJX or MuJoCo Warp batch rollouts) as a separate, metered queue.
- Versioned contract with long-term support: old packages keep replaying on their pinned engine build (keep old WASM and worker images forever; they are small).
- A public model and experiment registry (search, fork, compare, cite), the Menagerie scoreboard kept live against each MuJoCo release.
- Governance: an open specification for the profiles, conformance suites anyone can run, and an independent second implementation (for example in X3DOM or a native X3D browser) as proof the contract is not one codebase.
- Funding: the CPU tier is cheap enough for grants or sponsors; the GPU tier needs pricing or compute grants.
- Gate: SLOs met for a quarter (for example 99.9% API availability, p95 convert under 2 s for Menagerie-sized models), and the registry used by groups you did not recruit.

## 6. Risks

| risk | mitigation |
|---|---|
| Scope creep into "convert all of X3D" | profiles with explicit loss reports; never claim general losslessness |
| Contact models differ (X3D RigidBodyPhysics vs MuJoCo soft contacts) | separate compatibility profile; numbers, not names, decide equivalence |
| Determinism across platforms and MuJoCo versions | pin builds per package; promise bit-identical only per build; tolerance tests otherwise |
| Malicious uploads (XXE, ZIP bombs, MJCF includes, plugins, giant meshes) | sandboxed parsing and simulation, limits, no native plugins |
| Licence conflicts when hosting X_ITE or salvaged material | phase 0 review before any public deployment |
| Two communities, two standards bodies | an open spec and conformance suite; engage both only when you decide (nothing is sent to Web3D, DeepMind or anyone without your explicit go) |
| GPU cost runaway | metered, quota-gated queue from day one |

## 7. Questions for you (answered in section 0)

1. Who are the first users: robotics researchers, X3D authors, educators, or agents (the Loom)? This decides whether phase 1 starts from Menagerie (robotics) or from H-Anim and RigidBodyPhysics (X3D).
2. Open source from the start (where, under which licence) or private until phase 3?
3. Hosting and money: do you have a cloud preference or credits, and is the GPU tier in scope for the first year?
4. Should the MCP server live inside your `x3d_mcp` fork or as its own package?
5. Is the Web3D Consortium path (a physics component or profile proposal) a goal, and on what timeline?

## 8. Next two weeks (concrete; first slice: agents)

1. Put `incoming/proto` under git in a working folder (keeping `incoming/` untouched), run `npm ci && npm test` (needs a Node 24 install and the npm packages: about 200 MB, ask first), add the Playwright three-browser smoke test.
2. Validate `samples/contact-arm.x3d` and `Contact-Arm-Bridge.x3d` with `x3d_mcp`.
3. Licence review of X_ITE and the salvaged material.
4. Spike: convert three Menagerie models (a pendulum, a quadruped, a humanoid) with MuJoCo's Python bindings and the bridge's scene writer, and publish the first loss table.
5. Spike, inside the `x3d_mcp` fork: stdio MCP tools `validate_scene`, `mjcf_to_x3d` and `simulate`, driven from a a hosted model session.
6. Sketch the G4 notebook for batched rollouts (MJX or MuJoCo Warp) that reads and writes experiment packages.
