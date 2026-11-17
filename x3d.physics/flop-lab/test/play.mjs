// a crude bot per hall: hold right, hop when blocked; does it reach the next checkpoint?
import './mk.mjs';
const { Sim, defaultLevel, NOINPUT, HALLS } = await import('../dist/core.mjs?'+Date.now());
for (let k = 1; k < HALLS.length - 1; k++) { const sim = new Sim(defaultLevel()); const h = sim.hero; sim.goTo(HALLS[k].x, HALLS[k].y); const goal = HALLS[k + 1].x; let stuck = 0, lastx = h.x, jp = false, t = 0, ev = [];
  for (let i = 0; i < 60 * 60; i++) { let jump = false, flopP = false;
    if (sim.mode === 'hero') { if (i % 20 === 0) { stuck = Math.abs(h.x - lastx) < 0.3 ? stuck + 1 : 0; lastx = h.x; } if (stuck >= 1 || !sim.ground) jump = (i % 36) < 24; }
    if (sim.mode === 'limp' && sim.stunt.t > 2) flopP = true;
    sim.step({ ...NOINPUT, x: 1, jump, jumpP: jump && !jp, flopP }, 1 / 60); jp = jump; t = i / 60;
    for (const e of sim.fx) if (['respawn', 'star', 'stunt'].includes(e.type)) ev.push(e.type + (e.stunt ? '(' + e.stunt.why.slice(0, 22) + ' ' + e.stunt.score + ')' : '') + '@' + sim.focus().x.toFixed(0));
    if (sim.mode === 'hero' && h.x >= goal) break; }
  console.log(`${HALLS[k].name} -> ${HALLS[k + 1].name}: ${sim.focus().x >= goal - 0.5 ? 'reached in ' + t.toFixed(1) + ' s' : 'NOT reached, x=' + sim.focus().x.toFixed(1)}  ${ev.slice(0, 8).join(' ')}`); }
