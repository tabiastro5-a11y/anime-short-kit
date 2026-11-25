"""Cut ChatGPT character sheets (character-prompts.md) into the parts the sprite characters use.

  python scripts/slice_character.py <name> --faces f.png --mouths m.png --torso t.png [--torso2 t2.png --suffix2 suit]
                                    [--back b.png] [--sidefaces sf.png --sidemouths sm.png] [--out public/<回>/people]

faces  : 4x3 grid of mouthless heads  -> <name>_head_<expr>.png   (all the same size, aligned on the head silhouette)
mouths : 4x3 grid of mouths           -> <name>_mouth_<shape>.png (tight crops)
torso  : front, side, back[, back of head] left to right -> <name>_body_front/side/back.png, <name>_head_back.png
back   : a single extra torso (back view) -> <name>_body_back.png
torso2 : a second outfit; if it has two rows, the lower row is hats (front, side, back) -> <name>_hat_front/side/back.png
Writes <name>.json with the measured numbers (head size, face centre, mouth scale).
"""
import argparse, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

EXPRS = ["neutral", "blink", "smile", "laugh", "shock", "angry", "smirk", "nervous", "scared", "determined", "sad", "dazed"]
EXPRS_A = ["cry", "bawl", "tearup", "despair", "panic", "caught", "frozen", "rage", "annoyed", "fedup", "ouch", "ko"]
EXPRS_B = ["greedy", "gloat", "dreamy", "moved", "relieved", "awkward", "sideeye", "think", "idea", "innocent", "bored", "puzzled"]
MOUTHS2 = ["wail", "quiver", "bite", "jawdrop", "grin", "drool", "tongue", "pout", "grit", "twitch", "sigh", "firm"]
MOUTHS = ["closed", "smile", "laugh", "frown", "talk_s", "talk_m", "shout", "o", "teeth", "smirk", "wavy", "small"]


def load(p):
    """ChatGPT's "transparent" PNGs keep blocky dark pixels at alpha 1-7 around the subject. They are invisible in most
    viewers, but a GPU-drawn canvas (rented Linux GPU, angle-egl) showed them as black boxes (2026-11-24): wipe them."""
    a = np.asarray(Image.open(p).convert("RGBA")).copy()
    a[a[:, :, 3] <= 24] = 0
    return Image.fromarray(a)


def blobs(im, min_area=400, join=6, thr=40):
    """connected shapes of the alpha channel (close small gaps first), as (x0, y0, x1, y1, area), biggest first"""
    a = np.asarray(im)[:, :, 3] > thr
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=join) if join else a)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = (lab[sl] == i) & a[sl]
        if m.sum() < min_area: continue
        ys, xs = np.nonzero(m)
        out.append((sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1, int(m.sum())))
    return sorted(out, key=lambda b: -b[4])


def grid_cells(im, cols=4, rows=3):
    """each grid cell's shapes: the biggest shape whose centre falls in the cell, plus the union of all of them"""
    W, H = im.size
    cells = [[None, None] for _ in range(cols * rows)]
    for b in blobs(im, 60, 4):
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        k = min(rows - 1, int(cy / H * rows)) * cols + min(cols - 1, int(cx / W * cols))
        main, uni = cells[k]
        if main is None: cells[k] = [b, list(b[:4])]
        else: cells[k][1] = [min(uni[0], b[0]), min(uni[1], b[1]), max(uni[2], b[2]), max(uni[3], b[3])]
    return cells


def head_cells(im, cols=4, rows=3):
    """face sheets: the heads are not always on an even grid, so take the cols*rows biggest shapes as the heads, order them
    by row then column, and give every small shape (sweat, sparks, tears) to the nearest head"""
    bs = blobs(im, 60, 0); heads = sorted(bs[:cols * rows], key=lambda b: (b[1] + b[3]) / 2)
    assert len(heads) == cols * rows, f"found {len(heads)} heads, wanted {cols * rows}"
    ordered = []
    for r in range(rows): ordered += sorted(heads[r * cols:(r + 1) * cols], key=lambda b: b[0])
    cells = [[b, list(b[:4])] for b in ordered]
    for b in bs[cols * rows:]:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        k = min(range(len(cells)), key=lambda i: (cx - (cells[i][0][0] + cells[i][0][2]) / 2) ** 2 + (cy - (cells[i][0][1] + cells[i][0][3]) / 2) ** 2)
        u = cells[k][1]; cells[k][1] = [min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3])]
    return cells


