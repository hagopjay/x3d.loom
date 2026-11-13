/* IntegerTrigger (EventUtilities level 1): IntegerTrigger converts set_boolean true input events to an integer value (for example, useful when animating whichChoice in a Switch node).
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('IntegerTrigger', {
  component: 'EventUtilities', level: 1,
  container: 'children',
  defs: {
    integerKey: ['SFInt32', IO, -1],
    metadata: ['SFNode', IO, null],
    set_boolean: ['SFBool', IN, false],
    triggerValue: ['SFInt32', OUT, 0],
  },
  // EventUtilities: a true set_boolean sends integerKey as triggerValue; false is ignored
  receive(n, field, v) {
    if (field !== 'set_boolean') return false;
    if (v) { n.f.triggerValue = n.f.integerKey; events.emit(n, 'triggerValue', n.f.triggerValue); }
    return true;
  },
});
