#!/usr/bin/env python3
"""paper_scenes: the three X3D 4.1 worlds of the generate-refine-verify pilot (24 Nov 2026), CC0, invented.

One scene per stratum of the pre-registered study:
  grv-cross-hall    interior: a Greek-cross hall WITH a floor under every arm (the Marble Athens world had none)
  grv-stairwell     topology trap: a room with an open stairwell in the floor, a railing, and an alcove behind
                    a partition that only 3 of the 12 sent cameras see
  grv-courtyard     object: a statue on a plinth in an arcaded courtyard, cameras close enough to fill the frame

Cameras Cam00-Cam11 are sent to Atlas. Cameras Hold00-Hold11 are HELD OUT: never sent, used only for scoring.
The `traps` list in each scene's MetadataSet is the hidden defect list the verify stage must find blind.
Lesson carried from the Penrose call (op 54a48a5f): subjects fill 50%+ of the frame, there is always a floor and
surrounding architecture, and prompts are photographic (Chisel resists non-photo styles, Demo 77).
"""
from __future__ import annotations
import math, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import scenes as S


class PScene(S.Scene):
    def hold(self, desc, pos, target):
        i = sum(1 for c in self.cams if 'DEF="Hold' in c)
        o = S.look_at_axis_angle(pos, target)
        self.cams.append(
            f'<Viewpoint DEF="Hold{i:02d}" description="held out: {desc}" position="{pos[0]:.4f} {pos[1]:.4f} {pos[2]:.4f}" '
            f'orientation="{o[0]:.6f} {o[1]:.6f} {o[2]:.6f} {o[3]:.6f}" fieldOfView="{S.VFOV:.6f}" '
            f'centerOfRotation="{self.center[0]:.3f} {self.center[1]:.3f} {self.center[2]:.3f}"/>')


def ring(s, centre, radius, heights, target_y, n, start_deg, held=False, tag=""):
    for k in range(n):
        a = math.radians(start_deg + 360 * k / n)
        p = (centre[0] + radius * math.cos(a), heights[k % len(heights)], centre[2] + radius * math.sin(a))
        t = (centre[0], target_y, centre[2])
        (s.hold if held else s.cam)(f"{tag} ring {k} at {start_deg + 360 * k / n:.0f} deg", p, t)


