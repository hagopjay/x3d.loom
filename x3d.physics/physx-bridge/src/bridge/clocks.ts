// "Clocks follow physics": the scene's running TimeSensors start when physics starts and pause with it.
// Why: a looping TimeSensor with startTime 0 runs from the epoch (X3D semantics), so at load a ROUTE-driven platform is wherever
// (now mod cycleInterval) puts it, not where the author placed the bodies it carries (measured: elevator at fraction 0.41 at load).
// How (standard fields only): right after load, TimeSensors running since load are restarted (enabled FALSE, wait for isActive FALSE,
// startTime = now, enabled TRUE), allowed one fraction event so their ROUTEs place the driven parts at fraction 0, then paused (X3D 4.0 pauseTime);
// start()/pause() then use resumeTime/pauseTime. Restarting at Run instead made the platform jump from its load-time phase
// to fraction 0 in one frame and sweep through the cube it carries (measured). X3D time is Date.now()/1000 (X_ITE samples it
// once per frame; its SAI exposes no current time).
import { findNodes } from './reader.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;

export class SceneClocks {
  private clocks: SAI[] = [];
  /**
   * Call right after replaceWorld (X_ITE ignores time fields on TimeSensors that are not live yet: measured). Resolves when the clocks
   * are paused at phase 0. Selection is by the static condition (loop, enabled, started, not stopped), not isActive, which is not
   * always TRUE yet right after replaceWorld (measured: a race that left the elevator in its epoch phase in one run of three).
   */
  async hold(scene: SAI) { return this.holdNodes(findNodes(scene, 'TimeSensor')); }

  /** The same for TimeSensors reached another way (the race ghost's clocks come in through IMPORT). */
  async holdNodes(nodes: SAI[]) {
    const now0 = Date.now() / 1000;
    this.clocks = nodes.filter((c) => c.loop && c.enabled && c.startTime <= now0 && !(c.stopTime > c.startTime && c.stopTime <= now0));
    if (!this.clocks.length) return;
    const seen = new Set<SAI>();
    const until = (cond: () => boolean, ms: number) => new Promise<void>((res) => {
      const t0 = performance.now();
      const tick = () => (cond() || performance.now() - t0 > ms ? res() : requestAnimationFrame(tick));
      tick();
    });
    this.clocks.forEach((c, i) => c.addFieldCallback(`x3d-physx-hold-${i}`, 'fraction_changed', () => seen.add(c)));
    // Deactivate first and wait for it: X3D ignores startTime sent to an active TimeSensor, and enabled FALSE/TRUE in one JavaScript
    // turn collapse into one event (measured: no restart).
    for (const c of this.clocks) c.enabled = false;
    await until(() => this.clocks.every((c) => !c.isActive), 1000);
    // Start and schedule the pause 1 ms later in the same turn: pausing after the first fraction event took several frames and let a
    // platform drift 14 mm into the body it carries (measured).
    const now = Date.now() / 1000;
    for (const c of this.clocks) { c.startTime = now; c.pauseTime = now + 0.001; c.enabled = true; }
    await until(() => this.clocks.every((c) => c.isPaused) && seen.size === this.clocks.length, 1000);
    this.clocks.forEach((c, i) => c.removeFieldCallback(`x3d-physx-hold-${i}`, 'fraction_changed'));
  }
  start() { const now = Date.now() / 1000; for (const c of this.clocks) c.resumeTime = now; }
  pause() { const now = Date.now() / 1000; for (const c of this.clocks) c.pauseTime = now; }
  get count() { return this.clocks.length; }
}
