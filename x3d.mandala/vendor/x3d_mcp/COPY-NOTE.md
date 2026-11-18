# Retained validation instrument

This directory retains the unmodified validation/schema subset already pinned
by `hagopjay/x3d.gamelab`, with upstream provenance in `ORIGIN.json`:

- Upstream: `https://github.com/hagopjay/x3d_mcp`
- Commit: `b5c9956917714747fe1d034c729612e99b0f09c9`
- Original manifest SHA-256:
  `e7587506b4b4e3455f358451e104ad8d8e31514e6f8e687bdb2b9be5b170c349`

All 19 files named by that manifest retain their recorded bytes and license.
The original manifest remains unchanged. README describes this local adapter;
neither that README nor this provenance note is part of the pinned inventory.

`tools/validate_x3d.py` calls the real `validate_xml` and
`semantic_diagnostics` functions directly. Its explicit 8 MiB file cap does
not modify upstream parser limits. This is an optional offline validation
subset, not a running MCP server or an X3D rendering engine.
