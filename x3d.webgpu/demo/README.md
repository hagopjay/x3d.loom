# First light: an X3D scene on WebGPU

Date 2026-11-07. Status: **a working demo, not the runtime the spec describes; two code reviews were still open when it was published.** One self-contained page reads an X3D 4.0 scene, runs its events, and draws it with WebGPU. It exists to show what the owner's machine does with WebGPU today (gate G1 passed there), before any of the build in [../SPEC.md](../SPEC.md) starts.

| file | what it is |
|---|---|
| [first-light.html](first-light.html) | the page: X3D parser, event model and WebGPU renderer in one file, no network, no libraries |
| [first-light.x3d](first-light.x3d) | the same scene as a standalone X3D file (the page embeds this text and shows it in its source panel) |

## How to open it

Download `first-light.html` and open the file in Chrome or Edge 113 or later (file:// works; the G1 probe ran that way). It needs no server. If WebGPU is missing it says why instead of drawing.

Drag to orbit, scroll or pinch to zoom, click the gold orb (or press B). Keys: Space pauses, R resets the view, S opens the X3D source, H hides the panels. The source panel is editable: change a colour or a ROUTE, press Apply, and the page parses it again.

## What the scene uses

44 Shapes on screen: 3 DEF templates (a monolith group with a lit strip, and two glints) reused by USE 26 times, plus 4 single shapes, 4 lights (two DirectionalLights, one with `shadows='true'`, two PointLights), Background, Fog (EXPONENTIAL), NavigationInfo with the headlight off, a Viewpoint with `centerOfRotation`, 3 TimeSensors, 6 interpolators (Orientation x2, Position, Scalar x2, Color), a TouchSensor, 13 ROUTEs, and a ParticleSystem with a PointEmitter, a ForcePhysicsModel and a WindPhysicsModel (40,000 particles by default, 10,000 to 1,000,000 from the slider through `set_maxParticles`).

Touching the orb runs one cascade: `Touch.touchTime` starts `Pulse`, whose `fraction_changed` fans out to three interpolators that drive the emitter `speed`, the ember light `intensity` and the orb's `emissiveColor`. The page's event log follows that cascade route by route.

## What the page implements, and where it stops

| area | implemented | not implemented |
|---|---|---|
| parse | XML encoding, field types and defaults for the nodes below, DEF/USE as shared nodes, containerField, `colorRamp` as the X3D 3 name of ParticleSystem `color`, ROUTE resolution with `set_`/`_changed` names and type checks | ClassicVRML, JSON, PROTO, Inline, Script, IMPORT/EXPORT, textures |
| events | one timestamp per frame; inputs, then TimeSensors, then the ROUTE cascade; at most one event per output field and per ROUTE per timestamp (19775-1 4.4.8.3), which also breaks loops | SAI |
| nodes | Transform, Group, Shape, Appearance, Material, PhysicalMaterial, UnlitMaterial, Box, Sphere, Cylinder, Cone, DirectionalLight, PointLight, SpotLight, Viewpoint, NavigationInfo (EXAMINE, headlight), Background (sky and ground gradients), Fog, WorldInfo, TimeSensor, TouchSensor, Scalar/Position/Orientation/ColorInterpolator, ParticleSystem with PointEmitter, ForcePhysicsModel, WindPhysicsModel, Color, ColorRGBA | everything else is skipped with a note in the log |
| draw | WebGPU core only, no optional features: 4x MSAA into rgba16float, one 2048 shadow map for the first DirectionalLight with `shadows` TRUE (5x5 filtered), GGX PBR for PhysicalMaterial, the 17.2.2.4 equation for Material, fog per the spec formulas, particles simulated in a compute shader and drawn as camera-facing sprites | textures, LineSet/PointSet, IndexedFaceSet, more than one shadow, light scoping (all lights are treated as global; the scene keeps them at the root) |

Renderer choices beyond the spec, stated in the page: ambient light is taken from the Background (a 512-step gradient table and its 9-term spherical-harmonic irradiance), bloom, ACES tone mapping, additive particles with a glow gain, a particle `mass` of 0 read as 1 kg. X_ITE stays the reference renderer; this page is not a parity witness.

## Validation

- X3D 4.0 DTD: passes (xmllint).
- x3d_mcp fork semantic check (checkout 13121b6): 0 errors, 0 warnings, 6 notes (unused DEFs).
- X3D 4.0 XSD: fails on the ForcePhysicsModel, and the 4.1 XSD fails the same way (C, xmllint on the files published at web3d.org on 2026-11-07 and on the fork's copies). Both schemas declare ParticleSystem `physics` as a repeating `xs:sequence` of BoundedPhysicsModel, ForcePhysicsModel, WindPhysicsModel and ProtoInstance with each child required, so any ParticleSystem with a physics model fails unless it carries all four in that order; the DTD and the object model (MFNode of X3DParticlePhysicsModelNode) accept it. The fork's repair hint for this error says to remove the ForcePhysicsModel, which would break a valid scene.

## Testing, and what was not measured

Tested in headless Chromium on a software Vulkan adapter (SwiftShader) for correctness only: zero WebGPU validation errors and zero WGSL compile errors, the touch cascade drives the emitter speed, light and glow, orbit works, and a malformed source is refused with the parser's message while the previous scene keeps running. Frame rates from that adapter mean nothing and are not quoted.

Nothing is timed for a benchmark. The page shows a frame interval on the viewer's own screen and records or sends nothing; gate G0 (timing consent) is still open.
