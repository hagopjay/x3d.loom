#!/usr/bin/env python3
"""Byte-diff a P6 PPM against an 8-bit RGB PNG of the same size (standard library only).

    python3 imgdiff.py shipped/beauty.png mine.ppm
Prints: width height, number of differing bytes, maximum byte difference, mean absolute difference.
"""
import struct
import sys
import zlib


def read_png(path):
    data = open(path, "rb").read()[8:]
    pos, idat = 0, b""
    w = h = ct = None
    while pos < len(data):
        n, = struct.unpack(">I", data[pos:pos + 4])
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n]
        pos += 12 + n
        if kind == b"IHDR":
            w, h, depth, ct = struct.unpack(">IIBB", body[:10])
            assert depth == 8 and ct in (2, 6), "8-bit RGB or RGBA only"
        elif kind == b"IDAT":
            idat += body
    raw = zlib.decompress(idat)
    bpp = 3 if ct == 2 else 4
    stride = w * bpp
    out, prev, p = bytearray(), bytearray(stride), 0
    for _ in range(h):
        f = raw[p]
        line = bytearray(raw[p + 1:p + 1 + stride])
        p += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                q = a + b - c
                pa, pb, pc = abs(q - a), abs(q - b), abs(q - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out += line
        prev = line
    if bpp == 4:
        out = bytearray(v for i, v in enumerate(out) if i % 4 != 3)
    return w, h, bytes(out)


def read_ppm(path):
    d = open(path, "rb").read()
    parts = d.split(b"\n", 3)
    w, h = map(int, parts[1].split())
    return w, h, parts[3]


if __name__ == "__main__":
    wa, ha, a = read_png(sys.argv[1])
    wb, hb, b = read_ppm(sys.argv[2])
    assert (wa, ha) == (wb, hb) and len(a) == len(b), "size mismatch"
    diffs = [abs(x - y) for x, y in zip(a, b)]
    print(wa, ha, "differing bytes", sum(1 for d in diffs if d), "of", len(diffs),
          "max", max(diffs), "mean abs", sum(diffs) / len(diffs))
