/* audio-probe.js: Web Audio signal probes for the bridge test runner (injected into the page of both engines by run-tests.js).
   The Sound nodes of both engines build real Web Audio graphs on the page's own AudioContext, so the signal can be compared sample by sample, not just the settings:
     tap    [name, def | [def, def, ...], kind?, {channels?}]   (an array of nodes: one recording with a channel per node; separate taps line up too, by the audio clock's frame number)   record what comes out of the node DEF (kind 'out' default: the node's output stage; 'in': after its gain stage; 'proc': its Web Audio processor)
                                              A tap is an AudioWorklet recorder on a muted branch, so it never changes the signal and, running on the audio thread, never drops samples when the page is busy (a ScriptProcessor does: the first version lost chunks while the Babylon body drew). channels (default 2, speakers mix); with channels given the tap is discrete.
     sig    [name, key, opts?, expect?]       measure the recording of a tap and store the numbers as map[key.rms], key.peak, key.f0 ... (compared between the engines by the spec's "agree")
     fsig   [def, field, key, opts?, expect?] the same measures on an Analyser data field (floatTimeDomainData, byteTimeDomainData, floatFrequencyData, byteFrequencyData)
     untap  name
   close  [keyA, keyB, tol]                   fails when the two stored numbers differ by more than tol (a measured value against an expected one stored with jsmap)
   bytemap [def, key]                       checks an Analyser's byteFrequencyData against its floatFrequencyData and the decibel range: map[key.maxErr] = largest byte difference
     jsmap  [code, key]                       a page expression (a number, an array of numbers or an object of numbers; `scene` is the loaded scene, AUD.ctx the audio context) stored as map[key] (map[key.name] for an object)
   opts: after (seconds: look for the onset after this time), freq (the data is a spectrum: only argmax, max, len), freqHz (an Analyser field: expected peak frequency, key.binErr = peak bin minus the expected bin), from, to (seconds after the tap started; negative = from the end), default the last 0.5 s; f0 (expected frequency for the harmonics, else the estimate), harm (how many, default 5),
         ch (channel, default 0), bands [edges in Hz] (rms in each band), ref (another tap, or this one with refCh: the reference channel; lag = onset of this tap minus onset of ref, in seconds; corr = best normalised correlation with ref within +-8 samples, sign kept), thr (onset threshold, default 0.05), byte (data is 0..255 centred on 128)
   expect: {rms:[v,tol], peak:[..], f0:[..], h1:[..], lag:[..], band0:[..], silent:true (rms below 1e-4)}; a miss fails the step in the engine that produced it.
   Metrics are phase independent (rms, peak, mean, f0, harmonic amplitudes at the exact frequency with a Hann window, band rms, onset lag), because the two engines run on two realtime audio clocks. */
