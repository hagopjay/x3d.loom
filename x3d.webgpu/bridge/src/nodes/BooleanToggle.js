/* BooleanToggle (EventUtilities level 1): BooleanToggle maintains state and negates output when a true input is provided.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BooleanToggle', {
  component: 'EventUtilities', level: 1,
  container: 'children',
  defs: {
    metadata: ['SFNode', IO, null],
    set_boolean: ['SFBool', IN, false],
    toggle: ['SFBool', IO, false],
  },
  // EventUtilities: a true set_boolean negates the stored value and sends it; a false set_boolean does nothing
  receive(n, field, v) {
    if (field !== 'set_boolean') return false;
    if (v) { n.f.toggle = !n.f.toggle; events.emit(n, 'toggle', n.f.toggle); }
    return true;
  },
});