# ------------------------------------------------------------------------------------------- interior
def cross_hall() -> PScene:
    s = PScene("grv-cross-hall", "Greek-cross hall: X3D world for the generate-refine-verify pilot", "invented for the GRV paper; no outside source",
               "A Renaissance palace hall in the shape of a Greek cross, four equal barrel-vaulted arms meeting under a high "
               "central crossing, polished cream and grey marble floor in a geometric inlay running into every arm, warm "
               "plaster walls with tall arched niches at the end of each arm, grey stone pilasters, four square stone piers "
               "at the crossing, a low round marble dais in the centre, soft daylight, architectural interior photograph, sharp focus")
    s.center = (0.0, 1.6, 0.0)
    A, W, H, Hc, T = 9.0, 5.0, 6.0, 8.0, 0.4          # arm reach from centre, arm width, arm ceiling, crossing ceiling, wall
    hw = W / 2
    s.meta += [("plan", f"Greek cross, arms reach {A} m from centre, {W} m wide; arm ceiling {H} m, crossing {Hc} m", "invented"),
               ("traps", "T1 floor present under all four arms (Marble Athens world: 90% of vault area floorless); T2 arm-end niches 0.6 m deep; "
                         "T3 crossing ceiling 2 m higher than the arms; T4 four piers occlude the far arm corners", "design")]
    wall, stone, floor, dark = (0.86, 0.80, 0.70), (0.62, 0.62, 0.60), (0.80, 0.78, 0.72), (0.35, 0.33, 0.30)
    # floor: one slab under the whole cross, with an inlay band per arm so the depth map is not featureless
    s.box("Floor", "FloorNS", (-hw, -0.3, -A), (hw, 0, A), floor)
    s.box("Floor", "FloorE", (hw, -0.3, -hw), (A, 0, hw), floor)
    s.box("Floor", "FloorW", (-A, -0.3, -hw), (-hw, 0, hw), floor)
    for k, (lo, hi) in enumerate(((-0.6, 0.6),)):
        s.box("Inlay", "InlayNS", (lo, 0, -A + 0.5), (hi, 0.01, A - 0.5), dark)
        s.box("Inlay", "InlayEW", (-A + 0.5, 0, lo), (A - 0.5, 0.01, hi), dark)
    # arm walls: each arm has two side walls and an end wall with a niche
    for name, ax, sg in (("N", "z", -1), ("S", "z", 1), ("E", "x", 1), ("W", "x", -1)):
        end = sg * A
        for side in (-1, 1):                               # side walls run from the crossing to the arm end
            if ax == "z":
                s.box("Walls", f"Wall{name}{side}", (side * hw, 0, sg * hw), (side * (hw + T), H, end), wall)
            else:
                s.box("Walls", f"Wall{name}{side}", (sg * hw, 0, side * hw), (end, H, side * (hw + T)), wall)
        nw, nh, nd = 1.6, 3.6, 0.6                         # end wall with a niche
        if ax == "z":
            s.panel("Walls", f"End{name}", ("z", end, sg), -hw - T, hw + T, 0, H, T + nd, wall, [(-nw / 2, nw / 2, 0.6, 0.6 + nh)])
            s.box("Niches", f"NicheBack{name}", (-nw / 2, 0.6, end + sg * (T + nd)), (nw / 2, 0.6 + nh, end + sg * (T + nd + 0.1)), stone)
            s.box("Niches", f"NicheSill{name}", (-nw / 2, 0.45, end), (nw / 2, 0.6, end + sg * (T + nd)), stone)
        else:
            s.panel("Walls", f"End{name}", ("x", end, sg), -hw - T, hw + T, 0, H, T + nd, wall, [(-nw / 2, nw / 2, 0.6, 0.6 + nh)])
            s.box("Niches", f"NicheBack{name}", (end + sg * (T + nd), 0.6, -nw / 2), (end + sg * (T + nd + 0.1), 0.6 + nh, nw / 2), stone)
            s.box("Niches", f"NicheSill{name}", (end, 0.45, -nw / 2), (end + sg * (T + nd), 0.6, nw / 2), stone)
        # pilasters along each side wall, 3 per side
        for k, d in enumerate((hw + 1.6, hw + 3.6, A - 0.8)):
            for side in (-1, 1):
                if ax == "z":
                    s.box("Pilasters", f"Pil{name}{side}{k}", (side * hw - side * 0.25 - 0.3, 0, sg * d - 0.3), (side * hw, H, sg * d + 0.3), stone)
                else:
                    s.box("Pilasters", f"Pil{name}{side}{k}", (sg * d - 0.3, 0, side * hw - side * 0.25 - 0.3), (sg * d + 0.3, H, side * hw), stone)
        # arm ceiling: a stepped "barrel" of 5 slabs
        for k in range(5):
            u0, u1 = -hw + k * W / 5, -hw + (k + 1) * W / 5
            rise = H + 0.9 * math.sin(math.pi * (k + 0.5) / 5)
            if ax == "z":
                s.box("Vaults", f"Vault{name}{k}", (u0, rise, sg * hw), (u1, rise + 0.3, end), wall)
            else:
                s.box("Vaults", f"Vault{name}{k}", (sg * hw, rise, u0), (end, rise + 0.3, u1), wall)
    # the crossing: four piers at the re-entrant corners, a high ceiling, a dais
    for k, (x, z) in enumerate(((hw, hw), (-hw, hw), (hw, -hw), (-hw, -hw))):
        s.box("Piers", f"Pier{k}", (x - 0.55, 0, z - 0.55), (x + 0.55, Hc, z + 0.55), stone)
    s.box("Crossing", "CrossingCeiling", (-hw - 0.6, Hc, -hw - 0.6), (hw + 0.6, Hc + 0.4, hw + 0.6), wall)
    for k, (lo, hi) in enumerate(((H + 1.2, Hc),)):        # walls that close the crossing above the arm vaults
        s.box("Crossing", "CrossN", (-hw, lo, -hw - 0.3), (hw, hi, -hw), wall)
        s.box("Crossing", "CrossS", (-hw, lo, hw), (hw, hi, hw + 0.3), wall)
        s.box("Crossing", "CrossE", (hw, lo, -hw), (hw + 0.3, hi, hw), wall)
        s.box("Crossing", "CrossW", (-hw - 0.3, lo, -hw), (-hw, hi, hw), wall)
    s.cyl("Dais", "Dais", (0, 0, 0), 1.3, 0.25, stone)
    s.cyl("Dais", "DaisTop", (0, 0.25, 0), 0.9, 0.15, floor)
    e = 1.6
    sent = [("crossing, looking north up the arm", (0.0, e, 1.6), (0.0, 1.8, -A)),
            ("crossing, looking east", (-1.6, e, 0.0), (A, 1.8, 0.0)),
            ("crossing, looking south", (0.0, e, -1.6), (0.0, 1.8, A)),
            ("crossing, looking west", (1.6, e, 0.0), (-A, 1.8, 0.0)),
            ("north arm end, back to the crossing", (0.0, e, -A + 1.2), (0.0, 1.5, 1.0)),
            ("east arm end, back to the crossing", (A - 1.2, e, 0.0), (-1.0, 1.5, 0.0)),
            ("south arm end, back to the crossing", (0.0, e, A - 1.2), (0.0, 1.5, -1.0)),
            ("west arm end, back to the crossing", (-A + 1.2, e, 0.0), (1.0, 1.5, 0.0)),
            ("north-east re-entrant corner, diagonal", (1.9, e, -1.9), (-2.0, 1.2, 4.0)),
            ("south-west re-entrant corner, diagonal", (-1.9, e, 1.9), (2.0, 1.2, -4.0)),
            ("crossing, up to the high ceiling", (1.2, 1.3, 1.2), (-0.8, Hc, -0.8)),
            ("high over the dais, down to the floor inlay", (0.0, 4.5, 2.2), (0.0, 0.0, -2.5))]
    for d, p, t in sent:
        s.cam(d, p, t)
    held = [("mid north arm, to the niche", (0.6, 1.7, -4.5), (0.0, 2.0, -A)),
            ("mid east arm, to the niche", (4.5, 1.7, 0.6), (A, 2.0, 0.0)),
            ("mid south arm, to the niche", (-0.6, 1.7, 4.5), (0.0, 2.0, A)),
            ("mid west arm, to the niche", (-4.5, 1.7, -0.6), (-A, 2.0, 0.0)),
            ("north arm, low, along the floor", (1.4, 0.6, -6.5), (-1.0, 0.2, 2.0)),
            ("east arm, along the pilasters", (6.5, 1.9, 1.6), (0.0, 2.6, -1.8)),
            ("south arm, up the vault", (0.0, 1.4, 5.5), (0.0, H + 0.8, 1.0)),
            ("west arm, low, to the dais", (-6.0, 0.9, 1.0), (0.0, 0.4, 0.0)),
            ("north-west re-entrant corner, diagonal", (-1.9, e, -1.9), (3.0, 1.2, 3.0)),
            ("south-east re-entrant corner, diagonal", (1.9, e, 1.9), (-3.0, 1.2, -3.0)),
            ("dais close", (1.8, 1.2, -1.2), (0.0, 0.3, 0.0)),
            ("pier close, north-east", (1.0, 1.7, -0.6), (2.5, 2.4, -2.5))]
    for d, p, t in held:
        s.hold(d, p, t)
    return s


