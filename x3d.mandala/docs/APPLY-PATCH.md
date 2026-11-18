# Apply the Resonance Loom patch

The delivered `Sri-Yantra-Resonance-Loom.patch` targets this exact repository base:

```text
a02a1a289b222900382e5106132d79f80a35dc28
```

The proposed branch is `feat/resonance-yantra`. The patch adds `x3d.mandala/`, `LEARNINGS-sri-yantra.md` and a root README link; it does not replace another application. Generated `dist/` files are excluded from the patch. Run the build below to create the standalone HTML and initial X3D scene; the separate release ZIP already includes them.

## Review in a separate worktree

Run from an existing checkout containing the named base. First inspect `git status --short` and retain any work in progress. Give the commands an absolute path to the delivered patch; the example filename below assumes it is in your Downloads directory.

```bash
git cat-file -t a02a1a289b222900382e5106132d79f80a35dc28
git worktree add -b feat/resonance-yantra ../x3d-loom-resonance a02a1a289b222900382e5106132d79f80a35dc28
cd ../x3d-loom-resonance
git apply --stat "$HOME/Downloads/Sri-Yantra-Resonance-Loom.patch"
git apply --check "$HOME/Downloads/Sri-Yantra-Resonance-Loom.patch"
git apply "$HOME/Downloads/Sri-Yantra-Resonance-Loom.patch"
git diff --check
git status --short
```

If the base is absent, fetch the appropriate repository history before continuing. If the branch or directory already exists, choose an unused local branch/directory name. A failed `git apply --check` is a stop condition for this workflow: inspect the difference rather than forcing the patch into a newer tree.

## Run the bounded checks

```bash
cd x3d.mandala
node --test test/*.test.mjs
python3 -m unittest discover -s test -p 'test_*.py'
python3 tools/audit_independent.py --self-test
node tools/build.mjs
python3 serve.py --open
```

Node 22+ is recommended; Python 3.10+ uses no extra packages. The server opens `http://127.0.0.1:8844/`. Review the standalone HTML, native X3D export, geometry witness, sound activation, pause/resume, mute, stillness and detail changes. See [VALIDATION.md](VALIDATION.md) for what the build session actually checked and what remains host-dependent. Stop the server with Ctrl+C when finished.

Return to the repository root to inspect and commit the concrete change:

```bash
cd ..
git add README.md LEARNINGS-sri-yantra.md x3d.mandala
git diff --cached --stat
git commit -m "Add native X3D Sri Yantra Resonance Loom"
```

## Publish from an authorized checkout

No remote branch or pull request was created in the build workspace. Its GitHub connector is disabled by the administrator and `gh` has no authenticated account. The patch and [PR description](PULL-REQUEST.md) are the completed reviewable fallback; this is not a claim of successful publication.

After verifying the intended remote and authenticating on your machine, publication can use:

```bash
git remote -v
git push -u origin feat/resonance-yantra
gh pr create --base main --head feat/resonance-yantra --title "Add native X3D Sri Yantra Resonance Loom" --body-file x3d.mandala/docs/PULL-REQUEST.md
```

Replace `origin` or the PR base branch if the target repository uses different names. The PR base must contain the named patch base or a reviewed integration of its history. Publishing does not merge the change and does not issue a formal Loom acceptance receipt.
