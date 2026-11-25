"""Shrink the embedded textures of a .glb: every image larger than MAX px is resized (Lanczos) and re-encoded in its
own format; bufferViews are repacked. usage: python -I glb_shrink.py in.glb out.glb MAX"""
import io
import json
import struct
import sys

from PIL import Image

src, dst, MAX = sys.argv[1], sys.argv[2], int(sys.argv[3])
b = open(src, "rb").read()
assert b[:4] == b"glTF"
pos, chunks = 12, []
while pos < len(b):
    L, T = struct.unpack("<II", b[pos:pos + 8])
    chunks.append((T, b[pos + 8:pos + 8 + L]))
    pos += 8 + L
j = json.loads(chunks[0][1])
binc = chunks[1][1]
views = j["bufferViews"]
img_views = {im["bufferView"]: im for im in j.get("images", []) if "bufferView" in im}
data = []
for i, v in enumerate(views):
    raw = binc[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
    if i in img_views:
        im = Image.open(io.BytesIO(raw))
        fmt = (img_views[i].get("mimeType") or "image/png").split("/")[1]
        if max(im.size) > MAX:
            k = MAX / max(im.size)
            im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
            out = io.BytesIO()
            if fmt in ("jpeg", "jpg"):
                im.convert("RGB").save(out, "JPEG", quality=90)
            else:
                im.save(out, "PNG", optimize=True)
            raw = out.getvalue()
    data.append(raw)
blob = bytearray()
for v, raw in zip(views, data):
    while len(blob) % 4:
        blob.append(0)
    v["byteOffset"] = len(blob)
    v["byteLength"] = len(raw)
    blob += raw
while len(blob) % 4:
    blob.append(0)
j["buffers"][0]["byteLength"] = len(blob)
js = json.dumps(j, separators=(",", ":")).encode()
js += b" " * ((4 - len(js) % 4) % 4)
total = 12 + 8 + len(js) + 8 + len(blob)
with open(dst, "wb") as f:
    f.write(struct.pack("<III", 0x46546C67, 2, total))
    f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack("<II", len(blob), 0x004E4942)); f.write(blob)
print(dst, len(b), "->", total)
