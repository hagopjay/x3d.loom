#!/bin/zsh
# Every demo probe in Chromium, Firefox and WebKit, one after another; results in evidence/<demo>-<browser>.json
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
cd "$(dirname [cost withheld])/.."
for b in ${@:-chromium firefox webkit}; do
  for d in musicbox dominoes galton trebuchet; do
    echo "== $d $b"; node probes/run-$d.mjs $b 2>&1 | tail -c 600
  done
done