# ------------------------------------------------------------------------------------------- topology trap
def stairwell() -> PScene:
    s = PScene("grv-stairwell", "Room with a stairwell and a hidden alcove: X3D world for the generate-refine-verify pilot", "invented for the GRV paper; no outside source",
               "An old stone townhouse room with a wide open stairwell cut into the oak plank floor, a straight stone stair "
               "going down into a dim lower cellar, a black iron railing around the opening, whitewashed walls, a thick "
               "partition wall with a doorway leading to a small side alcove, a heavy wooden table and two chairs, a tall "
               "window, timber ceiling joists, natural light, architectural interior photograph, sharp focus")
    s.center = (0.0, 1.4, 0.0)
    L, W, H, T = 10.0, 8.0, 3.8, 0.35
    hx, hz = L / 2, W / 2
    wx0, wx1, wz0, wz1 = -1.0, 2.2, -1.6, 0.4          # the stairwell opening (x, z), 3.2 x 2.0 m
    depth = 2.6                                          # cellar floor below
    s.meta += [("room", f"{L} x {W} x {H} m; stairwell opening {wx1 - wx0:.1f} x {wz1 - wz0:.1f} m, cellar {depth} m down", "invented"),
               ("traps", "T1 stairwell opening is EMPTY to the cellar floor (a generator may pave it); T2 railing bars 25 mm, 0.12 m apart; "
                         "T3 alcove 2.4 x 2.0 m behind the partition seen by 3 of 12 sent cameras; T4 stair treads descend, 10 steps", "design")]
    wall, oak, stone, iron, dark = (0.90, 0.88, 0.84), (0.55, 0.40, 0.25), (0.62, 0.60, 0.56), (0.10, 0.10, 0.11), (0.30, 0.22, 0.15)
    # floor with a hole: four slabs around the opening
    s.box("Floor", "FloorW", (-hx, -0.3, -hz), (wx0, 0, hz), oak)
    s.box("Floor", "FloorE", (wx1, -0.3, -hz), (hx, 0, hz), oak)
    s.box("Floor", "FloorN", (wx0, -0.3, -hz), (wx1, 0, wz0), oak)
    s.box("Floor", "FloorS", (wx0, -0.3, wz1), (wx1, 0, hz), oak)
    for k, x in enumerate(np.arange(-hx + 0.6, hx, 0.9)):   # plank seams so the floor has depth texture
        if not (wx0 < x < wx1):
            s.box("Floor", f"Seam{k}", (x - 0.01, 0, -hz), (x + 0.01, 0.006, hz), dark)
    # the well: shaft walls, cellar floor, stair down along the north side
    s.box("Well", "WellN", (wx0, -depth, wz0 - 0.3), (wx1, -0.3, wz0), stone)
    s.box("Well", "WellS", (wx0, -depth, wz1), (wx1, -0.3, wz1 + 0.3), stone)
    s.box("Well", "WellW", (wx0 - 0.3, -depth, wz0 - 0.3), (wx0, -0.3, wz1 + 0.3), stone)
    s.box("Well", "WellE", (wx1, -depth, wz0 - 0.3), (wx1 + 0.3, -0.3, wz1 + 0.3), stone)
    s.box("Well", "CellarFloor", (wx0 - 0.3, -depth - 0.3, wz0 - 0.3), (wx1 + 0.3, -depth, wz1 + 0.3), stone)
    steps, run = 10, (wx1 - wx0 - 0.3) / 10
    for k in range(steps):
        x0 = wx0 + k * run
        top = -(k + 1) * depth / (steps + 1)
        s.box("Stair", f"Tread{k}", (x0, -depth, wz0), (x0 + run, top, wz0 + 0.95), stone)
    # railing on the south and east edges (the stair enters from the west)
    s.box("Railing", "RailTopS", (wx0, 0.98, wz1 + 0.02), (wx1, 1.02, wz1 + 0.06), iron)
    s.box("Railing", "RailTopE", (wx1 + 0.02, 0.98, wz0), (wx1 + 0.06, 1.02, wz1 + 0.06), iron)
    for k, x in enumerate(np.arange(wx0 + 0.06, wx1, 0.145)):
        s.box("Railing", f"BarS{k}", (x - 0.0125, 0, wz1 + 0.03), (x + 0.0125, 0.98, wz1 + 0.055), iron)
    for k, z in enumerate(np.arange(wz0 + 0.06, wz1, 0.145)):
        s.box("Railing", f"BarE{k}", (wx1 + 0.03, 0, z - 0.0125), (wx1 + 0.055, 0.98, z + 0.0125), iron)
    # shell: walls, ceiling, joists, a window in the south wall
    s.box("Shell", "Ceiling", (-hx - T, H, -hz - T), (hx + T, H + 0.3, hz + T), wall)
    for k, x in enumerate(np.linspace(-hx + 0.8, hx - 0.8, 7)):
        s.box("Joists", f"Joist{k}", (x - 0.1, H - 0.25, -hz), (x + 0.1, H, hz), dark)
    s.panel("Shell", "WallN", ("z", -hz, -1), -hx, hx, 0, H, T, wall)
    s.panel("Shell", "WallS", ("z", hz, 1), -hx, hx, 0, H, T, wall, [(-3.6, -2.2, 0.9, 3.0)])
    s.panel("Shell", "WallW", ("x", -hx, -1), -hz - T, hz + T, 0, H, T, wall)
    # east: a partition at x = hx - 2.4 with a doorway; the alcove beyond is enclosed by the outer east wall
    px = hx - 2.4
    s.panel("Partition", "Partition", ("x", px, 1), -hz, hz, 0, H, 0.25, wall, [(1.2, 2.2, 0, 2.2)])
    s.panel("Shell", "WallE", ("x", hx, 1), -hz - T, hz + T, 0, H, T, wall)
    s.box("Alcove", "AlcoveShelf", (hx - 0.5, 0.9, -1.0), (hx, 0.95, 1.5), oak)
    s.box("Alcove", "AlcoveChest", (px + 0.5, 0, 2.4), (px + 1.5, 0.7, 3.2), dark)
    # furniture
    s.box("Table", "TableTop", (-3.8, 0.72, 1.4), (-1.8, 0.78, 2.6), oak)
    for k, (x, z) in enumerate(((-3.7, 1.5), (-1.9, 1.5), (-3.7, 2.5), (-1.9, 2.5))):
        s.box("Table", f"TableLeg{k}", (x - 0.04, 0, z - 0.04), (x + 0.04, 0.72, z + 0.04), oak)
    for k, x in enumerate((-3.3, -2.3)):
        s.box("Chairs", f"Seat{k}", (x - 0.22, 0.44, 2.9), (x + 0.22, 0.48, 3.3), oak)
        s.box("Chairs", f"Back{k}", (x - 0.22, 0.48, 3.26), (x + 0.22, 1.0, 3.3), oak)
    e = 1.6
    sent = [("west end to the stairwell", (-4.2, e, -0.6), (0.6, -0.6, -0.6)),
            ("south-west corner, across the well to the partition", (-4.3, e, 3.4), (2.5, 0.0, -1.0)),
            ("north-west corner, along the railing", (-4.3, e, -3.4), (2.0, 0.2, 0.6)),
            ("over the well, down the stair", (-1.4, 2.4, -0.4), (1.0, -2.0, -0.8)),
            ("south of the well, down into the cellar", (0.6, 2.2, 2.1), (0.6, -2.4, -0.6)),
            ("north wall, across the well to the window", (0.4, e, -3.5), (-2.0, 1.2, hz)),
            ("east by the partition, back to the west", (px - 0.6, e, -2.6), (-hx, 1.0, 1.0)),
            ("through the doorway into the alcove", (px - 1.6, e, 1.7), (hx, 1.0, 1.8)),
            ("in the alcove, to the shelf", (px + 0.6, e, -0.6), (hx, 0.9, 0.6)),
            ("in the alcove, back through the doorway", (hx - 0.5, e, 3.3), (-2.0, 1.2, 0.8)),
            ("table and chairs, to the well", (-4.4, 1.4, 3.6), (0.4, 0.0, 0.0)),
            ("up to the joists", (-1.6, 1.4, 1.6), (1.6, H, -1.0))]
    for d, p, t in sent:
        s.cam(d, p, t)
    held = [("east side of the well, across to the west", (2.1, e, -1.0), (-3.0, 0.0, 0.0)),
            ("railing close, south-east corner", (2.8, 1.3, 1.1), (1.0, 0.5, -0.4)),
            ("low over the well rim", (-1.8, 0.7, 1.4), (1.6, -1.0, -1.0)),
            ("from the stair head, down", (-0.8, 1.7, -1.1), (2.0, -2.6, -1.1)),
            ("cellar floor seen steeply", (0.6, 3.0, 0.9), (0.6, -2.6, -0.6)),
            ("window, square on", (-2.9, 1.7, 1.0), (-2.9, 1.9, hz)),
            ("partition from the west, the doorway", (-1.5, e, 1.8), (px, 1.2, 1.7)),
            ("alcove chest close", (px + 0.4, 1.5, 0.8), (px + 1.0, 0.4, 2.8)),
            ("alcove north end", (hx - 0.6, 1.7, 2.8), (px, 1.0, -3.0)),
            ("north-east corner of the main room", (px - 0.5, e, -3.5), (-2.0, 0.5, 2.0)),
            ("table close", (-1.5, 1.5, 3.4), (-2.8, 0.7, 2.0)),
            ("ceiling over the well", (0.2, 1.2, -2.4), (0.6, H, 0.2))]
    for d, p, t in held:
        s.hold(d, p, t)
    return s


