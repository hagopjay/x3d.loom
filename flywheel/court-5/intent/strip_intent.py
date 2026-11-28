#!/usr/bin/env python3
"""Make the file-only copies of a court 5 set, and check the intent rules on the way.

    python3 flywheel/court-5/intent/strip_intent.py <sets dir> <out dir>

For every set-*/ folder under <sets dir> it writes the same folder under <out dir> with every
<meta name="intent..."/> line removed (helper files and MANIFEST.json are copied as they are). The kernel is only
ever run on the stripped copies, so a stated intent can never help the file-only score.

It stops with an error if a fault and its twin do not carry byte-for-byte the same intent lines: the intent is
written once, for the scene the author meant, and may not differ between the wrong file and the right one.
"""
import json, re, shutil, sys
from pathlib import Path

META = re.compile(r'^[ \t]*<meta\s+name=(["\'])intent(?::[A-Za-z]+)?\1[^>]*/>[ \t]*\r?\n', re.M)


def intent_lines(text):
    return [m.group(0).strip() for m in META.finditer(text)]


def main(src, dst):
    src, dst = Path(src), Path(dst)
    report, bad = {}, []
    for folder in sorted(p for p in src.glob("set-*") if p.is_dir()):
        out = dst / folder.name
        out.mkdir(parents=True, exist_ok=True)
        man = json.loads((folder / "MANIFEST.json").read_text())
        for f in sorted(folder.iterdir()):
            if f.suffix != ".x3d":
                if f.is_file():
                    shutil.copy2(f, out / f.name)
                continue
            text = f.read_text(encoding="utf-8")
            lines = intent_lines(text)
            (out / f.name).write_text(META.sub("", text), encoding="utf-8")
            report[f"{folder.name}/{f.name}"] = len(lines)
            twin = man.get(f.name, {}).get("twin")
            if f.name.startswith("fault") and twin:
                if lines != intent_lines((folder / twin).read_text(encoding="utf-8")):
                    bad.append(f"{folder.name}/{f.name} and {twin} carry different intent lines")
            if "intent" in (out / f.name).read_text(encoding="utf-8").split("<Scene")[0]:
                bad.append(f"{folder.name}/{f.name}: the word intent is still in the head after stripping")
    print(len(report), "scenes copied;", sum(v > 0 for v in report.values()), "carried intent lines")
    if bad:
        sys.exit("intent rules broken:\n  " + "\n  ".join(bad))


if __name__ == "__main__":
    main(*sys.argv[1:3])
