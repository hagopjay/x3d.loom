#!/bin/sh
# run.sh CMDDIR 'js' [out.png] [frames]: send one command to a running session-babylon.js and wait for its result
D=$1; N=$(printf '%03d' $(ls $D | grep -c '\.json$')); python3 - "$D" "$N" "$2" "$3" "${4:-3}" <<'PY'
import json,sys
d,n,ev,out,fr=sys.argv[1:6]
c={'frames':int(fr)}
if ev.startswith('goto:'): c['goto']=ev[5:]
else: c['eval']=ev
if out: c['out']=out
open(f'{d}/{n}.json.tmp','w').write(json.dumps(c))
import os; os.rename(f'{d}/{n}.json.tmp',f'{d}/{n}.json')
PY
until [ -f $D/$N.res ]; do sleep 1; done; cat $D/$N.res; echo
