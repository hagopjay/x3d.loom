import './mk.mjs';
const { sin, cos, atan2 } = await import('../dist/core.mjs?' + Date.now());
let es = 0, ec = 0, ea = 0, s = 99; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
for (let i = 0; i < 400000; i++) { const x = (r() - 0.5) * 400; es = Math.max(es, Math.abs(sin(x) - Math.sin(x))); ec = Math.max(ec, Math.abs(cos(x) - Math.cos(x))); const y = (r() - 0.5) * 20, z = (r() - 0.5) * 20; ea = Math.max(ea, Math.abs(atan2(y, z) - Math.atan2(y, z))); }
console.log('max abs error over 400,000 random arguments, |x| < 200: sin', es.toExponential(2), 'cos', ec.toExponential(2), 'atan2', ea.toExponential(2));
console.log('exact: sin(0)', sin(0), 'cos(0)', cos(0), 'atan2(0,1)', atan2(0, 1), 'atan2(1,0)-pi/2', atan2(1, 0) - Math.PI / 2, 'atan2(0,-1)-pi', atan2(0, -1) - Math.PI, 'atan2(-1,-1)+3pi/4', atan2(-1, -1) + 3 * Math.PI / 4);
