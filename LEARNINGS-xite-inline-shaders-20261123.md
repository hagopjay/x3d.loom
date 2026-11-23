# Learnings: inline GLSL shaders in one X3D file, drawn by X_ITE (23 Nov 2026)

Source: a private scene (a height-field relief with a hologram look and a fractal veil) built as a single X3D 4.0 file with two `ComposedShader` nodes. Rig for every claim below: X_ITE 16.7.0 in headless Chromium on SwiftShader; validator x3d_mcp fork `4d433af`. Not yet seen on a real GPU.

## What the validator passed and the browser did not (Confirmed)

1. **Inline `ShaderPart` source needs a `data:` prefix.** A `<ShaderPart><![CDATA[#version 300 es ...]]></ShaderPart>` is schema-valid, but X_ITE treats the text as a URL, logs `ShaderPart: Couldn't load URL '...#version 300 es...'` and draws the fallback `Material`. The scene still renders, in the wrong look, with no shader error. Write `<![CDATA[data:x-shader/x-vertex,#version 300 es ...` and `data:x-shader/x-fragment,`.
2. **A texture handed over as an `SFNode` field with `USE` did not reach the sampler.** `<field name="img" type="SFNode"><ImageTexture USE="T"/></field>` sampled as black. Putting the texture in `Appearance.texture` and declaring `uniform sampler2D x3d_Texture2D [1];` worked. (Cause not isolated: Suspected the `USE` inside a field declaration.)
3. **`PointProperties` is Shape level 5.** Under profile Immersive with `Shape` level 2 the fork validator reports a profile-component error; raise the component level.

Each of these is a "valid is not visible" case: the file passes XSD and semantic checks, and only a frame shows the fault. The fallback `Material` makes failure 1 look like a styling choice, so give the fallback a colour nobody would choose on purpose while developing.

## What worked (Confirmed on the rig above)

- A shader shape joins the alpha-blended pass when its `Material` has `transparency` above 0; the fragment alpha then blends normally. No X_ITE-only `BlendMode` node is needed, so the file stays X3D 4.0.
- Time without script: `TimeSensor.fraction_changed` (cycleInterval 600) routed to an `SFFloat` shader field, multiplied back to seconds in the shader. One ROUTE per shader, written after the nodes.
- Page controls reach the uniforms through the SAI: `scene.getNamedNode("FaceShader").veil = 0.35`.
- `ElevationGrid` with `creaseAngle` 3.14 supplies smooth `x3d_Normal`; its default texture coordinates run t = 0 at the first row, so an image whose first row is the top needs `1.0 - t`.
- Keep real geometry in the file (the heights are in the `ElevationGrid`, not displaced in the vertex shader), so a reader without shaders still gets the shape.

## Candidate Loom checks

- Flag a `ShaderPart` whose CDATA starts with `#version` and has no `url` and no `data:` prefix (browser-specific, so a warning naming X_ITE).
- Flag `PointProperties` and other level-5 Shape nodes against the declared component level (the fork already does).
