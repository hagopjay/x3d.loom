/* StringSensor (KeyDeviceSensor level 2): StringSensor generates events as the user presses keys on the keyboard.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('StringSensor', {
  component: 'KeyDeviceSensor', level: 2,
  container: 'children',
  defs: {
    deletionAllowed: ['SFBool', IO, true],
    description: ['SFString', IO, ""],
    enabled: ['SFBool', IO, true],
    enteredText: ['SFString', OUT, ""],
    finalText: ['SFString', OUT, ""],
    isActive: ['SFBool', OUT, false],
    metadata: ['SFNode', IO, null],
  },
  // KeyDeviceSensor: collects typed characters. First character starts it (isActive, enteredText restarts); Backspace deletes when deletionAllowed;
  // Enter sends enteredText as finalText, clears it and stops; Escape clears and stops. Same rules as X_ITE 16.6.0.
  build(body, n) { R.bridge.live('key').add(n); return null; },
  keydown(n, e) {
    if (!n.f.enabled) return false;
    const f = n.f;
    switch (e.key) {
      case 'Backspace': if (f.isActive && f.deletionAllowed && f.enteredText.length) BR.fire(n, 'enteredText', f.enteredText.slice(0, -1)); break;
      case 'Enter': BR.fire(n, 'finalText', f.enteredText); BR.fire(n, 'enteredText', ''); if (f.isActive) BR.fire(n, 'isActive', false); break;
      case 'Escape': BR.fire(n, 'enteredText', ''); if (f.isActive) BR.fire(n, 'isActive', false); break;
      case 'Tab': break;
      default:
        if (e.key.length === 1) {
          if (!f.isActive) { BR.fire(n, 'isActive', true); BR.fire(n, 'enteredText', ''); }
          BR.fire(n, 'enteredText', f.enteredText + e.key);
        }
    }
    return true;
  },
  keyup() { return false; },
  release() {},
});
