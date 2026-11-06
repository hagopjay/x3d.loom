// Record proof-of-play tapes: the AI drives the PLAYER entrant (it sees only the sim, like any
// controller), every tick's packed Input word is recorded, and the tape is bound to the level's
// sha256 and the engine version (CONTRACT.md section 10).
//   node tools/bot.mjs <level.x3d> [--mode attack|rush|both] [--car ronin] [--tune '{"traction":1}']
//                      [--surface dry|wet] [--skill 1] [--laps 2] [--out DIR] [--dry-run]
// attack: race-line AI, two laps (the first starts rolling from the grid); the goal is a valid lap.
// rush:   drift-mode AI for the 90 s Drift Rush; the goal is the medal the tape states (gold).
// Prints one JSON line per tape with the result and the targets it suggests for the track:
//   gold lap = bot lap x 1.02, silver x 1.08, bronze x 1.16; rush gold = score x 0.85,
//   platinum x 1.1, silver x 0.6, bronze x 0.35 (so a medal is something a good run earns).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTrack, createSim, step, packInput, hashSim, summary, ENGINE_VERSION } from '../engine/sim.js';
import { createDriver, driveAI } from '../engine/ai.js';
import { encodeTape, createRecorder } from '../engine/tape.js';
import { medalRank } from '../engine/race.js';

export const LAP_FACTORS = { gold: 1.02, silver: 1.08, bronze: 1.16 };
export const RUSH_FACTORS = { bronze: 0.35, silver: 0.6, gold: 0.85, platinum: 1.1 };

/** Drive the player entrant of a fresh sim with the AI and record it. Returns { words, sim, goalTick }. */
export function botRun({ track, mode, car = 'ronin', tune = {}, surface = 'dry', skill = 1, laps = 2, maxSeconds = 600, stateMedal = 'gold' }) {
  const entrants = [{ car, tune, driver: 'player', slot: 0 }];
  const sim = createSim({ track, mode, surface, entrants });
  const drv = createDriver(sim, 0, mode === 'attack' ? 'race' : 'drift', skill);
  const rec = createRecorder();
  const inp = {};
  let goalTick = -1;
  for (let i = 0; i < maxSeconds * 120; i++) {
    driveAI(sim, drv, inp);
    const w = packInput(inp);
    rec.push(w);
    step(sim, [w]);
    const r = sim.race;
    if (mode === 'attack') {
      if (goalTick < 0 && r.lapTimes.some(l => l.valid)) goalTick = sim.tick;
      if (r.lapTimes.length >= laps) break;
    } else if (mode === 'rush') {
      if (r.phase === 'finished') { if (medalRank(r.medal) >= medalRank(stateMedal)) goalTick = sim.tick; break; }
    } else if (sim.tick >= maxSeconds * 120) break;
  }
  return { words: rec.words, sim, goalTick, entrants };
}

/** Suggested targets from a bot's best lap and rush score, in the metadata order. */
export function suggestTargets(lap, score) {
  const r1 = x => Math.round(x * 10) / 10, r50 = x => Math.round(x / 50) * 50;
  return [r1(lap * LAP_FACTORS.gold), r1(lap * LAP_FACTORS.silver), r1(lap * LAP_FACTORS.bronze),
    r50(score * RUSH_FACTORS.bronze), r50(score * RUSH_FACTORS.silver), r50(score * RUSH_FACTORS.gold), r50(score * RUSH_FACTORS.platinum)];
}

function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const levelPath = args[0];
  if (!levelPath || levelPath.startsWith('--')) { console.error('usage: node tools/bot.mjs <level.x3d> [--mode attack|rush|both] [--car id] [--out DIR]'); process.exit(2); }
  const text = readFileSync(levelPath, 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  const track = parseTrack(text);
  const level = basename(levelPath);
  const modes = opt('mode', 'both') === 'both' ? ['attack', 'rush'] : [opt('mode')];
  const car = opt('car', 'ronin'), tune = JSON.parse(opt('tune', '{}')), surface = opt('surface', 'dry');
  const skill = Number(opt('skill', '1')), laps = Number(opt('laps', '2'));
  const out = resolve(opt('out', dirname(fileURLToPath(import.meta.url)) + '/../tapes'));
  const dry = args.includes('--dry-run');
  const res = {};
  for (const mode of modes) {
    const t0 = Date.now();
    const { words, sim, goalTick, entrants } = botRun({ track, mode, car, tune, surface, skill, laps });
    const s = summary(sim), r = sim.race;
    const expect = { hash: hashSim(sim), state: goalTick >= 0 ? 'won' : 'lost', frame: sim.tick };
    if (mode === 'attack') { expect.lapTime = +r.bestLap.toFixed(4); expect.medal = r.medal; expect.validLaps = s.validLaps; }
    else { expect.score = s.score; expect.medal = 'gold'; expect.medalReached = r.medal; }
    const tape = encodeTape({ level, level_sha256: sha, engine: ENGINE_VERSION, mode, car, tune, surface, laps: sim.laps, entrants, words, expect,
      note: mode === 'attack' ? `bot: race-line AI, ${laps} laps, best valid lap ${r.bestLap.toFixed(3)} s` : `bot: drift-mode AI, Drift Rush score ${s.score}` });
    const name = level.replace(/\.x3d$/, '') + '-' + mode + '.tape.json';
    if (!dry) { mkdirSync(out, { recursive: true }); writeFileSync(out + '/' + name, JSON.stringify(tape) + '\n'); }
    res[mode] = { lap: r.bestLap, score: s.score };
    console.log(JSON.stringify({ tape: dry ? null : out + '/' + name, level, mode, car, state: expect.state, ticks: words.length, rle: tape.rle.length,
      lapTime: expect.lapTime, score: expect.score, medal: r.medal, laps: r.lapTimes.map(l => [+l.time.toFixed(3), l.valid]), hash: expect.hash, cpu_ms: Date.now() - t0 }));
  }
  if (res.attack && res.rush) console.log(JSON.stringify({ level, suggested_targets: suggestTargets(res.attack.lap, res.rush.score) }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
