// Sound, checked without ears: an AnalyserNode tapped into every connection to the WebAudio destination measures the signal that
// reaches the speakers; the page reports voices triggered and impact events. usage: node probes/run-sound.mjs [browser]
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'node:fs';
const [, , which = 'chromium'] = process.argv;
const launch = { chromium: () => chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] }), firefox: () => firefox.launch({ firefoxUserPrefs: { 'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0 } }), webkit: () => webkit.launch() }[which];
const browser = await launch();
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => {
  const connect = AudioNode.prototype.connect;
  window.__tap = { rms: [], peak: 0 };
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = connect.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode) {
      const ctx = dest.context;
      if (!ctx.__an) { ctx.__an = ctx.createAnalyser(); ctx.__an.fftSize = 2048; window.__tapCtx = ctx; }
      connect.call(this, ctx.__an);
    }
    return r;
  };
  setInterval(() => {
    const c = window.__tapCtx; if (!c) return;
    const a = new Float32Array(2048); c.__an.getFloatTimeDomainData(a);
    let s = 0, p = 0; for (const v of a) { s += v * v; p = Math.max(p, Math.abs(v)); }
    window.__tap.rms.push(+Math.sqrt(s / a.length).toFixed(5)); window.__tap.peak = Math.max(window.__tap.peak, p); window.__tap.state = c.state;
  }, 50);
});
const logs = []; page.on('pageerror', (e) => logs.push(e.stack?.split('\n').slice(0, 4).join(' | ')));
await page.goto((process.env.BASE ?? 'http://127.0.0.1:5181/') + 'machine.html');
await page.waitForFunction(() => window.__mm?.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__mm.enterRun());
await page.waitForFunction(() => window.__mm.mode === 'run' && window.__mm.sound, null, { timeout: 60000 });
await page.locator('#canvas').click({ position: { x: 5, y: 5 } });
const before = await page.evaluate(() => ({ rms: window.__tap.rms.slice(-10) }));
await page.keyboard.press('0');
await page.waitForTimeout(8000);
const r = await page.evaluate(() => ({ nonFinite: window.__mm.sound.nonFinite.slice(0, 3), triggered: window.__mm.sound.triggered, skipped: window.__mm.sound.skipped, impacts: window.__mm.bridge.stats.newContacts, state: window.__tap.state, peak: window.__tap.peak, rms: window.__tap.rms }));
const rms = r.rms, loud = rms.filter((x) => x > 0.002).length;
const out = { browser: which, version: browser.version(), nonFinite: r.nonFinite, triggered: r.triggered, skipped: r.skipped, impactEvents: r.impacts, audioContext: r.state, peak: r.peak, maxRms: Math.max(0, ...rms), windowsWithSignal: `${loud}/${rms.length} (50 ms windows, RMS > 0.002)`, rmsBeforeDrop: before.rms, errors: logs };
writeFileSync(`evidence/p4-sound-${which}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
await browser.close();