window.AUD = (() => {
  const taps = {}, nodes = {};
  const WORKLET = 'class RecTap extends AudioWorkletProcessor { constructor(o) { super(); this.n = o.processorOptions.n; this.size = 4096; this.buf = []; for (let i = 0; i < this.n; i++) this.buf.push(new Float32Array(this.size)); this.len = 0; this.f0 = null; this.port.onmessage = (e) => { if (e.data === "flush") { this.send(); this.port.postMessage({ ack: true }); } }; } send() { if (!this.len) return; const d = this.buf.map((b) => b.slice(0, this.len)); this.port.postMessage({ f0: this.f0, data: d }, d.map((x) => x.buffer)); this.f0 = null; this.len = 0; } process(inputs) { const inp = inputs[0]; if (this.f0 === null) this.f0 = currentFrame; for (let c = 0; c < this.n; c++) { const ch = inp[c]; if (ch) this.buf[c].set(ch, this.len); else this.buf[c].fill(0, this.len, this.len + 128); } this.len += 128; if (this.len >= this.size) this.send(); return true; } } registerProcessor("rec-tap", RecTap);';
  const flush = (t) => new Promise((res) => { t.ack = res; t.sp.port.postMessage('flush'); });
  const fft = (re, im) => {                       // in place radix 2
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const u = i + k, v = i + k + len / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr; re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
    }
  };
  const flat = (t, ch) => { let n = 0; for (const c of t.chunks) n += c[ch].length; const o = new Float32Array(n); let k = 0; for (const c of t.chunks) { o.set(c[ch], k); k += c[ch].length; } return o; };
  const onset = (x, thr, from) => { for (let i = from || 0; i < x.length; i++) if (Math.abs(x[i]) > thr) return i; return -1; };
  const dftAmp = (x, w, sw, f, sr) => { let re = 0, im = 0; const k = 2 * Math.PI * f / sr; for (let i = 0; i < x.length; i++) { const v = x[i] * w[i]; re += v * Math.cos(k * i); im -= v * Math.sin(k * i); } return 2 * Math.hypot(re, im) / sw; };
  /* the numbers of one signal x (Float32Array, mono) at sample rate sr */
  function measure(x, sr, o) {
    const m = {}, n = x.length; if (!n) return { rms: NaN, peak: NaN, mean: NaN, f0: NaN, n: 0 };
    let s = 0, p = 0, mu = 0; for (let i = 0; i < n; i++) { s += x[i] * x[i]; p = Math.max(p, Math.abs(x[i])); mu += x[i]; }
    m.rms = Math.sqrt(s / n); m.peak = p; m.mean = mu / n; m.n = n;
    const N = Math.min(16384, 1 << Math.floor(Math.log2(n))), seg = x.subarray(n - N), w = new Float64Array(N); let sw = 0, sw2 = 0;
    for (let i = 0; i < N; i++) { w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); sw += w[i]; sw2 += w[i] * w[i]; }
    const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = seg[i] * w[i]; fft(re, im);
    const mag = new Float64Array(N / 2); for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    let kb = 2; for (let k = 2; k < N / 2 - 1; k++) if (mag[k] > mag[kb]) kb = k;
    const a = Math.log(mag[kb - 1] + 1e-30), b = Math.log(mag[kb] + 1e-30), c = Math.log(mag[kb + 1] + 1e-30), d = a - 2 * b + c, off = d ? 0.5 * (a - c) / d : 0;
    m.f0 = m.rms < 1e-6 ? 0 : (kb + off) * sr / N;
    const f0 = o.f0 || m.f0, H = o.harm === undefined ? 5 : o.harm;
    if (f0 > 0) for (let h = 1; h <= H; h++) m['h' + h] = f0 * h < sr / 2 ? dftAmp(seg, w, sw, f0 * h, sr) : 0;
    if (o.bands) for (let q = 0; q + 1 < o.bands.length; q++) { let e = 0; for (let k = 1; k < N / 2; k++) { const f = k * sr / N; if (f >= o.bands[q] && f < o.bands[q + 1]) e += mag[k] * mag[k]; } m['band' + q] = Math.sqrt(2 * e / (N * sw2)); }
    return m;
  }
  const segOf = (x, sr, o) => { const n = x.length, f = o.from === undefined ? -0.5 : o.from, t = o.to === undefined ? n / sr : o.to; const i0 = f < 0 ? Math.max(0, n + Math.round(f * sr)) : Math.round(f * sr), i1 = t < 0 ? n + Math.round(t * sr) : Math.min(n, Math.round(t * sr)); return x.subarray(i0, Math.max(i0, i1)); };
  function store(out, key, m) { for (const k in m) if (typeof m[k] === 'number') out.map[key + '.' + k] = Math.round(m[k] * 1e6) / 1e6; }
  function check(m, ex, fail, label) {
    if (!ex) return;
    for (const k in ex) {
      if (k === 'silent') { if (ex[k] !== (m.rms < 1e-4)) fail(label + ' silent=' + (m.rms < 1e-4) + ' (rms ' + m.rms + '), expected ' + ex[k]); continue; }
      const [v, tol] = ex[k]; if (!(Math.abs(m[k] - v) <= tol)) fail(label + '.' + k + ' is ' + m[k] + ', expected ' + v + ' within ' + tol);
    }
  }
  const AUD = {
    ctx: null,
    /* expected values computed on the page, for jsmap: independent of both engines' Web Audio nodes */
    sr: () => AUD.ctx.sampleRate,
    /* |H(f)| of a Web Audio BiquadFilterNode (the cookbook formulas of the Web Audio specification; lowpass and highpass take Q in dB there). gainDb is the filter's own gain (0 in the bridge: X3D gain is the input stage) */
    biquadMag(type, f0, Q, fs, f, gainDb) {
      const A = Math.pow(10, (gainDb || 0) / 40), w0 = 2 * Math.PI * f0 / fs, cw = Math.cos(w0), sw = Math.sin(w0);
      const Qlin = type === 'lowpass' || type === 'highpass' ? Math.pow(10, Q / 20) : Q, al = type === 'lowpass' || type === 'highpass' ? sw / (2 * Qlin) : sw / (2 * Q);
      let b, a;
      switch (type) {
        case 'lowpass': b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]; break;
        case 'highpass': b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]; break;
        case 'bandpass': b = [al, 0, -al]; a = [1 + al, -2 * cw, 1 - al]; break;
        case 'notch': b = [1, -2 * cw, 1]; a = [1 + al, -2 * cw, 1 - al]; break;
        case 'allpass': b = [1 - al, -2 * cw, 1 + al]; a = [1 + al, -2 * cw, 1 - al]; break;
        case 'peaking': b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]; break;
        default: return 1;
      }
      const w = 2 * Math.PI * f / fs, ej = (k) => [Math.cos(-k * w), Math.sin(-k * w)], sum = (c) => c.reduce((p, v, k) => { const e = ej(k); return [p[0] + v * e[0], p[1] + v * e[1]]; }, [0, 0]);
      const n = sum(b), d = sum(a); return Math.hypot(n[0], n[1]) / Math.hypot(d[0], d[1]);
    },
    /* the measures of a sine of amplitude amp at f Hz after a WaveShaper curve (linear interpolation over -1..1, as the Web Audio specification says) */
    shaped(curve, amp, f, sr) {
      const N = 16384, x = new Float32Array(N), L = curve.length;
      for (let i = 0; i < N; i++) { const v = amp * Math.sin(2 * Math.PI * f * i / sr), k = (L - 1) * (v + 1) / 2; x[i] = k <= 0 ? curve[0] : k >= L - 1 ? curve[L - 1] : curve[Math.floor(k)] + (k - Math.floor(k)) * (curve[Math.floor(k) + 1] - curve[Math.floor(k)]); }
      return measure(x, sr, { f0: f });
    },
    /* Web Audio panner, equal power, mono input: left and right gain for a source at (x, y, z) in listener space, distance model and reference distance 1, rolloff 1 (the Web Audio specification) */
    panGain(x, y, z, model, ref, rolloff, maxD) {
      const d = Math.hypot(x, y, z); let g;
      if (model === 'linear') g = 1 - rolloff * (Math.min(Math.max(d, ref), maxD) - ref) / (maxD - ref); else if (model === 'exponential') g = Math.pow(Math.max(d, ref) / ref, -rolloff); else g = ref / (ref + rolloff * (Math.max(d, ref) - ref));
      let az = Math.atan2(x, -z) * 180 / Math.PI; if (az < -90) az = -180 - az; else if (az > 90) az = 180 - az;
      const p = (az + 90) / 180, th = p * Math.PI / 2; return [g * Math.cos(th), g * Math.sin(th)];
    },
    measure, taps, nodes,
    async step(eng, s, out, fail, scene) {
      if (!eng.audioCtx) throw new Error('no audio hooks in this page');
      AUD.ctx = eng.audioCtx();
      if (s.tap) {
        const [name, def, kind, op] = s.tap, ctx = eng.audioCtx(), one = (d) => (d[0] === '$' ? AUD.nodes[d.slice(1)] : eng.audioNode(d, kind || 'out', scene));
        let src, nch = (op && op.channels) || 2, group = null;
        if (Array.isArray(def)) {       // several nodes in ONE recording, one channel each (mono mix of the node's output): sample aligned, so lag and correlation between them are exact
          group = def.map(one); if (group.some((q) => !q)) throw new Error('tap ' + name + ': no audio node for ' + def); nch = def.length;
          const mg = ctx.createChannelMerger(nch); group.forEach((q, i) => q.connect(mg, 0, i)); src = mg;
        } else { src = one(def); if (!src) throw new Error('tap ' + name + ': no audio node for ' + def + ' (' + (kind || 'out') + ')'); }
        if (ctx.state !== 'running') await ctx.resume().catch(() => {});
        if (!ctx.__recTap) { ctx.__recTap = true; const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })); await ctx.audioWorklet.addModule(url); }
        const t = { ctx, chunks: [], nch, t0: null, sr: ctx.sampleRate, src, group };
        /* the recorder runs on the audio thread (an AudioWorklet), so a busy page cannot make it drop samples; every chunk carries the audio clock's frame number, so two taps line up to the sample */
        const wn = t.sp = new AudioWorkletNode(ctx, 'rec-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: nch, channelCountMode: 'explicit', channelInterpretation: (op && op.channels) || group ? 'discrete' : 'speakers', processorOptions: { n: nch } });
        wn.port.onmessage = (e) => { if (e.data.ack) { if (t.ack) t.ack(); return; } if (t.t0 === null) t.t0 = e.data.f0 / ctx.sampleRate; t.chunks.push(e.data.data); };
        /* a Web Audio node that nothing pulls towards the destination is not processed: its state (a delay line, a convolver tail) freezes, and the next tap sees stale signal. Every tapped node therefore also feeds a muted sink for the life of the page. */
        const sink = ctx.__sink || (ctx.__sink = (() => { const g = ctx.createGain(); g.gain.value = 0; g.connect(ctx.destination); return g; })());
        for (const q of group || [src]) { if (!q.__sunk) { q.connect(sink); q.__sunk = true; } }
        const mute = t.mute = ctx.createGain(); mute.gain.value = 0; src.connect(wn); wn.connect(mute); mute.connect(ctx.destination); taps[name] = t; return;
      }
      if (s.untap) { const t = taps[s.untap]; if (t) { try { t.src.disconnect(t.sp); } catch (e) { /* gone */ } if (t.group) t.group.forEach((q) => { try { q.disconnect(t.src); } catch (e) { /* gone */ } });  t.sp.disconnect(); t.mute.disconnect(); delete taps[s.untap]; } return; }
      if (s.close) { const [a, b, tol] = s.close, va = out.map[a], vb = typeof b === 'number' ? b : out.map[b]; if (!(Math.abs(va - vb) <= tol)) fail(a + ' ' + va + ' vs ' + b + ' ' + vb + ' (tol ' + tol + ')'); return; }
      if (s.bytemap) {
        const [def, key, tol] = s.bytemap, node = scene.getNamedNode(def), fl = Array.from(node.floatFrequencyData || []), by = Array.from(node.byteFrequencyData || []), lo = node.minDecibels, hi = node.maxDecibels; let worst = 0;
        for (let i = 0; i < Math.min(fl.length, by.length); i++) { const e = Math.min(255, Math.max(0, Math.floor(255 * (fl[i] - lo) / (hi - lo)))); worst = Math.max(worst, Math.abs(e - by[i])); }
        out.map[key + '.maxErr'] = worst; out.map[key + '.len'] = fl.length; if (tol !== undefined && !(worst <= tol)) fail(key + ' byte data is off by ' + worst + ' from the float data and the decibel range (tol ' + tol + ')'); return;
      }
      if (s.jsmap) { const [code, key] = s.jsmap; const v = await new Function('scene', 'map', 'return (' + code + ')')(scene, out.map); if (v && typeof v === 'object' && !Array.isArray(v)) store(out, key, v); else out.map[key] = v; return; }
      if (s.sig) {
        const [name, key, o0, ex] = s.sig, o = o0 || {}, t = taps[name]; if (!t) throw new Error('no tap ' + name);
        await flush(t); if (o.ref && taps[o.ref]) await flush(taps[o.ref]);
        const full = flat(t, o.ch || 0), x = segOf(full, t.sr, o), m = measure(x, t.sr, o);
        if (o.ref) {
          const r = taps[o.ref], rf = flat(r, o.refCh || 0), thr = o.thr || 0.05, a = onset(full, thr, Math.round((o.after || 0) * t.sr)), b = onset(rf, thr, Math.round((o.after || 0) * r.sr));
          m.lag = a < 0 || b < 0 ? NaN : (t.t0 + a / t.sr) - (r.t0 + b / r.sr); m.onset = a < 0 ? NaN : t.t0 + a / t.sr; m.onsetIdx = a; m.refIdx = b; const pre = (q) => { let e = 0; const k = Math.min(2205, q.length); for (let i = 0; i < k; i++) e += q[i] * q[i]; return Math.sqrt(e / Math.max(1, k)); }; m.pre = pre(full); m.refPre = pre(rf);
          /* correlation of the two recordings over the same stretch of the audio clock (the last 0.3 s of the shorter one) */
          const n = Math.round(0.3 * t.sr), endT = Math.min(t.t0 + full.length / t.sr, r.t0 + rf.length / r.sr) - 0.05; let best = 0, bl = 0;
          for (let d = -8; d <= 8; d++) {
            const i0 = Math.round((endT - t.t0) * t.sr) - n, j0 = Math.round((endT - r.t0) * r.sr) - n + d; if (i0 < 0 || j0 < 0) continue;
            let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const xv = full[i0 + i], yv = rf[j0 + i]; sxy += xv * yv; sxx += xv * xv; syy += yv * yv; }
            const c = sxx > 1e-12 && syy > 1e-12 ? sxy / Math.sqrt(sxx * syy) : 0; if (Math.abs(c) > Math.abs(best)) { best = c; bl = d; }
          }
          m.corr = best; m.corrLag = bl;
        }
        if (o.env) { const w = Math.round(o.env * t.sr), E = []; for (let ch = 0; ch < t.nch; ch++) { const f = flat(t, ch), e = []; for (let i = 0; i + w <= f.length && e.length < (o.envN || 80); i += w) { let q = 0; for (let k = 0; k < w; k++) q += f[i + k] * f[i + k]; e.push(Math.round(Math.sqrt(q / w) * 100) / 100); } E.push(e); } out.map[key + '.env'] = E.flat(); }     // debugging: rms per o.env seconds, every channel, first envN windows
        store(out, key, m); check(m, ex, fail, key); return;
      }
      if (s.fsig) {
        const [def, field, key, o0, ex] = s.fsig, o = o0 || {}, node = scene.getNamedNode(def), raw = Array.from(node[field] || []), sr = eng.audioCtx().sampleRate;
        let am = 0; for (let i = 1; i < raw.length; i++) if (raw[i] > raw[am]) am = i;
        const m = o.freq ? { len: raw.length } : measure(Float32Array.from(raw, (v) => (o.byte ? (v - 128) / 128 : v)), sr, o);
        m.argmax = am; m.max = raw[am]; m.len = raw.length; if (o.freqHz) m.binErr = am - o.freqHz * 2 * raw.length / sr;
        store(out, key, m); check(m, ex, fail, key); return;
      }
    },
  };
  return AUD;
})();
