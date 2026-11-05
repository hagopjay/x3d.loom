# Public snapshot

This repository is a **leak-swept snapshot** of a private working repository, not its history. Each publication is one commit.

- Made from private commit `80c93e255ec3cfee24eb0baff7173b6455fbd004` on 2026-11-05 by `kit/loom sweep` (Loom law 16: nothing leaves without a leak sweep).
- Sweep rules sha256 `262853740b6d884acff94a08a515fdc7ab751061ac6f5f6e0f611f146edfe8d0` (`kit/profiles/public-sweep.json`, not published: it lists the strings it removes).
- `SWEEP-REPORT.json` lists every file the sweep changed and how many replacements it made; the copy failed closed on any residue.
- What the sweep withholds: local paths, a private Drive folder id, run costs, and vendor and model names (replaced by neutral labels such as "a hosted model").
- Receipts under `runs/` were not changed by the sweep and verify with `kit/loom verify-receipt runs/<run>/receipt.json`; the kit's tests run with `python3 -I kit/tests/test_gates.py`.

The companion studies are at [hagsmac/x3d.STEM](https://github.com/hagsmac/x3d.STEM).