def crop(im, box, pad=2):
    x0, y0, x1, y1 = box
    out = Image.new("RGBA", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), (0, 0, 0, 0))
    out.paste(im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))), (pad - (x0 - max(0, x0 - pad)), pad - (y0 - max(0, y0 - pad))))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name"); ap.add_argument("--faces"); ap.add_argument("--mouths"); ap.add_argument("--torso"); ap.add_argument("--back")
    ap.add_argument("--facesA"); ap.add_argument("--facesB"); ap.add_argument("--mouths2"); ap.add_argument("--sidefaces"); ap.add_argument("--sidemouths"); ap.add_argument("--torso2"); ap.add_argument("--suffix2", default="b"); ap.add_argument("--out", default="public/<回>/people")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    info = {}
    P = lambda part: os.path.join(a.out, f"{a.name}_{part}.png")

    if a.mouths:
        im = load(a.mouths); cells = grid_cells(im)
        assert all(c[0] for c in cells), "a mouth cell is empty"
        for (main, uni), m in zip(cells, MOUTHS): crop(im, uni).save(P(f"mouth_{m}"))
        info["mouthRef"] = cells[0][1][2] - cells[0][1][0] + 4

    def face_sheet(path, names, base=None):
        """every head of a sheet on one canvas, placed by the centre-bottom of its head silhouette (the biggest shape), so
        swapping expressions never makes the head jump; marks outside the head (sparks, sweat) stay in. `base` = the
        basic sheet's [canvas w, h, left, top, head w, head h]: a later sheet is scaled so its heads are the same size."""
        im = load(path); cells = head_cells(im)
        hw = max(c[0][2] - c[0][0] for c in cells); hh = max(c[0][3] - c[0][1] for c in cells)
        k = base[4] / hw if base else 1.0
        ext = [0, 0, 0, 0]
        for main, uni in cells:
            ax, ay = (main[0] + main[2]) // 2, main[3]
            ext = [max(ext[0], ax - hw // 2 - uni[0]), max(ext[1], ay - hh - uni[1]), max(ext[2], uni[2] - (ax + (hw + 1) // 2)), max(ext[3], uni[3] - ay)]
        ext = [max(0, e) + 2 for e in ext]
        if base:   # same canvas as the basic sheet (in the scaled units), so one set of placement numbers fits every face
            need = [base[2] / k, base[3] / k, (base[0] - base[2] - base[4]) / k, (base[1] - base[3] - base[5]) / k]
            ext = [int(round(max(e, n))) for e, n in zip(ext, need)]
        Wc, Hc = hw + ext[0] + ext[2], hh + ext[1] + ext[3]
        cw, ch = im.width // 4, im.height // 3
        for j, ((main, uni), e) in enumerate(zip(cells, names)):
            ax, ay = (main[0] + main[2]) // 2, main[3]
            x0, y0 = ax - hw // 2 - ext[0], ay - hh - ext[1]
            lim = (max(0, x0, uni[0] - 2), max(0, y0, uni[1] - 2), min(im.width, x0 + Wc, uni[2] + 2), min(im.height, y0 + Hc, uni[3] + 2))
            out = Image.new("RGBA", (Wc, Hc), (0, 0, 0, 0)); out.paste(im.crop(lim), (lim[0] - x0, lim[1] - y0))
            if base:
                out = out.resize((max(1, round(Wc * k)), max(1, round(Hc * k))), Image.LANCZOS)
                # crop / pad to the basic canvas, keeping the head box where the basic sheet has it
                ox, oy = round(ext[0] * k) - base[2], round(ext[1] * k) - base[3]
                fin = Image.new("RGBA", (base[0], base[1]), (0, 0, 0, 0)); fin.paste(out, (-ox, -oy)); out = fin
            out.save(P(f"head_{e}"))
        return [Wc, Hc, ext[0], ext[1], hw, hh]

    if a.faces:
        b = face_sheet(a.faces, EXPRS); info["head"] = {"w": b[0], "h": b[1], "headBox": b[2:]}
    base = None
    if a.facesA or a.facesB:
        jp0 = os.path.join(a.out, a.name + ".json")
        h = info.get("head") or json.load(open(jp0))["head"]; base = [h["w"], h["h"], *h["headBox"]]
    if a.facesA: face_sheet(a.facesA, EXPRS_A, base)
    if a.facesB: face_sheet(a.facesB, EXPRS_B, base)
    if a.mouths2:   # second mouth sheet, scaled so its straight "firm" mouth is 1.15 x the first sheet's closed mouth
        im = load(a.mouths2); cells = grid_cells(im)
        assert all(c[0] for c in cells), "a mouth2 cell is empty"
        ref = info.get("mouthRef") or json.load(open(os.path.join(a.out, a.name + ".json")))["mouthRef"]
        firm = cells[11][0][2] - cells[11][0][0]; k = 1.15 * ref / firm
        for (main, uni), m in zip(cells, MOUTHS2):
            c = crop(im, uni); c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS).save(P(f"mouth_{m}"))
        info["mouth2Scale"] = round(k, 3)
    if a.sidefaces:   # profile heads: same alignment rule as the front heads -> <name>_side_<expr>.png
        im = load(a.sidefaces); cells = grid_cells(im)
        assert all(c[0] for c in cells), "a side-face cell is empty"
        hw = max(c[0][2] - c[0][0] for c in cells); hh = max(c[0][3] - c[0][1] for c in cells); pad = 14
        for (main, uni), e in zip(cells, EXPRS):
            ax, ay = (main[0] + main[2]) // 2, main[3]
            x0, y0 = ax - hw // 2 - pad, ay - hh - pad
            out = Image.new("RGBA", (hw + 2 * pad, hh + 2 * pad), (0, 0, 0, 0))
            lim = (max(0, x0, uni[0] - 2), max(0, y0, uni[1] - 2), min(im.width, x0 + hw + 2 * pad, uni[2] + 2), min(im.height, y0 + hh + 2 * pad, uni[3] + 2))
            out.paste(im.crop(lim), (lim[0] - x0, lim[1] - y0)); out.save(P(f"side_{e}"))
        info["side"] = {"w": hw + 2 * pad, "h": hh + 2 * pad}
    if a.sidemouths:  # 3 x 2 profile mouths, tight crops; they are placed by their right edge
        im = load(a.sidemouths); cells = grid_cells(im, 3, 2)
        assert all(c[0] for c in cells), "a side-mouth cell is empty"
        for (main, uni), m in zip(cells, ["closed", "smile", "talk", "shout", "frown", "teeth"]): crop(im, uni).save(P(f"smouth_{m}"))
        info["smouthRef"] = cells[0][1][3] - cells[0][1][1] + 4

    def torso_row(path, suffix=""):
        im = load(path); bs = blobs(im, 3000)
        top = [b for b in bs if (b[1] + b[3]) / 2 < im.height * 0.62] if len(bs) > 4 else bs
        low = [b for b in bs if b not in top]
        top.sort(key=lambda b: b[0]); low.sort(key=lambda b: b[0])
        names = ["body_front", "body_side", "body_back"]
        for b, n in zip(top[:3], names): crop(im, b[:4]).save(P(n + suffix)); info[n + suffix] = [b[2] - b[0], b[3] - b[1]]
        if len(top) > 3 and not suffix: crop(im, top[3][:4]).save(P("head_back")); info["head_back"] = [top[3][2] - top[3][0], top[3][3] - top[3][1]]
        for b, n in zip(low[:3], ["hat_front", "hat_side", "hat_back"]): crop(im, b[:4]).save(P(n)); info[n] = [b[2] - b[0], b[3] - b[1]]

    if a.torso: torso_row(a.torso)
    if a.torso2: torso_row(a.torso2, "_" + a.suffix2)
    if a.back:
        im = load(a.back); b = blobs(im, 3000)[0]; crop(im, b[:4]).save(P("body_back")); info["body_back"] = [b[2] - b[0], b[3] - b[1]]
    jp = os.path.join(a.out, a.name + ".json")
    old = json.load(open(jp)) if os.path.exists(jp) else {}
    old.update(json.loads(json.dumps(info, default=int)))
    json.dump(old, open(jp, "w"), indent=1)
    print(a.name, json.dumps(info, default=int))


if __name__ == "__main__":
    main()
