/* MetadataBoolean (Core level 1): The metadata provided by this node is contained in the Boolean values of the value field.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('MetadataBoolean', {
  component: 'Core', level: 1,
  container: 'value',
  defs: {
    metadata: ['SFNode', IO, null],
    name: ['SFString', IO, ""],
    reference: ['SFString', IO, ""],
    value: ['MFBool', IO, []],
  },
  // Core: data only. The reader keeps name, reference and value; an application reads them through the SAI. Nothing is drawn.
});
