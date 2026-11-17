// Build the local page from authored source. Simulation stays separately marked;
// the pinned Three runtime and addon closure are served from vendor/, never a CDN.
import fs from 'fs';
const R = (f) => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
if (!fs.existsSync(new URL('./vendor/three/ORIGIN.json', import.meta.url))) throw new Error('Run npm run vendor once before building.');
const sim = ['core.js', 'level.js', 'recipes.js', 'game.js', 'expedition.js', 'showtime.js'].map(R).join('\n'), js = ['x3dio.js', 'view.js', 'celebration.js', 'app.js'].map(R).join('\n');
if ((sim + js).includes('</scr' + 'ipt')) throw new Error('script close tag in source');
const template = R('template.html').replace('https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js', './vendor/three/build/three.module.js');
if (/fonts\.googleapis|fonts\.gstatic|https:\/\/cdn\./.test(template)) throw new Error('External runtime/font URL remains in the page template.');
const html = template.replace('/*__SIM__*/', () => sim).replace('/*__JS__*/', () => js);
fs.writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('index.html', (html.length / 1024).toFixed(0), 'KB');
