# Learnings: Great Pyramid Numbers (Demo 65, 19 Nov 2026)

Demo 65 is at `docs/demos/blender-giza-numbers/v1/` in x3d.demo. It turns a list of "encoded numbers" claims into one graded receipt (`claims.json`). The Blender scene and the page both read that receipt.

**Grades:**
- **C**, Confirmed: shown by a named tool in this work.
- **L**, Likely.
- **S**, Suspected.

**Tools:** validator x3d_mcp 39c6e94. Rig: headless Chromium 157.0.8103.78 with SwiftShader, X_ITE 16.7.1.

## 1. A method for "the monument encodes X" claims

1. **Compute the receipt first, then draw from it.** `verify_numbers.py` is pure Python with no dependencies. It writes each claim with:
   - the claimed value
   - the surveyed value and its 1σ
   - the relative error
   - the significant digits that agree
   - the digits the survey can support
   - σ off
   - grade, verdict and sources

   `build_numbers.py` takes the pyramid's size and the latitude point from that file, so the model cannot drift from the verdict. (C)
2. **Two digit counts, side by side.** "Agree" is how far the coincidence goes. "Supported" is floor(log10(value/σ)). When agree is larger than supported, the extra digits are luck. π agrees to 3 digits and the slope survey supports 2. (C)
3. **For a location claim, count the lines.** At 30° N, 1e-7° of latitude is 1.11 cm, so the 230.363 m base is crossed by about 20,800 latitude lines at 7-decimal precision. Any 7-decimal latitude inside the base is guaranteed to fall somewhere on the building. The claimed line sits 7.85 m north of the centre, inside the Grand Gallery but 12.5 m short of its midpoint. (C)
4. **Datums move the digits.** AERA's summit disk reads 29.978995° N on the Helmert 1906 (Egypt 1907) datum. Shifted to WGS84 with (−130, 110, −13) m it reads 29.979161° N. That changes the 4th decimal place, an 18 m move. (C) The shift's accuracy is several metres. (L)
5. **Separate design from coincidence through the builders' own unit.** A seked of 5½ palms (Rhind papyrus) gives 14 : 11 and therefore π ≈ 22/7. φ follows because 4/π and √φ differ by 0.1%. The surveyed slope (51.867° ± 0.033°) cannot tell the π slope (51.854°) from the φ slope (51.827°). (C)
6. **Unit-bound numbers are a test in themselves.** Sun radius 432,000 mi and Moon radius 1,080 mi hold to under 0.1%, but only in miles. In SI units nothing lines up. Note the unit with every "wild" number. (C)
7. **Check the picture as well as the numbers.** The supplied golden-ratio overlay most likely shows Khafre's pyramid (it keeps its upper casing), not Khufu's. (L)

## 2. Blender and X3D notes

| # | Note | Grade |
|---|---|---|
| 1 | x3d_mcp's semantic check rejects a MetadataSet `name` with a space (NMTOKEN); the XSD check passes it. Use underscores in `x3d_metadata` names. | C |
| 2 | X3D 4.0 `visible` on a Transform, set through SAI, toggles overlay groups without Switch nodes; each overlay is its own Blender object, so its own `OB_` Transform. | C |
| 3 | Setting PhysicalMaterial `transparency` through SAI gives a live X-ray of the casing in X_ITE 16.7.1. | C |
| 4 | Two runs of the same generator wrote a `create_uvsphere` mesh with different face order: same geometry, not byte-identical. Compare checksums of the receipt, not of the X3D, across rebuilds. | L |

## 3. What this does not prove

* Level (15 mm against a reported 2.1 cm) and the Greaves foot inscription rest on secondary sources. The page grades them Likely and Suspected.
* The shaft-to-star claims are graded on published angles. No sky computation was run here.
