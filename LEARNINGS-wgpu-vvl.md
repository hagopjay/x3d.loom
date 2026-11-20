# LEARNINGS: Vulkan validation (VVL) in x3d.wgpu receipts (20 Nov)

Source: hagopjay/x3d.wgpu PR #7 (docs/VVL.md, docs/RECEIPT-SCHEMA.md). Grades: Confirmed unless marked.

1. **A receipt should say what the driver layers said, not only what pixels came out.** Confirmed. Receipts are now `x3d-wgpu-conformance/2` with an `api_validation` block: layer name and version (and the manifest it came from), mode, counts, message ids, sha256 of the captured log.
2. **wgpu forwards the layer through the `log` crate** (target `wgpu_hal::vulkan::instance`), so capture is a logger, not a callback. wgpu-hal silences five VUIDs before you see them; list them in every receipt so "0 errors" is not over-read. Confirmed (wgpu 30).
3. **Gate in three parts:** layer actually loaded (a missing layer only logs a warning, so check it), no unexpected errors, allow-list visible in the receipt. Confirmed by unit test; the CI run on Mesa 26.0.8 was green.
4. **Turning validation on found real bugs in code that passed 30/30 conformance:** `SYNC-HAZARD-READ-AFTER-WRITE` on wide lines (two render tests). Cause unproven (COPY_DST and an empty submit did not help). Tracked in an allow-list, so "fail on any error" holds only outside it. Confirmed finding, Suspected cause.
5. **Format-agnostic core for any Loom:** `format`, `gpu`, `api_validation` live at top level; format-specific rows stay outside. The glTF Loom adopts the same block.
6. **Limits:** verified on lavapipe only; messages are attributed to rows by time, so run serially; no SSIM/PSNR exists in these receipts (rows are probes). Real-GPU run still open.
