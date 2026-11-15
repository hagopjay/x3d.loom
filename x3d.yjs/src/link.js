// In-process transport between two Y.Docs with a latency knob and an offline switch: stands in for
// a relay (y-websocket / y-webrtc) so tests and the demo need no server. Free, deterministic.
import * as Y from 'yjs'
export class Link {
  constructor(a, b, { latency = 0 } = {}) {
    this.a = a; this.b = b; this.latency = latency; this.online = true; this.sent = 0; this.bytes = 0
    this._h = [[a, b], [b, a]].map(([x, y]) => {
      const h = (u, origin) => { if (origin === this) return; this._send(u, y) }
      x.on('update', h); return () => x.off('update', h)
    })
  }
  _send(u, to) {
    if (!this.online) return
    this.sent++; this.bytes += u.length
    const go = () => Y.applyUpdate(to, u, this)
    this.latency ? setTimeout(go, this.latency) : go()
  }
  setOnline(on) {
    const was = this.online; this.online = on
    if (on && !was) for (const [x, y] of [[this.a, this.b], [this.b, this.a]]) { // reconnect: exchange what the other lacks
      const u = Y.encodeStateAsUpdate(x, Y.encodeStateVector(y)); this.sent++; this.bytes += u.length
      const go = () => Y.applyUpdate(y, u, this); this.latency ? setTimeout(go, this.latency) : go()
    }
  }
  close() { this._h.forEach(f => f()) }
}
