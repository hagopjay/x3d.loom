# Edition 2.0 gaps log

Logged for future receipts collection. Each item says what is missing and how it would be measured.

| # | Gap | Why it matters | How to close it |
|---|---|---|---|
| G1 | Never played on a real GPU or by a human; every browser number is SwiftShader. | Bloom cost, touch feel and colour on a real display are unmeasured. | Play on his Windows PC (UHD 620) and one discrete GPU; record fps with bloom on/off via the diagnostics panel. |
| G2 | Bloom is a 2D-canvas copy of the WebGL frame, not an in-pipeline pass. | Small 2D canvases may be CPU-backed, so the copy can read pixels back every frame. | Measure with Chrome's performance panel; if costly, move bloom into X_ITE via a custom render pass or wait for an upstream bloom option. |
| G3 | Bloom has no luminance threshold; `contrast()` in CSS stands in for one. | Mid-tones glow a little along with highlights. | A threshold needs a shader; same path as G2. |
| G4 | `ParticleSystems` is not in the vendored X_ITE 16.8.0 bundle (it loads `assets/components/ParticleSystemsComponent.min.js`, which is not vendored). | Native X3D particles would export with the scene; the transform pool does not animate in a static snapshot. | Vendor that component with an ORIGIN hash and extend the standalone URL adapter. |
| G5 | Sparks and lights are driven from JavaScript; an exported `.x3d` holds them at their current pose. | A snapshot of a struck moment is a still, not a playable harp. | Author `TimeSensor` + interpolator ROUTEs per chamber if a self-playing X3D export is wanted (43 × 2 nodes). |
| G6 | Strikes are silent while the transport is held (paused). | Some players will expect a paused harp to still ring. | Make the strike gate depend on mute only; needs an audio-witness update. |
| G7 | The pentatonic tuning and the bell partials are authored choices. | They are not properties of the geometry. | Stated in the field guide; alternative tunings could be a studio option. |
| G8 | Touch targets for the smallest chambers (area 0.0027 R², Chambers 32 and 34) are about 6 px wide on a phone. | Hard to hit with a finger. | A nearest-chamber fallback within a few pixels, or zoom. |
| G9 | No hover light on touch screens (no hover). | Hover only helps mouse users. | None needed; strike feedback covers touch. |
