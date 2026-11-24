# Learnings: Athens School refine loop and Penrose stairs via Atlas (24 Nov 2026)

Rigs: renders = Chromium SwiftShader, three r180 + Spark (Marble zip build) for splats; X_ITE 16.7.1 and three r187 bridge for X3D. Validator x3d_mcp 4d433af (XSD 4.1). Atlas calls were run by the Atlas bridge thread through its guarded client.

## Candidate failure modes (numbers to be assigned in LOOM-v1.md when merged; not added there to avoid colliding with parallel threads)
1. **Cleanup that improves the metric and worsens the picture.** Dropping 259 "floater" splats and 31,838 faint ones (statistics: cleaner) fell to 22 to 26 dB against the original and blackened the hall centre. The render gate caught it; the splat statistics did not.
2. **Splat count blows the validator's start-tag limit.** 468k splats in one GaussianSplats node is 53 MB, "not checkable at this size" (libxml2 10 MB limit); 55,000 splats per node validates.
3. **Missing support is invisible to point statistics.** Athens is a Greek cross whose four arms have vaults but no floor (90% of vault area, 174.5 of 194 m²). Found with a plan-view layer map, repaired with a fitted floor plane (17,452 splats), gated at top-40% PSNR 38.3 to 40.8 dB.
4. **Depth conditioning drops small steps.** Atlas Chisel painted 12 steps of 0.12 m rise as smooth white ramps (round 2, 160 credits); 6 steps of 0.40 m rise plus stepped balustrades and a prompt with weathered sandstone, dark joints, raking sun came back as cut stone steps in 9 of 10 frames (round 3). Grade: Confirmed on this scene, one prompt.
5. **A closure metric is necessary, not sufficient, for an illusion.** Cam00 closes the Penrose loop by construction (0 px gap between flight 4's end and flight 1's start), but flight 4 sits 9.9 m from that camera against 31.5 m for the start, so it occludes the loop and the Atlas picture does not read as an impossible staircase from Cam00. Needs a second check: loop edges visible, no occlusion of either end.
6. **Held-out views of flat faces fill with splat needles.** Cam02 and Cam03 (never generated, looking at a plain stone face) show scratchy needle splats; trained views (Cam05, 07, 10) are clean.

## Numbers
- Penrose draft splat (500 credits): 524,288 splats; 250,486 within 30 m with alpha above 0.3; their distance to the nearest X3D solid surface: median 0.275 m, p25 0.136, p75 0.463, p90 0.734; within 0.10 m 18.0%, within 0.25 m 45.8%, within 0.50 m 78.8%. For comparison Demo 77's refined splat had a median of 37.8 mm (that was a 5,000-credit refined splat, so this is not like for like).
- Penrose spend: 1,000 credits in four rounds (round 1 and 2 pictures unusable); the lesson cost 320 credits.
- Camera and depth gate before every paid call: camera 0 m / 0 deg; bridge depth vs analytic ray cast median 0.03 to 0.52 mm.
- 28,706 splats lie more than 30 m away (bbox about 360 m), a sky/fog skirt a viewer should crop.

Rights: Athens is a free-tier Marble export (World Labs owns, non-commercial licence; he confirmed 24 Nov). Penrose Atlas outputs are dev-credit outputs shown with World Labs credit and a takedown notice. Both stay private until he says publish.

## Update: the illusion camera (zero spend, same day)
A far, narrow Cam00 fixes mode 5 on paper: v4 puts Cam00 about 110 m out at 6.2 degrees, so flight 4's end is 1.096x the size of flight 1's start (v3: 3.2x), closure gap 1.0 px, and the flights are thin slabs on piers so neither end is hidden. X_ITE 16.7.1 render: it reads as one continuous ring of four flights at a glance (Suspected for "reads as impossible": one human look, not a test). Not sent to Atlas: v4 needs a fresh Chisel ring (about 140 credits) and a new draft (500). Kit: world and generator in the project's penrose-atlas/v4 folder.

Files: athens refine scripts (refine_pass.py, scaffold_check.py, p3_floor.py, render.mjs) and penrose generators are in the project files, not in this repo yet.
