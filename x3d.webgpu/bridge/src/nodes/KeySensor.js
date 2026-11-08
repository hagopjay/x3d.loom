/* KeySensor (KeyDeviceSensor level 1): KeySensor generates events as the user presses keys on the keyboard.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('KeySensor', {
  component: 'KeyDeviceSensor', level: 1,
  container: 'children',
  defs: {
    actionKeyPress: ['SFInt32', OUT, 0],
    actionKeyRelease: ['SFInt32', OUT, 0],
    altKey: ['SFBool', OUT, false],
    controlKey: ['SFBool', OUT, false],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    isActive: ['SFBool', OUT, false],
    keyPress: ['SFString', OUT, ""],
    keyRelease: ['SFString', OUT, ""],
    metadata: ['SFNode', IO, null],
    shiftKey: ['SFBool', OUT, false],
  },
  // KeyDeviceSensor: key events from the canvas (it takes focus). Same field rules as X_ITE 16.6.0: isActive goes true on the first key down and false on a key up,
  // Shift/Control/Alt set their flags, action keys (F1-F12 = 1-12, Home End PageUp PageDown = 13-16, arrows = 17-20) go to actionKeyPress/Release, characters to keyPress/Release.
  build(body, n) { R.bridge.live('key').add(n); return null; },
  keydown(n, e) {
    if (!n.f.enabled) return false;
    if (!n.f.isActive) BR.fire(n, 'isActive', true);
    const m = BR.keys.mod[e.key], a = BR.keys.action[e.key], t = BR.keys.text(e);
    if (m) BR.fire(n, m, true); else if (a) BR.fire(n, 'actionKeyPress', a); else if (t !== null) BR.fire(n, 'keyPress', t);
    return true;
  },
  keyup(n, e) {
    if (!n.f.enabled) return false;
    const m = BR.keys.mod[e.key], a = BR.keys.action[e.key], t = BR.keys.text(e);
    if (m) BR.fire(n, m, false); else if (a) BR.fire(n, 'actionKeyRelease', a); else if (t !== null) BR.fire(n, 'keyRelease', t);
    if (n.f.isActive) BR.fire(n, 'isActive', false);
    return true;
  },
  release(n) { for (const m of ['shiftKey', 'controlKey', 'altKey']) if (n.f[m]) BR.fire(n, m, false); if (n.f.isActive) BR.fire(n, 'isActive', false); },
});
