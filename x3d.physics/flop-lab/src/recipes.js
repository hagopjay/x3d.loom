// loom:sim
// Authored world recipes. The seed changes declared part parameters, not clocks.
// Complete generated levels remain editable/exportable through the X3D bridge.
const LAB_WORLDS = [
  { id: 'museum', title: 'The Seven Halls', brief: 'The original guided course: movement, contacts, hinges, compliance, fields, broad phase and the cannon.' },
  { id: 'skyline', title: 'Grapple Skyline', brief: 'A vertical playground of lifts, swing rings and soft landings. Read the gap, jump, dash, then let go.' },
  { id: 'cascade', title: 'Cascade Foundry', brief: 'Build a chain reaction through dominoes, a seesaw, pegboard and a collapsing target tower.' },
  { id: 'tidal', title: 'Tidal Conservatory', brief: 'Wind, rafts, springs and compliant gardens. Go limp to make the same force feel different.' },
  { id: 'carnival', title: 'Giggleworks Carnival', brief: 'Biscuit bowling, sky noodles, jelly landings and the Fan Club. Jump, F, then Q for three silly puffs per flop. Recover to bank your show.' }
];

function createLabWorld(id, seed = 7) {
  if (!LAB_WORLDS.some(w => w.id === id)) throw new Error('Unknown world recipe: ' + id);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 2147483647) throw new Error('Seed must be an integer from 0 to 2147483647.');
  if (id === 'museum') return defaultLevel();
  if (id === 'carnival') return createCarnivalWorld(seed);
  const random = rng32(seed), L = newLevel({ gravity: id === 'skyline' ? 22 : 30, substeps: 8, iters: 1 });
  let serial = 0;
  const P = (kind, params, name) => addPart(L, kind, params, name || id + '_' + (++serial) + '_' + seed);
  const checkpoint = (key, x, y, name) => P('checkpoint', { x, y, name }, 'cp_' + key);
  const label = (x, y, title, text) => P('label', { x, y, title, text });
  const star = (x, y) => P('star', { x, y });
  P('platform', { x: 33, y: -1.5, w: 86, h: 2 }, 'recipe_floor');
  P('platform', { x: -10, y: 12, w: 1, h: 16 }, 'recipe_left_wall');
  P('platform', { x: 76, y: 12, w: 1, h: 16 }, 'recipe_right_wall');
  checkpoint('feel', -5, -1.5, '0 Feel');
  label(1, 9, LAB_WORLDS.find(w => w.id === id).title.toUpperCase(), 'Authored seed ' + seed + '. Export X3D to keep the exact generated layout.');
  if (id === 'skyline') {
    P('spring', { x: 2, y: -1.4, w: 2.4 });
    for (let i = 0; i < 5; i++) {
      const x = 9 + i * 11, y = 1 + (i % 3) * 2.4;
      P('platform', { x, y, w: 4.2, h: 0.4 });
      P('ring', { x: x + 3.7, y: y + 4.5 + random() });
      star(x, y + 1.9);
      if (i < 4) P('lift', { x: x + 5.4, y: y + 0.5, w: 2.2, dx: 1.3, dy: 2 + random(), period: 4.5 + random() * 2 });
    }
    checkpoint('joints', 31, -1.5, '2 Joints');
    P('bridge', { x: 28, y: 6.2, length: 12, planks: 10 });
    P('jelly', { x: 62, y: -1.5, cols: 5, rows: 3, size: 0.65, softness: 0.006 });
    P('fan', { x: 66, y: -1.5, w: 3.2, h: 11, force: 43 });
    star(66, 7); label(41, 12, 'OWN YOUR MOMENTUM', 'Hook a ring, reel with W/S, jump to release. E dashes once before landing.');
  } else if (id === 'cascade') {
    checkpoint('contact', 11, -1.5, '1 Contact');
    P('dominoes', { x: 3, y: -1.5, count: 16, spacing: 0.67 + random() * 0.16, height: 1.8, thick: 0.23 }, 'dominoes_1');
    P('seesaw', { x: 22, y: -1.5, length: 7 });
    P('ball', { x: 19.2, y: 3.2, r: 0.6, mass: 7, bounce: 0.15 });
    P('crates', { x: 25.2, y: -1.3, cols: 1, rows: 2, size: 0.6, mass: 0.8 });
    P('pegs', { x: 38, y: 7, cols: 7, rows: 5, spacing: 1.15, r: 0.16 });
    P('balls', { x: 38, y: 9, count: 30, r: 0.23, mass: 0.3, bounce: 0.35 });
    checkpoint('broad', 32, -1.5, '5 Broad phase');
    P('crates', { x: 57, y: -1.5, cols: 3, rows: 6, size: 0.85, mass: 1.2 });
    P('cannon', { x: 46, y: -0.5, angle: 38 + Math.floor(random() * 9), power: 23 }, 'cannon_1');
    checkpoint('cannon', 45, -1.5, '6 Cannon');
    P('goal', { x: 68, y: 2.5, r: 1.8 }, 'goal_1');
    for (const [x, y] of [[8, 2], [22, 2], [38, 3], [58, 5], [68, 2.5]]) star(x, y);
    label(28, 13, 'TRACE THE CHAIN REACTION', 'Pause, single-step and inspect contacts. Drop a ball, change one mass, then compare.');
  } else {
    checkpoint('soft', 10, -1.5, '3 Compliance');
    P('jelly', { x: 8, y: -1.5, cols: 5, rows: 3, size: 0.55, softness: 0.0002 });
    P('jelly', { x: 14, y: -1.5, cols: 5, rows: 3, size: 0.55, softness: 0.012 });
    P('fan', { x: 22, y: -1.5, w: 3.4, h: 11, force: 47 });
    P('curtain', { x: 20.8, y: 10.5, strands: 5, length: 3.3, spacing: 0.55, links: 5 });
    checkpoint('fields', 18, -1.5, '4 Fields');
    P('water', { x: 38, y: -0.6, w: 15, depth: 3.6 });
    for (let i = 0; i < 5; i++) P('raft', { x: 32.3 + i * 2.8, y: -0.4, w: 2.1, h: 0.45, mass: 2.5 + random() });
    P('bridge', { x: 47, y: 2, length: 9, planks: 8 });
    P('pendulum', { x: 60, y: 8, length: 6, r: 0.65, mass: 24, angle: 40 + random() * 20, links: 6 });
    P('spring', { x: 67, y: -1.4, w: 3 });
    for (const [x, y] of [[8, 1.5], [14, 1.5], [22, 7], [38, 1.5], [53, 4], [67, 5]]) star(x, y);
    label(31, 13, 'FORCES DO NOT KNOW YOUR INTENT', 'Compare upright and limp flight. Change softness or mass independently, then export your experiment.');
  }
  return L;
}

