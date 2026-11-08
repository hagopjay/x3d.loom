/* ScreenFontStyle (Layout level 2): ScreenFontStyle is an X3DFontStyleNode defines the size, family, justification, and other styles used within a screen layout.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('ScreenFontStyle', {
  component: 'Layout', level: 2,
  container: 'fontStyle',
  defs: {
    family: ['MFString', IO, ['SERIF']],              // defaults as in X_ITE 16.6.0
    horizontal: ['SFBool', IO, true],
    justify: ['MFString', IO, ['BEGIN']],
    language: ['SFString', IO, ""],
    leftToRight: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    pointSize: ['SFFloat', IO, 12.0],
    spacing: ['SFFloat', IO, 1.0],
    style: ['SFString', IO, "PLAIN"],
    topToBottom: ['SFBool', IO, true],
  },
  /* Fields only. The body draws a Text through its own font path (FontStyle: family, style, size, justify), where this node's fields are not read; the point size in pixels is the missing part
     (gap, and the text is not drawn in screen pixels). */
  build() { return null; },
});
