# Licence review: can the bridge be published as Apache-2.0?

Phase 0, step 5. Reviewed 2026-11-05 on commit `a47dc57`; conditions resolved 2026-11-06 (see *Resolution* at the end). This is an engineering review of what each file says, **not legal advice**.
Grades: **Read** (I read the file or page), **Measured** (I ran a command and saw the result), **Stated** (the package says so; not checked).

## Verdict

**Yes, with conditions. No third-party component blocks Apache-2.0.** Every runtime dependency and every vendored asset is under a permissive licence that can be redistributed with an Apache-2.0 project, as long as its notice is kept.

Two kinds of work remain:

1. **One decision only you can make (blocker).** You must confirm that you hold the rights to the first-party material: the bridge source (`src/`, `scripts/`, `docs/BRIDGE-CONTRACT.md`, the schemas in `docs/bridge-*.json`, `public/bridge/`) and the two source archives it grew from (A `mujoco-expert-training-playground.zip`, B `mujoco-expert-training-playground (1).zip`, hashes in `PROVENANCE.json`). The package deliberately says *"no new blanket licence is assigned"* (`README.md:106`, `THIRD_PARTY_NOTICES.txt:1`, `docs/WORKBENCH-README.md:95`). It assigns no licence and claims no authorship. `BRIDGE-DELIVERY.json` points to a generated delivery (`baseLibraryFile: libfile_…`), so the code appears to come from an AI build service working from your uploads. If you made archives A and B (or had them generated for you) and that service's terms give you the output, you can license all of it under Apache-2.0. If anyone else contributed to A or B, their permission is needed first.
2. **Mechanical fixes (I can do these once you say go).** Listed under "What must change before the repository goes public".

## Inventory

### What is redistributed in `dist/` (the shipped app)

`dist/index.html` is a single-file build (Vite + `vite-plugin-singlefile`): all JS dependencies are inlined into it. `dist/vendor/x_ite/` is a copy of X_ITE's npm `dist/` plus its `LICENSES/` folder.

| Component | Version | Licence | Source of the claim | Notice in package today? |
|---|---|---|---|---|
| @mujoco/mujoco (WASM) | 3.17.0 | Apache-2.0 | package.json **Read**; full text in `THIRD_PARTY_NOTICES.txt` | yes |
| react, react-dom, scheduler | 19.2.6 / 0.27.0 | MIT | package.json **Read** | yes |
| three | 0.186.1 | MIT | package.json **Read** | yes |
| clsx | 2.1.1 | MIT | package.json **Read** | yes |
| tailwind-merge | 3.4.0 | MIT | package.json **Read** | yes |
| jszip | 3.10.1 | MIT **or** GPL-3.0-or-later (your choice) | package.json **Read** | **no** |
| pako (via jszip) | 1.0.11 | MIT **and** Zlib | package.json **Read**; inlined (16 occurrences in the bundle, **Measured**) | **no** |
| lie, immediate, setimmediate, readable-stream, string_decoder, safe-buffer, core-util-is, isarray, process-nextick-args, util-deprecate (via jszip) | various | MIT | package.json **Read** (`npm ls --omit=dev --all`) | **no** |
| inherits (via jszip) | 2.0.4 | ISC | package.json **Read** | **no** |
| Tailwind CSS output | 4.1.17 | MIT | build-time; generated CSS is inlined | no (MIT asks for the notice to travel with "substantial portions"; worth listing) |
| **X_ITE** | 16.7.0 | **MIT** (© 2009 Holger Seelig and contributors) | `node_modules/x_ite/LICENSE.md`, `package.json` `"license": "MIT"`, README "licensed under the MIT License" **Read** | yes: `dist/vendor/x_ite/LICENSE.md` |
| └ SGI Free Software License B code (GLU tessellator) | | SGI-B-2.0 (MIT-like) | appended to X_ITE's LICENSE.md **Read** | yes |
| └ Draco decoder, libktx (WASM), glTF Sample Viewer LUT PNGs | | Apache-2.0 (upstream projects) | `assets/lib/README.md` names the upstream sources **Read**; licences from my knowledge of those projects | text only (`LICENSES/Apache-2.0.txt`), no attribution per file |
| └ meshoptimizer decoder, woff2 decoder, GaussianSplats3D sort worker, mikktspace WASM | | MIT / Zlib family (upstream) | as above | text only (`LICENSES/MIT.txt`) |
| └ fonts: Droid (Apache-2.0), PT Sans (OFL-1.1), Ubuntu (Ubuntu Font Licence 1.0) | | per-font licence files ship next to the fonts | **Read** (`assets/fonts/*/…LICENCE/OFL/Apache…txt`) | yes |

