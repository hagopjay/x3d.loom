#!/bin/sh
# Plants one deliberate bug per kernel and checks that the matching correctness suite turns red. Exit 0 only if every mutant is caught.
cd "$(dirname "$0")/.." || exit 2
rc=0
run() { suite=$1; shift; out=$(node tools/run.js --quick --only="$suite" --name="mutant-$suite" --mutate="$1" 2>/dev/null); if echo "$out" | grep -q "\"$suite\": true"; then echo "SURVIVED  $suite  [$1]"; rc=1; else echo "caught    $suite  [$1]"; fi; }
run particles 'particles|vel + (g + (wind - vel) * P.drag) * P.dt|vel + (g * 0.9 + (wind - vel) * P.drag) * P.dt'
run skinning 'skinning|m1 * p * w.y|m1 * p * w.x'
run volume 'volume|acc + (1.0 - a) * al * col|acc + (0.9 - a) * al * col'
run nurbs 'nurbs|(*d)[r] = f32(p) * (a - b);|(*d)[r] = f32(p) * (a + b);'
run splats 'splats|a = cyy / det;|a = cxx / det;'
run splats 'splats|let up = (i & B.k) == 0u;|let up = (i & B.k) != 0u;'
run splats 'splats|let up = ((base + lo) & k) == 0u;|let up = ((base + lo) & k) != 0u;'
run splats 'splats|for (var j = 256u; j > 0u; j = j >> 1u) {|for (var j = 128u; j > 0u; j = j >> 1u) {'
rm -f receipts/mutant-*.json
exit $rc