# ------------------------------------------------------------------------------------------- object
def courtyard() -> PScene:
    s = PScene("grv-courtyard", "Statue in an arcaded courtyard: X3D world for the generate-refine-verify pilot", "invented for the GRV paper; no outside source",
               "A quiet Mediterranean cloister courtyard paved with large worn limestone flags, a weathered bronze statue of a "
               "standing robed figure with outstretched arms on a tall square stone plinth in the centre, four low stone "
               "benches, a round arcade of sandstone arches and columns on all four sides, terracotta roof edge, soft overcast "
               "daylight, architectural photograph, sharp focus")
    s.center = (0.0, 1.8, 0.0)
    R, Ha, T = 7.0, 4.2, 0.5
    s.meta += [("courtyard", f"{2 * R} x {2 * R} m inside the arcade; arcade height {Ha} m", "invented"),
               ("traps", "T1 the space under each outstretched arm (0.45 to 1.3 m from the body axis, y 2.3 to 3.1 m) is empty (a generator may web it); "
                         "T2 plinth is 1.0 x 1.0 x 1.6 m, square, not round; T3 arcade openings are empty to the back wall 2.5 m behind; "
                         "T4 benches stand on legs with open space under the seat", "design")]
    stone, flag, bronze, sand, dark = (0.70, 0.66, 0.58), (0.76, 0.72, 0.64), (0.30, 0.26, 0.18), (0.80, 0.68, 0.50), (0.40, 0.36, 0.30)
    s.box("Ground", "Ground", (-R - 3.5, -0.3, -R - 3.5), (R + 3.5, 0, R + 3.5), flag)
    for k, v in enumerate(np.arange(-R + 1.2, R, 1.2)):        # flag joints both ways
        s.box("Ground", f"JointX{k}", (v - 0.015, 0, -R), (v + 0.015, 0.006, R), dark)
        s.box("Ground", f"JointZ{k}", (-R, 0, v - 0.015), (R, 0.006, v + 0.015), dark)
    # statue: plinth, robe (tapered stack), torso, head, two arms out to the sides with a gap
    s.box("Statue", "Plinth", (-0.5, 0, -0.5), (0.5, 1.6, 0.5), stone)
    s.box("Statue", "PlinthCap", (-0.6, 1.6, -0.6), (0.6, 1.72, 0.6), stone)
    s.cyl("Statue", "Robe", (0, 1.72, 0), 0.38, 1.1, bronze)
    s.cyl("Statue", "Torso", (0, 2.82, 0), 0.26, 0.6, bronze)
    s.sph("Statue", "Head", (0, 3.6, 0), 0.17, bronze)
    s.box("Statue", "ArmL", (-1.30, 3.15, -0.08), (-0.76, 3.30, 0.08), bronze)
    s.box("Statue", "ArmR", (0.76, 3.15, -0.08), (1.30, 3.30, 0.08), bronze)
    s.box("Statue", "ShoulderL", (-0.76, 3.18, -0.06), (-0.26, 3.27, 0.06), bronze)
    s.box("Statue", "ShoulderR", (0.26, 3.18, -0.06), (0.76, 3.27, 0.06), bronze)
    # benches
    for k, (x, z, rot) in enumerate(((0, 3.2, 0), (0, -3.2, 0), (3.2, 0, 1), (-3.2, 0, 1))):
        lx, lz = (1.0, 0.25) if rot == 0 else (0.25, 1.0)
        s.box("Benches", f"Seat{k}", (x - lx, 0.42, z - lz), (x + lx, 0.5, z + lz), stone)
        for m, d in enumerate((-0.8, 0.8)):
            ox, oz = (d, 0) if rot == 0 else (0, d)
            s.box("Benches", f"Leg{k}{m}", (x + ox - 0.1, 0, z + oz - lz + 0.03), (x + ox + 0.1, 0.42, z + oz + lz - 0.03), stone)
    # arcade: 5 bays per side, columns, lintel, back wall 2.5 m behind, roof edge
    bays = 5
    for side, (ax, sg) in enumerate((("z", -1), ("z", 1), ("x", -1), ("x", 1))):
        face = sg * R
        cols = np.linspace(-R, R, bays + 1)
        for k, u in enumerate(cols):
            if ax == "z":
                s.cyl("Arcade", f"Col{side}{k}", (u, 0, face), 0.22, Ha - 0.6, sand)
            else:
                s.cyl("Arcade", f"Col{side}{k}", (face, 0, u), 0.22, Ha - 0.6, sand)
        for k in range(bays):                                     # an arch read as a lintel plus a spandrel step
            u0, u1 = cols[k] + 0.22, cols[k + 1] - 0.22
            if ax == "z":
                s.box("Arcade", f"Lintel{side}{k}", (u0 - 0.22, Ha - 0.6, face - 0.25), (u1 + 0.22, Ha, face + 0.25), sand)
                s.box("Arcade", f"Spandrel{side}{k}", (u0, Ha - 1.0, face - 0.2), (u0 + 0.5, Ha - 0.6, face + 0.2), sand)
                s.box("Arcade", f"SpandrelB{side}{k}", (u1 - 0.5, Ha - 1.0, face - 0.2), (u1, Ha - 0.6, face + 0.2), sand)
            else:
                s.box("Arcade", f"Lintel{side}{k}", (face - 0.25, Ha - 0.6, u0 - 0.22), (face + 0.25, Ha, u1 + 0.22), sand)
                s.box("Arcade", f"Spandrel{side}{k}", (face - 0.2, Ha - 1.0, u0), (face + 0.2, Ha - 0.6, u0 + 0.5), sand)
                s.box("Arcade", f"SpandrelB{side}{k}", (face - 0.2, Ha - 1.0, u1 - 0.5), (face + 0.2, Ha - 0.6, u1), sand)
        back = sg * (R + 2.5)
        if ax == "z":
            s.box("Cloister", f"Back{side}", (-R - 3, 0, back), (R + 3, Ha, back + sg * T), (0.86, 0.80, 0.70))
            s.box("Cloister", f"Roof{side}", (-R - 3, Ha, face - 0.4), (R + 3, Ha + 0.25, back + sg * T), (0.62, 0.34, 0.22))
        else:
            s.box("Cloister", f"Back{side}", (back, 0, -R - 3), (back + sg * T, Ha, R + 3), (0.86, 0.80, 0.70))
            s.box("Cloister", f"Roof{side}", (face - 0.4, Ha, -R - 3), (back + sg * T, Ha + 0.25, R + 3), (0.62, 0.34, 0.22))
    ring(s, (0, 0, 0), 3.4, (1.7, 2.4, 1.3), 2.2, 8, 22.5, tag="statue")
    s.cam("statue face, close, from the north", (0.2, 3.3, -1.9), (0.0, 3.2, 0.0))
    s.cam("statue arm gap, close, from the east", (2.2, 3.0, 0.9), (0.6, 3.1, 0.0))
    s.cam("arcade south side, square on", (0.0, 1.8, 1.8), (0.0, 2.0, R + 2.5))
    s.cam("arcade west side, square on", (1.8, 1.8, 0.0), (-R - 2.5, 2.0, 0.0))
    ring(s, (0, 0, 0), 4.6, (2.0, 1.1, 2.9), 2.0, 6, 0, held=True, tag="statue")
    s.hold("statue arm gap, close, from the west", (-2.2, 3.0, -0.9), (-0.6, 3.1, 0.0))
    s.hold("plinth base close", (1.4, 0.9, 1.4), (0.0, 0.8, 0.0))
    s.hold("bench underside, low", (1.4, 0.35, 4.6), (0.0, 0.25, 3.2))
    s.hold("arcade north side, square on", (0.0, 1.8, -1.8), (0.0, 2.0, -R - 2.5))
    s.hold("arcade east side, square on", (-1.8, 1.8, 0.0), (R + 2.5, 2.0, 0.0))
    s.hold("high, down onto the statue", (2.6, 5.5, 2.6), (0.0, 1.6, 0.0))
    return s


SCENES = {"grv-cross-hall": cross_hall, "grv-stairwell": stairwell, "grv-courtyard": courtyard}

if __name__ == "__main__":
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    for slug, fn in SCENES.items():
        sc = fn()
        (out / f"{slug}.x3d").write_text(sc.xml(), encoding="utf-8")
        nc = sum('DEF="Cam' in c for c in sc.cams); nh = sum('DEF="Hold' in c for c in sc.cams)
        print(f"{slug}: {sc.n} solids, {nc} sent + {nh} held-out viewpoints")
