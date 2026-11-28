#!/usr/bin/env python3
"""Reduce the engines' recorded poses to the numbers the requirements are judged on. Standard library only."""
from __future__ import annotations
import json, math
from pathlib import Path
import sys; sys.path.insert(0, str(Path(__file__).resolve().parent))
import fourbar as fb

HERE = Path(__file__).resolve().parent


def rot(axis_angle, v):
    x, y, z, ang = axis_angle
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    c, s = math.cos(ang), math.sin(ang)
    d = x * v[0] + y * v[1] + z * v[2]
    cr = (y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0])
    return tuple(v[i] * c + cr[i] * s + (x, y, z)[i] * d * (1 - c) for i in range(3))


def measure_run(run, links, card_links, branch=+1):
    """links: the lengths the SCENE was built with (to find the pins on each body).
    card_links: the lengths the CARD promises (the closed form the rocker is judged against)."""
    a, b, c, d = links
    tr = run["tr"]
    n = len(tr["Crank"]["t"])
    unwrapped, last, max_err, max_gap, max_tilt, err_at, max_oop = 0.0, None, 0.0, 0.0, 0.0, None, 0.0
    not_assembling = 0
    for i in range(n):
        pose = {k: (tr[k]["p"][i], tr[k]["q"][i]) for k in ("Crank", "Coupler", "Rocker")}
        dirs = {k: rot(q, (1, 0, 0)) for k, (p, q) in pose.items()}
        th2 = math.atan2(dirs["Crank"][1], dirs["Crank"][0])
        th4 = math.atan2(dirs["Rocker"][1], dirs["Rocker"][0])
        if last is not None:
            unwrapped += fb.wrap(th2 - last)
        last = th2
        k = fb.closed_form(th2, *card_links, branch=branch)
        if k is None:
            not_assembling += 1
        else:
            e = abs(fb.wrap(th4 - k["th4"]))
            if e > max_err:
                max_err, err_at = e, i
        max_tilt = max(max_tilt, *(abs(math.asin(max(-1, min(1, v[2])))) for v in dirs.values()))
        # out-of-plane travel of each bar end from its own z layer (the layers are fb.DZ apart)
        for name, L, layer in (("Crank", a, 0.0), ("Coupler", b, fb.DZ), ("Rocker", c, 2 * fb.DZ)):
            for sgn in (-1, 1):
                max_oop = max(max_oop, abs(pose[name][0][2] + sgn * (L / 2) * dirs[name][2] - layer))
        # pins, from each body's own pose: an end of a bar is centre +- (length / 2) along its local x
        end = lambda name, L, sgn: tuple(pose[name][0][j] + sgn * (L / 2) * dirs[name][j] for j in range(2))
        gaps = (math.dist(end("Crank", a, -1), (0, 0)), math.dist(end("Crank", a, +1), end("Coupler", b, -1)),
                math.dist(end("Coupler", b, +1), end("Rocker", c, +1)), math.dist(end("Rocker", c, -1), (d, 0)))
        max_gap = max(max_gap, *gaps)
    return {"samples": n, "crank_revolutions": abs(unwrapped) / (2 * math.pi), "max_rocker_error_rad": max_err,
            "max_rocker_error_deg": math.degrees(max_err), "error_at_t": None if err_at is None else tr["Crank"]["t"][err_at],
            "max_pin_gap_mm": max_gap * 1000, "max_tilt_rad": max_tilt, "max_out_of_plane_mm": max_oop * 1000, "samples_card_cannot_assemble": not_assembling}


if __name__ == "__main__":
    import sys
    name = sys.argv[1] if len(sys.argv) > 1 else "exploration-trajectories.json"
    data = json.loads((HERE / "results" / name).read_text())
    cases = {c["id"]: c for c in json.loads((HERE / "bank" / "cases.json").read_text())}
    card = [fb.P[k] for k in "abcd"]
    print(f"{'case':26} {'engine':8} {'revs':>6} {'rocker err deg':>15} {'pin gap mm':>11} {'tilt rad':>10} {'out-of-plane mm':>16}")
    for r in data["runs"]:
        m = measure_run(r, cases[r["case"]]["links"], card)
        print(f"{r['case']:26} {r['engine']:8} {m['crank_revolutions']:6.2f} {m['max_rocker_error_deg']:15.4f} {m['max_pin_gap_mm']:11.4f} {m['max_tilt_rad']:10.2e} {m['max_out_of_plane_mm']:16.3f}  cannot-assemble {m['samples_card_cannot_assemble']}")
