/* TimeTrigger (EventUtilities level 1): TimeTrigger converts boolean true events to time events.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TimeTrigger', {
  component: 'EventUtilities', level: 1,
  container: 'children',
  defs: {
    metadata: ['SFNode', IO, null],
    set_boolean: ['SFBool', IN, false],
    triggerTime: ['SFTime', OUT, 0],
  },
  // EventUtilities: a true set_boolean sends the time of the event (this timestamp) as triggerTime
  receive(n, field, v) {
    if (field !== 'set_boolean') return false;
    if (v) { n.f.triggerTime = events.ts; events.emit(n, 'triggerTime', events.ts); }
    return true;
  },
});
