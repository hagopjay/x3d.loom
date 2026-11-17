# Optional renderer (fetched, not bundled)

The offline viewport uses **X_ITE 16.6.0**, by Holger Seelig and contributors. It is distributed under the MIT licence. The licence text is kept at `licenses/x_ite-LICENSE.md`. `tools/fetch_renderer.py` downloads the pinned release into `web/vendor/x_ite/` (git-ignored) after checking every file against `renderer-manifest.json`; supporting assets (fonts, textures) keep the notices they ship with, such as `assets/fonts/**/*License*.txt`. Official project: https://create3000.github.io/x_ite/

This renderer is pinned for the local illustrative preview. It does not provide a recorded Loom render witness automatically. The six teaching scenes are newly authored synthetic fixtures and contain no Script, Inline or external resource URLs.

The Python rehearsal runner uses only the standard library and the sibling `x3d_s1` source. Pytest is an optional test-time dependency for the existing integration suites, not an application dependency. No JEV SDK or credential is needed for this edition.
