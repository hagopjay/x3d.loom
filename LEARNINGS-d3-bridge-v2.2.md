# Learnings: D3 bridge v2.2 (18 Nov 2026)

1. **Count the checker's grades separately.** x3d_mcp `semantic_diagnostics` grades findings as error, warning or info. The v2.1 gate counted everything that was not an error as a warning, so 1,305 info notes looked like 1,305 warnings. Report the three grades apart (Confirmed, fa5dccf).
2. **An appearance cache leaves orphan names.** "DEF on first use, USE after" leaves a DEF on every appearance used only once. Strip unreferenced names after the scene is assembled, because only then is the full set of references known.
3. **Names reached by SAI are an interface; declare them.** `<EXPORT localDEF AS>` in the scene says that something outside the file reaches the name. The checker counts EXPORT as a reference, so those names stop showing as unused, and the scene file lists what the page depends on.
4. **WorldInfo makes a valid empty LOD level.** It is a child node, draws nothing, and does not raise `empty-group` (tested against `<Shape/>`, `<Transform/>` and `<Switch whichChoice=-1/>`, which all warn).
5. **CommonJS test scripts in a `"type": "module"` folder need `.cjs`.** v2.1's `shoot3.js` could not run from its own `tools/` folder.

The kit is at `kit/d3-x3d/hygiene.mjs`; the demo is x3d.demo `docs/demos/d3-bridge/v2.2/`.
