# LEARNINGS: Unity bridge 0.1 (x3d.lab `unity/`, PR x3d.lab #37, Demo 80 reserved, 26 Nov 2026)

Pure-C# core + Unity/XR layer + x3d_mcp-gated live server. Rig: .NET SDK 8.0.134 (LangVersion 9), x3d_mcp fork `4d433af`, node 22,
Ubuntu 24.04. 41/41 core tests, 8/8 live-server checks. No Unity Editor ran: the Unity-API layer is Suspected until compiled. Grades C / L / S.

## 1. Where Unity sits (L)
Unity is the reach lane (phone AR, Quest, visionOS); Unreal is the fidelity lane; Blender authors; browsers are the oracle lanes. Not a replacement for any of them.

## Failure modes (next free: 304)
299. **Two correct handedness conventions differ by a 180-degree turn about Y (C).** Mirroring Z (native importer; keeps "camera on +Z looking -Z" as Unity's "-Z looking +Z") versus mirroring X (glTFast's glTF convention) gives scenes that face opposite ways. Pick one per bridge, name it in the receipt, test with a viewpoint fixture.
300. **Mirroring without reversing winding turns a mesh inside out (C).** Signed volume (divergence theorem) goes from +8 to negative for a cube. Use `SignedVolume > 0` as the per-primitive test.
301. **Hand-written tessellators get winding wrong first time (C).** Sphere, Cylinder side/caps and Cone were inverted on first write; only the signed-volume test showed it (X_ITE would have shown it as culled faces). Test every primitive's volume against the closed form before drawing it.
302. **`validate_semantic` returns a Markdown report, not JSON (C).** A gate that parsed it as JSON read `errors` as empty and passed a dangling ROUTE (the scene was XSD-valid). Parse `## Errors` bullets, and keep one test that is XSD-valid and semantically broken.
303. **mcp 2.x removed `mcp.server.fastmcp`, so the x3d_mcp server module does not import (C)**; the gate imports `validation.validate` and `validation.semantic` directly (they do not need mcp).

## 2. Ear clipping beats a fan on concave faces (C)
An L-shaped IndexedFaceSet polygon: 4 triangles, area 3.0000 by ear clipping in the Newell plane; a fan from vertex 0 would cover area outside the L.

## 3. Tether pattern for devices (C)
`POST /push` runs the gate; a failing scene is never published and the previous scene stays live; clients poll `/manifest.json` with If-None-Match (304). HTTP polling on purpose: identical on iOS, Android, Quest, visionOS.

## 4. Licences (S)
Keijiro Takahashi's repos (Pcx, PcxVFX, Rsvfx, SplatVFX, Klak*) are credited as inspiration only; no code vendored because licences could not be read from this session. SplatVFX's README calls itself experimental and points to UnityGaussianSplatting (search snippet 26 Nov). Read each LICENSE at a pinned commit before vendoring.
