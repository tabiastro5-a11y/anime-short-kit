"""Measure our stills against reference frames, item by item (the look-match loop: adjust ONE item, re-measure).

usage (repo root):
  python scripts/look_check.py --ours out/otori/b_10.jpg out/otori/b_190.jpg ... \
      --ref-video <参考の動画>.mp4 --ref-range 0-28 [--ref-frames dir/*.jpg] [--every 0.5]
      [--label store] [--out out/otori/look_store.md]

Metrics follow cartoon-3d-short/references/reports/grade.md and textures.md (540x960 grid, caption band masked):
  Y' percentiles (Rec.709 luma on sRGB values), non-ink Y' p5/p50, HSV S mean (V > .15), colourfulness
  (Hasler-Suesstrunk), local contrast std(Y' - 9x9 mean), lit chroma C* p50/p90 (L* 40-85, non-ink), ink share,
  FLAT share = non-ink pixels with almost no local texture (std < 0.012 in 7x7) -> high = flat boxes, "cheap".
Each row: reference median and p10-p90 over its frames, ours median, and OK / UP / DOWN (ours outside the ref p10-p90).
"""
import argparse
import glob
import os
import subprocess
import sys

import numpy as np
from PIL import Image

W, H = 540, 960
CAP = (int(0.64 * H), int(0.77 * H))   # caption band (ours ~0.70, reference 0.68-0.73), removed from every statistic


def load(path):
    return np.asarray(Image.open(path).convert("RGB").resize((W, H), Image.BILINEAR), dtype=np.float32) / 255.0


def video_frames(path, a, b, every):
    out = []
    t = a
    while t < b:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1",
                              "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                             capture_output=True).stdout
        if len(raw) == W * H * 3:
            out.append(np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(np.float32) / 255.0)
        t += every
    return out


def box(x, k):
    """k x k box mean (edge-padded) via an integral image"""
    p = k // 2
    xp = np.pad(x, p, mode="edge")
    c = xp.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def lab(rgb):
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return 116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])


def metrics(img):
    keep = np.ones((H, W), bool)
    keep[CAP[0]:CAP[1]] = False
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # ink: black top-hat (7x7 closing approximated by a max filter of a min filter) and dark
    from scipy.ndimage import grey_closing, maximum_filter
    ink = (grey_closing(Y, size=(7, 7)) - Y > 0.12) & (Y < 0.30)
    ink = maximum_filter(ink.astype(np.uint8), size=3).astype(bool)
    ni = keep & ~ink
    mx, mn = img.max(-1), img.min(-1)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    rg, yb = r - g, 0.5 * (r + g) - b
    colorful = np.sqrt(rg[keep].std() ** 2 + yb[keep].std() ** 2) + 0.3 * np.sqrt(rg[keep].mean() ** 2 + yb[keep].mean() ** 2)
    L, A, B = lab(img)
    C = np.hypot(A, B)
    lit = ni & (L > 40) & (L < 85)
    loc = Y - box(Y, 9)
    sd = np.sqrt(np.maximum(box(Y * Y, 7) - box(Y, 7) ** 2, 0))
    q = lambda x, p: float(np.percentile(x, p)) if x.size else float("nan")
    return {
        "Y p5": q(Y[keep], 5), "Y p50": q(Y[keep], 50), "Y p95": q(Y[keep], 95), "Y std": float(Y[keep].std()),
        "non-ink Y p5": q(Y[ni], 5), "non-ink Y p50": q(Y[ni], 50),
        "HSV S mean": float(S[keep & (mx > 0.15)].mean()), "colourfulness x100": float(colorful * 100),
        "local contrast": float(loc[keep].std()), "lit C* p50": q(C[lit], 50), "lit C* p90": q(C[lit], 90),
        "ink share %": float(ink[keep].mean() * 100), "FLAT share %": float((sd[ni] < 0.012).mean() * 100),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ours", nargs="+", required=True)
    ap.add_argument("--ref-video", nargs="*", default=[])
    ap.add_argument("--ref-range", default="0-9999")
    ap.add_argument("--ref-frames", nargs="*", default=[])
    ap.add_argument("--every", type=float, default=0.5)
    ap.add_argument("--label", default="")
    ap.add_argument("--out", default="")
    a = ap.parse_args()
    t0, t1 = map(float, a.ref_range.split("-"))
    refs = [load(p) for pat in a.ref_frames for p in glob.glob(pat)]
    for v in a.ref_video:
        refs += video_frames(v, t0, t1, a.every)
    ours = [load(p) for pat in a.ours for p in glob.glob(pat)]
    if not refs or not ours:
        sys.exit("no frames")
    R = [metrics(x) for x in refs]
    O = [metrics(x) for x in ours]
    lines = [f"# look check {a.label}: {len(O)} of ours vs {len(R)} reference frames", "",
             "| item | reference median [p10-p90] | ours median | verdict |", "|---|---|---|---|"]
    for k in R[0]:
        rv = np.array([m[k] for m in R]); ov = np.array([m[k] for m in O])
        lo, md, hi = np.nanpercentile(rv, [10, 50, 90]); om = float(np.nanmedian(ov))
        verdict = "OK" if lo <= om <= hi else ("UP" if om < lo else "DOWN")
        lines.append(f"| {k} | {md:.3f} [{lo:.3f}-{hi:.3f}] | {om:.3f} | {verdict} |")
    txt = "\n".join(lines)
    print(txt)
    if a.out:
        os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
        open(a.out, "w", encoding="utf-8").write(txt + "\n")


if __name__ == "__main__":
    main()
