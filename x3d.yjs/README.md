# x3d.yjs: live multi-user editing of an X3D scene (Yjs CRDT)

Track prefix `YJS-`. A scene graph held as a Yjs document so any number of peers (people, X_ITE pages, the loom bridges, an LLM agent) edit one X3D scene at once, offline or not, and always converge. Free tools only: Yjs 13.6.33, no relay service (an in-process `Link` stands in for y-websocket / y-webrtc, which plug in unchanged because the unit of exchange is a plain Yjs update).

## What is here

| path | what |
|---|---|
| `src/yx3d.js` | the model: `X3DDoc` (`loadXML`, `setField`, `addXML`, `remove`, `move`, `addRoute`, `tree()`, `toXML()`, `observe()`) |
| `src/sai-adapter.js` | applies remote changes to a live browser through the SAI: X_ITE (granular add/remove/move) or the x3d.loom bridges (granular fields and appends, reload for remove/move) |
| `src/agent.js` | LLM co-editor: JSON ops against DEF names (`modify_node`, `add_node`, `remove_node`, `move_node`), validated, one tagged transaction each |
| `src/link.js` | in-process transport with a latency knob and an offline switch |
| `python/yx3d_py.py` | a Python peer on pycrdt for the x3d_mcp side (same document layout) |
| `demo/index.html` | two X_ITE canvases, two Yjs docs, a link, an agent peer. `node tools/serve.js` then open the printed URL |
| `tools/e2e.js`, `tools/bridge-e2e.js`, `tools/bench.js` | the rig runs; their output is kept in `receipts/` |

## The model in one table

| Y type | content |
|---|---|
| `x3d.meta` Map | profile, version, head metadata |
| `x3d.nodes` Map | `uid -> Map{ type, def, use, text, at, fields: Map<name, string>, kids: Array<uid> }` |
| `x3d.roots` Array | uids of `<Scene>` children, in order |
| `x3d.routes` Map | `rid -> Map{ from, fromField, to, toField }` (uids, so a rename of a DEF cannot break one) |

Fields are X3D attribute strings, last-writer-wins per field: two peers editing `translation` and `scale` of one node both survive; two peers editing `translation` get one value on every peer (Yjs orders concurrent writes to one key by a rule every replica computes the same way).

Tree structure is the pair (`at` register, `kids` order hints). `at = "parentUid|containerField"` is an LWW register, so concurrent moves of one node pick one parent. `kids` arrays only order siblings. `tree()` walks from `roots`, takes a node under a parent only if its register agrees, drops duplicates, and leaves unreachable nodes out. A flat table (instead of nested Maps) is what lets a field edit survive a concurrent move: a nested "move" is delete plus insert of a Map and loses the edit.

## Conflict rules (all tested)

| situation | result on every peer |
|---|---|
| same field, two values | one value wins, deterministic |
| field edit while another peer moves the node | both apply |
| concurrent moves, one node | one parent (register LWW) |
| concurrent moves forming a cycle | converged, the cycle is cut out of the scene and listed in `tree().orphans`; nothing destroyed |
| edit while another peer deletes the node | delete wins |
| two adds into one SFNode slot (`geometry`, `appearance`, ...) | first in array order drawn, other reported as `sfnode-slot` conflict |
| two nodes given one DEF | export renames the later uids `DEF_2`, `DEF_3`; reported as `def-clash` |
| attribute order | export sorts field names (Y.Map iteration order differs between replicas: found by the fuzz test) |

## Run

```sh
npm ci
npm test                                   # 22 tests: unit, 12 fuzz seeds, pycrdt peer (pip install pycrdt)
node tools/bench.js                        # tables, 200-seed convergence fuzz
NODE_PATH=<dir holding playwright> node tools/e2e.js          # two X_ITE 16.6.0 browsers
NODE_PATH=<dir holding playwright> node tools/bridge-e2e.js   # three.js bridge r187
node tools/build.js                        # rebuilds demo/dist/yx3d.js (committed, so the page needs no build)
```

Numbers and their rig: `receipts/` and chapter 15 of x3d.docs.

## Known limits

* Fields are whole strings: no per-component merge of a `translation` (two peers dragging one axis each: one wins). A per-vector-component register is the obvious next step.
* The structure diff (`observe`) is O(n) per structural transaction: 280 / 24 / 2 add+remove pairs per second at 500 / 5,000 / 50,000 nodes. Field edits skip it. An incremental diff from the Yjs events is the fix.
* Deleted-subtree and cycle orphans stay in the document (Yjs GC reclaims only deleted content); `tree().orphans` counts them.
* Scripts (`<Script>` CDATA) are stored as one string per node: LWW, not a text CRDT.
* The in-process link has no network: latency numbers are apply cost, not wire time. A real relay adds its round trip on top.
* The bridge adapter reloads the world for remove, move and non-append inserts, and for any field type `parseValue` does not know (MFVec3f, MFColor, ...).
