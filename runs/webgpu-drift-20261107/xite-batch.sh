#!/bin/sh
# xite-batch.sh OUTDIR [BASEURL]: renders every view in views.txt with the original X_ITE page
OUT=$1; BASE=${2:-http://localhost:8124/xite}; mkdir -p $OUT
while read id tape tick cam; do
  node shot-xite.js "$BASE/index.html?tape=tapes/$tape.tape.json&frame=$tick&hud=0&cam=$cam&noanim=1&live=0&cscale=1" $OUT/x-$id.png 640 360 4000 > $OUT/x-$id.log 2>&1
done < views.txt
echo done > $OUT/XDONE
