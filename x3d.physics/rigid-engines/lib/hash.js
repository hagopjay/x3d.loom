const crypto = require('crypto');
// sha256 of the float64 bits of every probe's position and orientation: the whole trace, or only the last sample
module.exports = (tr, last) => { const h = crypto.createHash('sha256'); for (const d of Object.keys(tr).sort()) { const t = tr[d], from = last ? t.p.length - 1 : 0; for (let i = from; i < t.p.length; i++) h.update(Buffer.from(new Float64Array([...t.p[i], ...t.q[i]]).buffer)); } return h.digest('hex').slice(0, 16); };
