rig: node v22.23.4, yjs 13.6.33, Intel(R) Xeon(R) Processor @ 2.10GHz x4

| scene | nodes | loadXML ms | toXML ms | tree() ms | state bytes | state gz-free bytes/node |
|---|---|---|---|---|---|---|
| 100 Transform+Shape+Appearance+Material+Box | 500 | 19.5 | 8.0 | 4.7 | 77749 | 155.5 |
| 1000 Transform+Shape+Appearance+Material+Box | 5000 | 96.9 | 44.7 | 32.2 | 819211 | 163.8 |
| 10000 Transform+Shape+Appearance+Material+Box | 50000 | 535.5 | 285.4 | 235.8 | 8379203 | 167.6 |

| nodes | local setField ops/s (no observer) | with observer (field-only fast path) | with 1 add+remove per op (structure diff) | bytes per setField update | remote apply ops/s |
|---|---|---|---|---|---|
| 500 | 118065 | 208333 | 280 | 44 | 149687 |
| 5000 | 172055 | 213463 | 24 | 47 | 132644 |
| 50000 | 191079 | 147518 | 2 | 47 | 106608 |

fuzz: 200/200 seeds converged (3 peers, 300 random ops each: setField, add, remove, move, SFNode-slot add, partial syncs), 3.3 s; reported by tree() across all seeds: {"def-clash":206,"orphans":5127,"sfnode-slot":31,"duplicate":15}
