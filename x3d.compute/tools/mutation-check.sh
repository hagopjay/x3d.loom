#!/bin/sh
# Proves the checks can fail. First the unmutated suites must pass (baseline), then each planted bug must turn its own suite RED ("false").
# A crash ("ERROR"), a missing mutation target or an unchanged-green result all count as failures of the check, not as catches.
# Exit 0 only if the baseline is green and every mutant is caught.
cd "$(dirname "$0")/.." || exit 2
rc=0
verdict() { node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const s=r.suites[process.argv[2]]; console.log(!s?"MISSING":s.error?"ERROR":s.correctness.pass===true?"true":s.correctness.pass===false?"false":"MISSING")' "$1" "$2"; }
for suite in particles skinning volume nurbs splats; do
  node tools/run.js --quick --nobench --only="$suite" --name="baseline-$suite" >/dev/null 2>&1
  v=$(verdict "receipts/baseline-$suite.json" "$suite")
  if [ "$v" = true ]; then echo "baseline  $suite  green"; else echo "BASELINE NOT GREEN  $suite ($v)"; rc=1; fi
done
run() { suite=$1; shift; node tools/run.js --quick --nobench --only="$suite" --name="mutant-$suite" --mutate="$1" >/dev/null 2>&1; v=$(verdict "receipts/mutant-$suite.json" "$suite")
  case "$v" in false) echo "caught    $suite  [$1]";; true) echo "SURVIVED  $suite  [$1]"; rc=1;; *) echo "BROKEN-MUTANT ($v)  $suite  [$1]"; rc=1;; esac; }
run particles 'particles|vel + (g + (wind - vel) * P.drag) * P.dt|vel + (g * 0.9 + (wind - vel) * P.drag) * P.dt'
run particles 'particles|P.variation * (2.0 * rnd(i, frame, 3u) - 1.0)|P.variation * rnd(i, frame, 3u)'
run particles 'particles|vel.y = -vel.y * P.restitution;|vel.y = -vel.y * 0.5;'
run skinning 'skinning|m1 * p * w.y|m1 * p * w.x'
run skinning 'skinning|m2 * p * w.z|m2 * p * 0.0'
run volume 'volume|acc + (1.0 - a) * al * col|acc + (0.9 - a) * al * col'
run volume 'volume|vec3<f32>(d - 1.0)|vec3<f32>(d - 2.0)'
run nurbs 'nurbs|(*d)[r] = f32(p) * (a - b);|(*d)[r] = f32(p) * (a + b);'
run nurbs 'nurbs|l > 1e-12), l);|l > 1e-12), l * 2.0);'
run splats 'splats|a = cyy / det;|a = cxx / det;'
run splats 'splats|bitcast<u32>(z)|bitcast<u32>(z * 0.5)'
run splats 'splats|let up = (i & B.k) == 0u;|let up = (i & B.k) != 0u;'
run splats 'splats|let up = ((base + lo) & k) == 0u;|let up = ((base + lo) & k) != 0u;'
run splats 'splats|for (var j = 256u; j > 0u; j = j >> 1u) {|for (var j = 128u; j > 0u; j = j >> 1u) {'
rm -f receipts/mutant-*.json receipts/baseline-*.json
exit $rc