// Carnival uses only the same public prefab vocabulary as the other worlds.
// Broad ground routes remain available under the optional aerial challenges.
// Its random choices are retained source parameters, not hidden runtime spawns.
function createCarnivalWorld(seed) {
  const random = rng32(seed), L = newLevel({ gravity: 30, substeps: 8, iters: 1 });
  let serial = 0;
  const P = (kind, p, id) => addPart(L, kind, p, id || 'carnival_' + (++serial) + '_' + seed);
  const cp = (key, x, name) => P('checkpoint', { x, y: 0, name }, 'cp_' + key);
  const sign = (x, y, title, text) => P('label', { x, y, title, text });
  const star = (x, y) => P('star', { x, y });

  // The pool is a real gap in the floor. Wide, dry runways bracket its low walls.
  P('platform', { x: 28.4, y: 0, w: 80.8, h: 2 }, 'carnival_floor_left');
  P('platform', { x: 99, y: 0, w: 40.8, h: 2 }, 'carnival_floor_right');
  P('platform', { x: -12, y: 9, w: 0.7, h: 11 }, 'carnival_left_wall');
  P('platform', { x: 119.4, y: 12, w: 0.8, h: 14 }, 'carnival_right_wall');

  cp('feel', -5, '0 Giggle School');
  sign(-2, 7.2, 'GIGGLEWORKS CARNIVAL', 'Seed ' + seed + '. Jump, then F while rising. Q puffs a limp body; recover with F to bank the show.');
  P('spring', { x: 2.5, y: 0.08, w: 2.6 }, 'carnival_first_pad');
  star(2.5, 4.2);
  P('ring', { x: 8.3, y: 4.6 });
  sign(6, 9.5, 'GRAVITY IS A SUGGESTION DEPARTMENT', 'Three Q puffs per flop. Aim with the movement keys. No points are worth getting stuck: R respawns.');

  cp('contact', 14, '1 Biscuit Bowling');
  P('dominoes', { x: 17, y: 0, count: 8, spacing: 0.76 + random() * 0.08, height: 1.35, thick: 0.22 }, 'carnival_biscuits');
  P('ball', { x: 24.2, y: 0.55, r: 0.55, mass: 3 + random(), bounce: 0.28 }, 'carnival_bowling_ball');
  star(20.2, 2.7);
  sign(17.5, 6.1, 'BISCUIT BOWLING', 'Run into the row, or jump over it and flop back. The biscuits have declined to comment.');

  cp('joints', 29, '2 Sky Noodles');
  P('spring', { x: 32, y: 0.08, w: 2.2 });
  P('bridge', { x: 34, y: 1.3, length: 9, planks: 8 }, 'carnival_noodle_bridge');
  for (const [x, y] of [[35, 4.8], [39.5, 6], [44, 4.8]]) P('ring', { x, y });
  star(38.5, 4.2);
  P('jelly', { x: 44, y: 0, cols: 5, rows: 2, size: 0.5, softness: 0.008 }, 'carnival_catch_jelly');
  sign(33, 9.4, 'SKY NOODLES', 'Hold Shift near a ring. Space releases. Jump, dash, hook, then F: one continuous very questionable plan.');

  cp('soft', 47, '3 Jelly Department');
  P('jelly', { x: 51, y: 0, cols: 4, rows: 3, size: 0.5, softness: 0.0006 }, 'carnival_firm_jelly');
  P('jelly', { x: 56, y: 0, cols: 4, rows: 3, size: 0.5, softness: 0.007 + random() * 0.004 }, 'carnival_wobble_jelly');
  star(56, 2.9);
  sign(49.4, 6.5, 'THE FLOOR IS HAVING FEELINGS', 'Two jelly landings, two compliances. Soft is not the same as bouncy. Inspect one part and compare.');

  cp('fields', 60, '4 Fan Club');
  P('fan', { x: 64, y: 0.05, w: 3.5, h: 10.5, force: 49 }, 'carnival_fan');
  P('curtain', { x: 63.3, y: 11.2, strands: 3, links: 4, length: 2.7, spacing: 0.65 }, 'carnival_fan_ribbons');
  star(64, 6.5);
  P('water', { x: 74, y: 0.65, w: 9, depth: 2.5 }, 'carnival_splash_pool');
  for (const x of [71, 74, 77]) P('raft', { x, y: 0.7, w: 2.1, h: 0.35, mass: 2.8 });
  star(74, 2.3);
  sign(65, 14, 'YOUR FAN CLUB IS LITERALLY A FAN', 'Enter upright, then F to float. Puff out sideways. Pool ahead: jump while upright to swim, or F to recover.');

  cp('cannon', 84, '5 Confetti Cannon');
  P('cannon', { x: 86, y: 0.95, angle: 38 + Math.floor(random() * 5), power: 22 }, 'carnival_cannon');
  P('goal', { x: 100, y: 3.7, r: 3 }, 'carnival_big_target');
  P('crates', { x: 104.5, y: 0, cols: 3, rows: 4, size: 0.8, mass: 0.9 }, 'carnival_confetti_tower');
  P('jelly', { x: 111, y: 0, cols: 5, rows: 2, size: 0.55, softness: 0.009 }, 'carnival_final_jelly');
  star(100, 3.7);
  sign(84.5, 7.8, 'UNLICENSED CONFETTI DELIVERY', 'W enters the cannon. W/S aims; A/D changes power; Space fires. Hit the wide target, meet the tower, F to take your bow.');
  sign(108, 10, 'AN EXTREMELY PROFESSIONAL LANDING', 'A failed trick can be a good experiment. Retry one change, or take this entire carnival home as X3D.');
  return L;
}
