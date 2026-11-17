# Pinned direct-validation subset

Upstream: https://github.com/hagopjay/x3d_mcp

Commit: `b5c9956917714747fe1d034c729612e99b0f09c9`

The nineteen files listed in `ORIGIN.json` are unchanged upstream source,
schemas and license. This subset supports Resonance Loom's optional adapter's
direct local calls to `validate_xml(version=document_declared_version)` and
`semantic_diagnostics()`. It is not the complete MCP server and exposes no
network connector. Python dependencies are pinned separately in
`../../tools/requirements-validation.txt`.

The adapter has its own explicit **8 MiB** per-file cap. It admits only the
exact fixed Web3D 4.0/4.1 DOCTYPE declarations, refusing arbitrary DTD/entity
declarations before invoking upstream parsing. Each file is checked against
its declared bundled **4.0 or 4.1** XSD and local includes; upstream semantic
diagnostics consult their default **4.1** UOM vocabulary. The authored scene
declares 4.0; X_ITE native serialization declares 4.1. Results record these
boundaries separately and retain informational/warning diagnostics.

The wrapper verifies the pinned manifest, every listed file and loaded module
origins before using the validator. Hashes identify consumed bytes; they do not
independently authenticate a publisher or prove general semantic completeness.
Run `python3 tools/validate_x3d.py` from the project root. See
`../../docs/native-validation.json` and `../../docs/VALIDATION.md` for executed
results and limits. This README describes the local integration and is not
part of the nineteen-file pinned upstream inventory.
