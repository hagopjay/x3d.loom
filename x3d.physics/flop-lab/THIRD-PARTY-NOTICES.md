# Third-party source and provenance

Flop Lab retains the MIT-licensed source supplied in the attached fold-back
patch. Its MIT license declaration is retained in `package.json`. Existing source-history
attribution is preserved; this release does not infer additional repository-wide
licensing terms from that package declaration. No external model service is required for local play.

| Component | Retained version or commit | Usage and license |
|---|---|---|
| Three.js | 0.187.0 | Unmodified runtime module/addon closure; MIT, `vendor/three/LICENSE` |
| hagopjay/x3d_mcp | `b5c9956917714747fe1d034c729612e99b0f09c9` | Unmodified 19-file validation subset plus origin manifest; license at `vendor/x3d_mcp/LICENSE` |
| Linkedom | 0.18.12 | Development-only DOM controls; ISC in the npm package |
| Playwright | 1.63.0 | Inherited optional development browser harness; Apache-2.0 in the npm package |
| lxml / jsonschema | Pinned by `tools/requirements-validation.txt` | Optional Python validation dependencies; their respective upstream licenses |

`vendor/three/ORIGIN.json` records every retained runtime file's byte count and
SHA-256. `npm run vendor` recreates that closure from the pinned npm package.
`vendor/x3d_mcp/ORIGIN.json` records the upstream repository, commit and file
hashes. The validation wrapper additionally pins that manifest and verifies
loaded module origins. It calls actual upstream functions locally; it does not
ship or claim to operate a complete MCP server.

The release ships source schemas and upstream notices unchanged. The custom
X3D bridge, recipes, gameplay controls and renderer are application code; using
standard X3D node names does not imply native X3D rigid-body equivalence.
