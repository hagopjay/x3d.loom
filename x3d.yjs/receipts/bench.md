rig: node v22.23.4, yjs 13.6.33, Intel(R) Xeon(R) Processor @ 2.10GHz x4

| scene | nodes | loadXML ms | toXML ms | tree() ms | state bytes | state gz-free bytes/node |
|---|---|---|---|---|---|---|
| 100 Transform+Shape+Appearance+Material+Box | 500 | 17.6 | 5.9 | 3.5 | 79149 | 158.3 |
| 1000 Transform+Shape+Appearance+Material+Box | 5000 | 86.1 | 45.7 | 19.0 | 819211 | 163.8 |
| 10000 Transform+Shape+Appearance+Material+Box | 50000 | 555.7 | 432.0 | 284.2 | 8239203 | 164.8 |

| nodes | local setField ops/s (no observer) | with observer (field-only fast path) | add+remove pairs/s, incremental index | add+remove pairs/s, full rebuild (old path) | bytes per setField update | remote apply ops/s |
|---|---|---|---|---|---|---|
| 500 | 89496 | 162639 | 844 | 296.8 | 51 | 87774 |
| 5000 | 140378 | 183330 | 44 | 21.7 | 54 | 84005 |
| 50000 | 196851 | 191547 | 1 | 1.4 | 52 | 147739 |

Structural edit with fan-out 10 (balanced scene; add one Box under a leaf group, then remove it):

| nodes | depth | pairs/s incremental | pairs/s full rebuild |
|---|---|---|---|
| 511 | 2 | 6572 | 305.3 |
| 5111 | 3 | 6967 | 15.6 |
| 51111 | 4 | 6687 | 1.5 |

fuzz: 200/200 seeds converged, incremental index equals the full rebuild on 600/600 peer copies (3 peers, 300 random ops each: setField, add, remove, move, SFNode-slot add, partial syncs), 7.2 s; reported by tree() across all seeds: {"orphans":5096,"duplicate":15,"def-clash":223,"sfnode-slot":34}
