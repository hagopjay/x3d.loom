# LEARNINGS: Salon of Two Centuries (x3d.demo `salon-two-centuries/v1`, Demo 79, 25 Nov 2026)

The owner's ArtHistory.md (gcloud.map, nodes A20-A28) sliced to 1700-1899 and built as one walkable X3D 4.0 scene, 1 m = 1 year:
9 movement galleries, 57 public-domain paintings at real size, 3 walk-in paintings from depth estimation, a pigment tower,
and an Atlas sky of 405 painters' lives (longitude × latitude × year) with 182 influence and teaching arcs.
Receipts: XSD 4.0 valid, 0 errors (x3d_mcp `4d433af`); round trip 54/54 wall paintings, 3/3 walk-ins, 0 missing textures
(lxml); X_ITE 16.7.1 in Chromium 158 + SwiftShader, 14 frames, 0 black. Grades: C = confirmed here, L = likely, S = suspected.

## 1. Open-data route when Wikimedia rate-limits a cloud session (C)
| endpoint | result from this container, 25 Nov |
|---|---|
| commons.wikimedia.org API (search, imageinfo) | 429 on the first or second call, stayed closed |
| www.wikidata.org API, query.wikidata.org (WDQS) | one WDQS answer, then 429 with backoff up to 50 s |
| qlever.dev/api/wikidata (QLever mirror, Univ. Freiburg) | every query answered; an occasional 429 cleared in 5-10 s |
| upload.wikimedia.org thumbnails (standard width 1280) | works at about one image per 2 s; bursts get 429 "robot policy", cleared by 6-30 s backoff; 57/57 fetched |
Route: facts and copyright status (P6216) from QLever; images from the thumbnail server with a descriptive User-Agent and
throttling; build the thumbnail path from md5 of the file name, so no Commons API call is needed. The owner's earlier
wikkigrokker project had already used QLever, which is how this route was found.

## 2. Wikidata quantities carry a unit; `wdt:` drops it (C)
`wdt:P2048` / `wdt:P2049` returned bare numbers: Watteau 1.29 × 1.94 (metres), Degas 920 × 680 and Seurat 1850 × 1520
(millimetres) beside centimetre values. Read `p:P2048/psv:P2048` with `wikibase:quantityAmount` + `wikibase:quantityUnit`
and normalise (cm, mm, m, inch). Then cross-check the height/width ratio against the image's pixel aspect; trust the image
when they disagree by more than 25 %.

## 3. PBR metals are black without an environment (C)
Gilt frames, rocaille and mirrors in `PhysicalMaterial` (metallic 1) rendered black under point lights in X_ITE 16.7.1 on
WebGL2: a metal only reflects its surroundings, and there was no environment map. Tuned Blinn-Phong `Material`
(dark diffuse, coloured specular, high shininess) gave gold back, and is cheaper on a weak GPU. Paintings use
`UnlitMaterial`, so the photograph keeps its own colour whatever the room light does.

## 4. Layout traps found only by looking (C)
- **WALK gravity:** viewpoints placed beyond a floor (entrance, walk-in doors) fell out of the world; the first frame
  showed the scene from below. FLY as the default navigation type, and a floor under every viewpoint.
- **Interval packing hides rooms:** greedy lanes put Symbolism (1880-1910) in a second lane behind Impressionism and
  Art Nouveau, with no way in. The build now cuts passages wherever a second-lane gallery runs behind a first-lane wall.
- **Walk-ins near a span edge:** La Grande Jatte (1884) belongs to a gallery that starts in 1886, so its door fell
  outside the gallery. Walk-in doors are now clamped into the span and packed apart from their siblings.
- **Light balance:** white rooms (Neoclassical, Impressionist) blew out at mean luminance 0.70 while dark rooms read
  well; per-room light intensity and lower ambient for light materials brought them to 0.41.

## 5. Validator catches header gaps a browser forgives (C)
Interchange did not cover Extrusion, Switch, TouchSensor or PhysicalMaterial (4 errors); then PointProperties needed
Shape level 5. The x3d_mcp semantic check names the exact `<component>` line to add.

## 6. Depth estimation as a way to look, not a measurement (C for the run, S for meaning)
Depth Anything V2 Small (transformers, CPU, ~10 s per 1280 px image) gave clean relative depth for the Panini,
Géricault, Van Gogh and Seurat. Use: near stays on the picture plane, far recedes (a window, not a sculpture); textured
ElevationGrid for the relief (rotate -90° about X and negate heights); a coloured PointSet for pointillism.
Label it as an estimate on the plaque.

## 7. A chart's notes need grading before they go on a wall (L)
Of ArtHistory.md's 27 notes in the slice, 23 are Confirmed and 4 Likely (a mid-build date: Monticello 1772; a
framing: Haussmann as "urban realism"; a date mixed with an exhibition: Impression, Sunrise 1872, shown 1874; a span
given as one year: Guimard 1900). Two of the Likely notes carry a Suspected rider ("1-morning", "cast in days"), and
2 Confirmed notes fall outside the slice (Klimt's Kiss, Casa Batlló). Counted from `data/movements.json`. Grades go on the plaques and in the page table.
