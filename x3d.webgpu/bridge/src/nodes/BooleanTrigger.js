/* BooleanTrigger (EventUtilities level 1): BooleanTrigger converts time events to boolean true events.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('BooleanTrigger', {
  component: 'EventUtilities', level: 1,
  container: 'children',
  defs: {
    metadata: ['SFNode', IO, null],
    set_triggerTime: ['SFTime', IN, 0],
    triggerTrue: ['SFBool', OUT, false],
  },
  // EventUtilities: any set_triggerTime event sends triggerTrue = TRUE
  receive(n, field, v) {
    if (field !== 'set_triggerTime') return false;
    n.f.triggerTrue = true; events.emit(n, 'triggerTrue', true);
    return true;
  },
});
