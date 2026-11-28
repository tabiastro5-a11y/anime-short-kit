"""Japanese lip sync: the spoken words -> one mouth-shape letter per video frame (a i u e o, n = closed, - = silent),
read by faceRig.ts faceAt(..., { vis }).

  python scripts/lipsync.py --eleven <voice>.alignment.json <out.json> [--fps 30] [--offset 0]
  python scripts/lipsync.py --whisper <voice.wav> <out.json> [--fps 30] [--model large-v3-turbo]

--eleven : the per-character timing ElevenLabs returns with the voice ({"alignment": {characters, character_start_times_seconds,
           character_end_times_seconds}} or the alignment object itself). Best: the timing is of the exact text spoken.
--whisper: no timing file: faster-whisper listens to the voice and gives word timings (slower, needs faster-whisper and
           ffmpeg). Its word ends run on into pauses, so each word's morae go only on the frames where the voice is loud.
--offset : seconds to add to every time (the voice starts later in the video).

Readings come from pykakasi (kanji -> hiragana); each word's morae share its time evenly. Small kana join the mora before,
ー stretches the vowel before, ん / っ close the mouth. Writes {"fps": 30, "v": "---OoAa..."} (v[f] = the shape at frame f;
upper case = the first frame of a mora, where the mouth dips so repeated vowels still move).
Needs: pip install pykakasi (and faster-whisper for --whisper).
"""
import argparse, json, math, pathlib

ROWS = {
    "a": "あかがさざただなはばぱまやらわゃぁ",
    "i": "いきぎしじちぢにひびぴみりぃ",
    "u": "うくぐすずつづぬふぶぷむゆるゅぅゔ",
    "e": "えけげせぜてでねへべぺめれぇ",
    "o": "おこごそぞとどのほぼぽもよろをょぉ",
}
VOWEL = {c: v for v, s in ROWS.items() for c in s}
SMALL = set("ゃゅょぁぃぅぇぉ")
LIPS = set("まみむめもばびぶべぼぱぴぷぺぽ")   # m b p start with the lips shut


def hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def morae(kana):
    """hiragana -> list of (mouth letter, lips shut first), one per mora"""
    out = []
    for c in hira(kana):
        if c in SMALL and out:
            out[-1] = (VOWEL[c], out[-1][1])     # きゃ -> a, しょ -> o
        elif c == "ー" and out:
            out.append((out[-1][0], False))
        elif c in ("ん", "っ"):
            out.append(("n", False))
        elif c in VOWEL:
            out.append((VOWEL[c], c in LIPS))
        elif c.isalnum():
            out.append(("a", False))             # letters / digits pykakasi left as they are: a plain open mouth
    return out


def readings(text):
    """split text into (start, end, hiragana) by character index"""
    import pykakasi
    kks = pykakasi.kakasi()
    res, i = [], 0
    for item in kks.convert(text):
        o = item["orig"].strip()
        if not o:
            continue
        j = text.find(o, i, i + len(o) + 4)       # only near the current place (pykakasi drops line breaks / spaces)
        if j < 0:
            j = i
        res.append((j, min(len(text), j + len(o)), item["hira"]))
        i = j + len(o)
    return res


def spans_eleven(path):
    a = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    a = a.get("alignment", a) if isinstance(a, dict) else a
    chars, st, en = a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
    text = "".join(chars)
    return [(st[s], en[e - 1], h) for s, e, h in readings(text)]


def voiced_frames(audio, fps, sr=16000):
    """True for each video frame where the voice is sounding (whisper word times run on into the pauses)"""
    import numpy as np
    hop = sr / fps
    n = int(len(audio) / hop)
    rms = np.array([np.sqrt(np.mean(audio[int(i * hop):int((i + 1) * hop)] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms)
    on = db > np.percentile(db, 95) - 30
    k = 0                                       # fill gaps of 1-3 frames (stops, quiet consonants)
    while k < n:
        if not on[k]:
            j = k
            while j < n and not on[j]:
                j += 1
            if 0 < k and j < n and j - k <= 3:
                on[k:j] = True
            k = j
        else:
            k += 1
    return on.tolist()


def spans_whisper(path, model, fps):
    from faster_whisper import WhisperModel
    import subprocess, numpy as np
    # decode with ffmpeg (16 kHz mono): faster-whisper's own reader breaks with some PyAV versions
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    m = WhisperModel(model, compute_type="int8")
    segs, _ = m.transcribe(audio, language="ja", word_timestamps=True)
    out = []
    for s in segs:
        for w in s.words or []:
            for a, b, h in readings(w.word.strip()):
                n = max(1, len(w.word.strip()))
                out.append((w.start + (w.end - w.start) * a / n, w.start + (w.end - w.start) * b / n, h))
    return out, voiced_frames(audio, fps)


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--eleven"); g.add_argument("--whisper")
    ap.add_argument("out"); ap.add_argument("--fps", type=int, default=30); ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--model", default="large-v3-turbo")
    a = ap.parse_args()
    voiced = None
    if a.eleven:
        spans = spans_eleven(a.eleven)
    else:
        spans, voiced = spans_whisper(a.whisper, a.model, a.fps)
    end = max((e for _, e, _ in spans), default=0) + a.offset
    v = ["-"] * (math.ceil(end * a.fps) + 2)
    for s, e, h in spans:
        ms = morae(h)
        if not ms or e <= s:
            continue
        if voiced is not None:              # whisper: share the morae over the frames where the voice really sounds
            fr = [f for f in range(round(s * a.fps), round(e * a.fps)) if f < len(voiced) and voiced[f]]
            if not fr:
                continue
            off = round(a.offset * a.fps)
            for k, (mo, lips) in enumerate(ms):
                part = fr[len(fr) * k // len(ms):max(len(fr) * (k + 1) // len(ms), len(fr) * k // len(ms) + 1)]
                part = [f + off for f in part if f + off < len(v)]
                if not part:
                    continue
                for f in part:
                    v[f] = mo
                if mo != "n":
                    v[part[0]] = mo.upper()
                if lips and len(part) >= 3:
                    v[part[0]] = "n"
            continue
        s, e = s + a.offset, e + a.offset
        d = (e - s) / len(ms)
        for k, (mo, lips) in enumerate(ms):
            f0 = round((s + k * d) * a.fps); f1 = max(round((s + (k + 1) * d) * a.fps), f0 + 1)
            for f in range(f0, min(f1, len(v))):
                v[f] = mo
            if mo != "n" and f0 < len(v):
                v[f0] = mo.upper()                 # first frame of the mora: the rig closes the mouth a little there
            if lips and f1 - f0 >= 3 and f0 < len(v):   # m / b / p: the lips shut for the first frame of a long enough mora
                v[f0] = "n"
    s = "".join(v)
    pathlib.Path(a.out).write_text(json.dumps({"fps": a.fps, "v": s}), encoding="utf-8")
    talk = sum(c != "-" for c in s)
    print(f"{len(s)} frames, talking {talk / a.fps:.1f} s, shapes " + " ".join(f"{c}:{s.lower().count(c)}" for c in "aiueon"))


if __name__ == "__main__":
    main()
