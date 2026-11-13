/* MovieTexture (Texturing level 3): MovieTexture applies a 2D movie image to surface geometry, or provides audio for a Sound node.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('MovieTexture', {
  component: 'Texturing', level: 3,
  container: 'texture',
  defs: {
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    description: ['SFString', IO, ""],
    duration_changed: ['SFTime', OUT, 0],
    elapsedTime: ['SFTime', OUT, 0],
    enabled: ['SFBool', IO, true],
    gain: ['SFFloat', IO, 1],
    isActive: ['SFBool', OUT, false],
    isPaused: ['SFBool', OUT, false],
    load: ['SFBool', IO, true],
    loop: ['SFBool', IO, false],
    metadata: ['SFNode', IO, null],
    pauseTime: ['SFTime', IO, 0],
    pitch: ['SFFloat', IO, 1.0],
    repeatS: ['SFBool', INIT, true],
    repeatT: ['SFBool', INIT, true],
    resumeTime: ['SFTime', IO, 0],
    speed: ['SFFloat', IO, 1.0],
    startTime: ['SFTime', IO, 0],
    stopTime: ['SFTime', IO, 0],
    textureProperties: ['SFNode', INIT, null],
    url: ['MFString', IO, []],
  },
  // X3DTexture2DNode + TimeDependentNode: a video file shown as a texture. Starts when time reaches startTime, stops at stopTime (when it is after startTime) or when a non-looping
  // clip ends, pauses at pauseTime and resumes at resumeTime, as the TimeSensor family does. The page's <video> element (muted, so it may play unattended) is the source; speed is its
  // playbackRate. duration_changed fires when the file's length is known; elapsedTime counts the playing time. Needs a document; the picture is shown by the body (body-br tex).
  init(n) {
    if (typeof document === 'undefined') return;
    const v = n._video = document.createElement('video'), st = n._mt = { start: 0, t0: 0, pausedAt: 0, pausedAcc: 0 };
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.addEventListener('loadedmetadata', () => BR.fire(n, 'duration_changed', v.duration));
    v.addEventListener('ended', () => { if (n.f.isActive && !n.f.loop) st.ended = true; });
    setTimeout(() => { if (n.f.load && n.f.enabled && n.f.url && n.f.url.length) v.src = BR.resolveUrl(n.f.url[0]); }, 0);
  },
  tick(n, now) {
    const v = n._video, st = n._mt, f = n.f; if (!v || !st) return;
    if (v.playbackRate !== f.speed && f.speed > 0) v.playbackRate = f.speed;
    v.loop = !!f.loop;
    if (!f.isActive) {
      if (f.enabled && f.startTime > 0 && f.startTime > st.start && now >= f.startTime && !(f.stopTime > f.startTime && now >= f.stopTime)) {
        st.start = f.startTime; st.t0 = now; st.pausedAcc = 0; st.ended = false; v.currentTime = 0; v.play().catch(() => {});
        BR.fire(n, 'isActive', true);
      }
      return;
    }
    const stop = () => { v.pause(); if (f.isPaused) BR.fire(n, 'isPaused', false); BR.fire(n, 'isActive', false); BR.fire(n, 'elapsedTime', now - st.t0 - st.pausedAcc); };
    if ((f.stopTime > st.start && now >= f.stopTime) || st.ended) return stop();
    if (!f.isPaused) {
      if (f.pauseTime > f.resumeTime && now >= f.pauseTime && f.pauseTime >= st.start) { v.pause(); st.pausedAt = now; BR.fire(n, 'isPaused', true); }
      else BR.fire(n, 'elapsedTime', now - st.t0 - st.pausedAcc);
    } else if (f.resumeTime >= f.pauseTime && now >= f.resumeTime) { st.pausedAcc += now - st.pausedAt; v.play().catch(() => {}); BR.fire(n, 'isPaused', false); }
  },
});
