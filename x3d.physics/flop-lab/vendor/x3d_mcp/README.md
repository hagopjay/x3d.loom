# Pinned direct-validation subset

Upstream: https://github.com/hagopjay/x3d_mcp

Commit: `b5c9956917714747fe1d034c729612e99b0f09c9`

The nineteen files listed in `ORIGIN.json` are unchanged upstream source,
schemas and license. This subset supports the optional Flop Lab wrapper's
direct local calls to `validate_xml(version='4.0')` and
`semantic_diagnostics()`. It is not the complete MCP server and exposes no
network connector. Python dependencies are pinned separately in
`../../tools/requirements-validation.txt`.

The wrapper has its own explicit 2 MiB per-file cap and limited XML policy.
The 4.0 XSD and its local includes are used for schema checks; upstream semantic
diagnostics consult their default 4.1 UOM vocabulary. Every result records
these scopes separately and retains informational/warning diagnostics.

The wrapper verifies the pinned manifest, every listed file and loaded module
origins before using the validator. Hashes identify consumed bytes; they do not
independently authenticate a publisher or prove general semantic completeness.
See `../../VALIDATION.md` and `../../docs/X3D-CONTRACT.md` for results and limits.
