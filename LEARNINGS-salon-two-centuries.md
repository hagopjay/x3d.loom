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

---

# v2: the Western Epic wings (x3d.demo `salon-two-centuries/v2`, 25 Nov 2026)

Western.Epic.md's "Enlightenment & Romantic 1750-1900" branch added as four wings on the same axis: 190 lives (letters 60,
ideas 45, music 45, building 40) of 771 harvested, 130 works, 211 links (75 cross-field), 12 listening posts, Crystal Palace
1:18 and Eiffel Tower 1:20. Receipts: XSD 4.0 valid, 0 errors, 244 info (x3d_mcp `4d433af`); 54/54 wall paintings round-trip;
X_ITE 16.7.1 + Chromium 158 + SwiftShader, 20 frames at 2x, 0 black, ready ~36.5 s.

## 8. One QLever pass covers a cross-field harvest (C)
Four occupation families, life dates, places, P737/P1066 links and works through three authorship properties (P50 author,
P86 composer, P84 architect) came back with no 429. The chart named 33 people; 32 were found. Montesquieu was missed
because his occupation did not match the filter: check a chart's named people against the harvest by name, not only by class.
Wikidata quirks go on the wall graded: *Deutschlandlied* is dated 1841 (the lyric) under Haydn; the Statue of Liberty is
credited to Viollet-le-Duc (L).

## 9. Lawful sound from public-domain scores (C for the build, L for the terms)
Notes from the music21 corpus, played by an additive synth with a short noise-IR reverb and encoded with ffmpeg (mp3 80 kb/s),
give 12 excerpts in 4.6 MB with no recording rights involved. The compositions are public domain; the encodings keep their own
terms, and the corpus licence warns that some may not be used commercially. Credit each file's encoder where the file names one.
Trap: iterating `.flatten().notes` and `.recurse()` mixes in Key objects; test `isinstance(n, (note.Note, chord.Chord))`.

## 10. Walk in to listen: Sound + ProximitySensor, no script (C)
`ProximitySensor.enterTime -> AudioClip.startTime` and `exitTime -> stopTime` make each listening post play only while you stand
in it. Start the page muted (`browser.setBrowserOption('Mute', true)` inside try) and give a Sound button.

## 11. Long time-rooms need distance LODs (C, relative)
200 m of plaques and rails all at once ran SwiftShader at 0.34 fps. Bins of 20 m along z, each an LOD (range 34 m, empty
level a WorldInfo), plus each wing's rails merged into one IndexedFaceSet, gave 0.56 fps. Software GL, so a ratio, not a claim.

## 12. Screenshot and text traps (C)
Element screenshots of a canvas partly below the fold came back as 235 px strips or timed out; scroll it into view and clip a
page screenshot to its box. Plaques rotated 180° to "face the visitor" rendered mirrored; check text from the visitor's side
in frames, never in the code.

## 13. Share assets across versions (C)
v2 loads v1's 57 paintings and 3 depth maps by relative url (`../../v1/...`), so 17 MB is stored once and v1 stays untouched.