`@types/three` pulls in `@dimforge/rapier3d-compat`, `@tweenjs/tween.js`, `fflate`, `meshoptimizer`, `@types/*` through `npm ls`, but those are type-only or unused paths and are not reached by the bundle. They are Apache-2.0 or MIT in any case.

**About the `CC-BY-NC-4.0.txt` inside `vendor/x_ite/LICENSES/` (Read + upstream check).** X_ITE's npm package ships its whole repository `LICENSES/` folder (Apache-2.0, CC-BY-4.0, **CC-BY-NC-4.0**, CC0-1.0, MIT). A non-commercial licence would conflict with Apache-2.0 if it covered anything we ship. I checked X_ITE's upstream repository with `gh` code search. Only two files reference non-commercial terms, and both are website assets: `docs/assets/laboratory/gltf-sample-viewer/images/helipad.avif.license` and `footprint-court.avif.license` (environment images, `CC-BY-NC-SA-3.0`, "HDRLabs sampled by UX3D"). Neither is in the npm `dist/`. **Nothing the bridge ships is under CC-BY-NC.** The licence text in the folder is boilerplate that can be kept or dropped. I recommend keeping X_ITE's folder unchanged and adding a line to NOTICE that explains it, so reviewers don't stop on it.

### What is in the repository but not in the app

| Material | Licence | Source | Action |
|---|---|---|---|
| `docs/schemas/x3d-4.0*.xsd`, `docs/X3DUOM-4.0.xml` (Web3D Consortium) | **BSD-3-Clause style** ("Web3D Consortium Open-Source License for Models and Software") | the XSD header links `web3d.org/specifications/license.txt`; I read that page (**Read**). X3DUOM has no header of its own, but it is published under the same licence on web3d.org (**Stated**, not checked per file) | keep; add to NOTICE with the licence text |
| `docs/schemas/xmldsig-core-schema.xsd` (W3C/IETF) | W3C Software License (permissive) | header **Read** | keep, header intact; list in NOTICE |
| `salvage/models/*.xml` (5 MJCF starters) | first-party (archive A), no licence assigned | `salvage/INVENTORY.md`, `model-provenance.json` **Read** | covered by your rights decision |
| `salvage/historical-curriculum.json`, `historical-quiz.json`, `historical-formula-smoke-results.json` | first-party (archive A), no licence assigned | marked `review_status: historical_unreviewed`, `publication_status: reference_only_not_authoritative` **Read** | see recommendation 4 |
| `RECOVERY_REPORT.html`, `validation/historical/*` | first-party reports | **Read** | covered by your rights decision |
| `src/data/lessons.ts` and the other workbench content | first-party | the only third-party reference is a link to MuJoCo Menagerie (`lessons.ts:280`), with no copied text **Measured** (`grep` for copyright, licence, "adapted from" and "based on" in `src/`, `scripts/` and `public/` finds nothing else) | covered by your rights decision |
| devDependencies (Vite, TypeScript, Tailwind, esbuild, jsdom, Playwright…) | MIT / Apache-2.0 / BSD | not redistributed | none |

### MuJoCo specifically

MuJoCo is Apache-2.0 (Google DeepMind), so licensing the bridge as Apache-2.0 keeps parity with it. Apache-2.0 §4 asks redistributors to include the licence and any `NOTICE` file. The npm package ships no NOTICE (**Read**: no NOTICE in `node_modules/@mujoco/mujoco`), so including its licence text, as `THIRD_PARTY_NOTICES.txt` already does, is enough.

