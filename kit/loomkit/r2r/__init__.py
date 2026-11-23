"""R2R: the receipt-to-rule engine. A failure receipt goes in; a graded candidate rule with its proof comes out.

The Loom's flywheel says every mistake pays rent once: incident, fact, rule with tests on both sides (law 7). Until this
package the step from incident to rule was done by hand. R2R does it by program, without a language model:

    receipts ──adapters──► failure events ──cluster by signature──► induce a rule in a small, X3DUOM-grounded language
        ──► prove it on both sides (source failures, held-out failures, known-good files, twins, ablations, probes)
        ──► grade C / L / S ──► a sealed candidate with evidence links. A person promotes; the engine never does.

Standard library only, like the rest of loomkit. See R2R.md at the repository root for the specification.
"""
from __future__ import annotations

VERSION = "0.1.0"
EVENT_SCHEMA = "loom.failure-event/1"
RULE_SCHEMA = "loom.rule-candidate/1"
PROOF_SCHEMA = "loom.rule-proof/1"
RUN_SCHEMA = "loom.r2r-run/1"
