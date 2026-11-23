#!/usr/bin/env node
// The evals socket on the command line. No model is called by anything in this file.
//   node bin/eval.mjs baselines [out.json]       run the three model-free baselines on the repair tasks
//   node bin/eval.mjs tasks [train|dev]          print the task set as JSON lines (id, family, split, brief, input)
//   node bin/eval.mjs score <task-id> < style.json   score one candidate read from stdin; prints the metric as JSON
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tasks, metric, evaluate, BASELINES, FORMULA, FIDELITY_FULL_LOSS } from '../src/evals.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles/catalogue.jsonld'), 'utf8'))['@graph'];
const scene = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/node-city.scene.json'), 'utf8'));
const T = tasks(cat, scene);
const [cmd, a1] = process.argv.slice(2);
if (cmd === 'tasks') { for (const t of T.filter(t => !a1 || t.split === a1)) console.log(JSON.stringify(t)); }
else if (cmd === 'score') { const t = T.find(t => t.id === a1); if (!t) { console.error('no such task'); process.exit(2); } console.log(JSON.stringify(metric(t, JSON.parse(fs.readFileSync(0, 'utf8')), scene))); }
else if (cmd === 'baselines') {
  const rep = T.filter(t => t.family === 'repair');
  const rows = [];
  for (const split of ['train', 'dev']) for (const [name, b] of Object.entries(BASELINES)) {
    const r = await evaluate(t => b.run(t, cat, scene), rep.filter(t => t.split === split), scene);
    rows.push({ name, split, n: r.n, score: r.score, grammar: r.grammar, fidelity: r.fidelity, valid: r.valid, note: b.note });
    console.log(split.padEnd(6), name.padEnd(13), 'n', String(r.n).padStart(3), 'score', r.score, 'grammar', r.grammar, 'fidelity', r.fidelity, 'valid', r.valid);
  }
  const receipt = { instrument: `x3d.style evals.mjs, Node ${process.version}; no model called`, tasks: T.length,
    split: `${rep.filter(t => t.split === 'train').length} repair train, ${rep.filter(t => t.split === 'dev').length} repair dev, ${T.filter(t => t.family === 'author').length} author (no baseline run)`,
    metric: `${FORMULA}; fidelity = 1 - mean Delta E OK from the input palette / ${FIDELITY_FULL_LOSS}; brief = structure untouched`,
    dspy: 'socket built in evals/dspy_socket.py, switched off (XST_DSPY unset); nothing was optimized and nothing was spent',
    baselines: rows.filter(r => r.split === 'dev').map(r => ({ ...r, name: `${r.name} (dev, n=${r.n})` })), all: rows };
  if (a1) fs.writeFileSync(a1, JSON.stringify(receipt, null, 1));
} else { console.error('usage: eval.mjs baselines [out.json] | tasks [train|dev] | score <task-id> < style.json'); process.exit(2); }