## What must change before the repository goes public

1. **Your rights decision** (blocker, above). Once you confirm, I add `LICENSE` (Apache-2.0 text), set `"license": "Apache-2.0"` in `package.json`, and replace the three "no new blanket licence is assigned" sentences with a statement that the first-party work is Apache-2.0.
2. **Add a `NOTICE` file** naming the project copyright holder and listing the third-party material kept in the repository: Web3D schemas and X3DUOM (BSD-3-Clause), the W3C xmldsig schema, and X_ITE (MIT, with a note on its `LICENSES/` folder).
3. **Complete `THIRD_PARTY_NOTICES.txt`** for the JSZip tree (jszip with the MIT option elected, pako MIT and Zlib, lie, immediate, setimmediate, readable-stream and its small dependencies, inherits ISC) and for Tailwind's generated CSS. Better: generate the file at build time from `npm ls --omit=dev` (for example a small script in `scripts/`), so it can't drift again. Add a CI check that fails on any production dependency whose licence is outside an allow-list (MIT, ISC, BSD-2/3, Apache-2.0, Zlib, 0BSD, OFL-1.1 fonts).
4. **Salvaged teaching content.** The historical curriculum and quiz are verbatim, known-wrong text (`INVENTORY.md`: "a claim of 50 Hz control with 4 ms actions", seeded progress, incomplete Gymnasium code), marked "reference only, not authoritative". Licensing them under Apache-2.0 is fine if they are yours. Publishing known-wrong lessons under the project's name is a reputational question, not a licence one. Recommendation: keep them in the public repository only under `salvage/` with the existing status fields, and don't ship them in the app until the educators slice reviews them.
5. **Optional per-file attribution for X_ITE's bundled sub-libraries** (Draco, KTX, LUTs, meshoptimizer, woff2, GaussianSplats3D, mikktspace). Upstream X_ITE ships only the licence texts. Listing them in our NOTICE is a courtesy that makes a later hosted deployment easier to audit. It is not required by MIT. For the Apache-2.0 pieces, carry over any upstream NOTICE they have.
6. **Trademarks.** "MuJoCo" (Google DeepMind) and "X3D" (Web3D Consortium) appear in the project name. Using them to describe what the bridge connects is normal nominative use. Avoid logos, and avoid any wording that suggests endorsement until one is given (section 6 of PLAN.md already says nothing goes to Web3D or DeepMind without your go).

Nothing has been published, pushed or sent. Creating the public repository waits for your answer to item 1.

## Resolution (2026-11-06)

- **Item 1, rights:** the user confirmed they hold the rights to the first-party material (archives A and B and the generated bridge code) and chose Apache-2.0.
- Added `LICENSE` (the Apache-2.0 text) and `NOTICE` (project copyright, Hagop Jay Tumayan; every piece of third-party material kept in the repository; the X_ITE `LICENSES/` note; the trademark wording). `package.json` now declares `"license": "Apache-2.0"` and stays `"private": true`, so it can't be published to npm by accident. The "no new blanket licence is assigned" sentences in `README.md` and `docs/WORKBENCH-README.md` now state the licence. The two `RECOVERY_REPORT.html` files are historical reports and were left as written.
- **Items 2–3:** `THIRD_PARTY_NOTICES.txt` is now generated by `scripts/third-party-notices.mjs` from the 21 packages actually inlined into the build, including the JSZip tree with the MIT option elected. `npm test` runs `verify:notices`, which fails if the file is stale or any bundled licence falls outside the allow-list (MIT, ISC, Apache-2.0, BSD-2/3, Zlib, 0BSD). The build copies `LICENSE`, `NOTICE` and the notices into `dist/legal/`.
- **Item 4, salvaged teaching content:** kept under `salvage/` with its "reference only, not authoritative" status; not shipped in the app.
- **Items 5–6:** done in `NOTICE` (per-asset attribution for X_ITE's sub-libraries; trademark wording).

**The repository can now be made public under Apache-2.0.** Creating it and pushing still wait for your explicit go.
