# Hand checks for the replay on add-on 2.7.4 (23 Nov 2026)

Nineteen files written by hand, run through add-on 2.7.3 (8e56437) and add-on 2.7.4 (main 0eb4809, source tree
92a942d) in bpy 5.3.0 with `kit/loomkit/r2r/drivers/blender_io.py` under a 10 GB address-space cap. They exist because
`r2r replay` had only 2, 4 and 1 files for three rules, fewer than the 5 passes it asks for before it says "closed".

| Files | What they vary | On 2.7.3 | On 2.7.4 |
|---|---|---|---|
| `cd_*.x3d` (10) | `CoordinateDouble` under each geometry node that takes a coordinate | 7 fail the import (every triangle node), 3 pass (IndexedFaceSet, IndexedLineSet, PointSet) | 10 pass import and export |
| `fan_*.x3d` (7) | `IndexedTriangleFanSet` index: 3, 4 and 5 fans, one long fan, no closing -1, a Color child, 19 tokens | 6 fail the import after 49 to 58 s each (every file with three or more fans), 1 passes (one fan of 21 tokens) | 7 pass import and export, under 0.1 s each |
| `mb_*.x3d` (2) | `MetadataBoolean value="true false"` under WorldInfo and inside a MetadataSet | the import passes, the export fails, both files | 2 pass import and export |

Verdicts, one line per file: `2.7.3-import.jsonl`, `2.7.3-reexport.jsonl`, `2.7.4-import.jsonl`, `2.7.4-reexport.jsonl`.
The two `mb_` files have no import line; an import-then-export line covers both steps. On 2.7.3 a file that fails the
import is `skip` in the re-export file. Machine paths in the messages were replaced as in the sweep files.
