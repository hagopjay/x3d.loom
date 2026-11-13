#!/bin/sh
# babylon-views.sh SESSDIR OUTDIR [BASEURL]: with a running session-babylon.js, renders every view in views.txt (same URL parameters as xite-batch.sh) into OUTDIR/b-<id>.png
D=$1; OUT=$2; BASE=${3:-http://localhost:8124/drift}; mkdir -p $OUT
while read id tape tick cam; do
  ./run.sh $D "goto:$BASE/index.html?tape=tapes/$tape.tape.json&frame=$tick&hud=0&cam=$cam&noanim=1&live=0&cscale=1" > /dev/null
  ./run.sh $D 1 $OUT/b-$id.png 4 > /dev/null; echo "$id done"
done < views.txt
