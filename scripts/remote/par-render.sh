#!/bin/bash
# Runs ON the rented GPU machine: renders a composition as P separate processes side by side (each its own browser, so each
# its own GPU process). Measured on an RTX 4090 / EPYC 7742 box (2026-11-24): one browser with 4 or 12 tabs = 4-5 frames/s
# (all tabs share ONE GPU process); 8 separate browsers = 1929 frames in 76 s.
#   bash scripts/remote/par-render.sh <Comp> <out.mp4> [audio.wav] [P=8] [only=i,j,...]
# The parts are KEPT in <out>_parts/ (p<i>.mp4 + ranges.txt "i a b") so a fix can re-render only the parts it touches
# (remote.sh redo); `only` renders just those part numbers (ranges.txt must already exist). Joining: join-parts.sh.
set -e
cd "$(dirname "$0")/../.."
comp=$1; out=$2; audio=${3:-}; P=${4:-8}; only=${5:-}
set -a; [ -f scripts/remote/gpu.env ] && . scripts/remote/gpu.env; set +a
export HEAVY_LOCK=off
parts="${out%.mp4}_parts"; mkdir -p "$parts"
if [ -z "$only" ]; then
  total=$(node scripts/remote/frames.mjs "$comp" | tail -1)
  : > "$parts/ranges.txt"
  for i in $(seq 0 $((P - 1))); do echo "$i $((i * total / P)) $(((i + 1) * total / P - 1))" >> "$parts/ranges.txt"; done
  todo=$(seq 0 $((P - 1)))
else
  todo=$(echo "$only" | tr ',' ' ')
fi
t0=$(date +%s)
for i in $todo; do
  read -r _ a b < <(awk -v i="$i" '$1 == i' "$parts/ranges.txt")
  rm -rf "$parts/p$i.mp4" "$parts/p${i}_chunks"   # render-short resumes from its _chunks: a redo must not reuse them
  node scripts/render-short.mjs "$comp" "$parts/p$i.mp4" --frames $a-$b --chunk 100000 --concurrency 1 > "$parts/p$i.log" 2>&1 &
done
fail=0; for j in $(jobs -p); do wait "$j" || fail=1; done
if [ $fail = 1 ]; then tail -20 "$parts"/p*.log | head -80; exit 1; fi
# a partial redo only renders the named parts (the others may live only on the PC): joining happens there
[ -z "$only" ] && bash scripts/remote/join-parts.sh "$parts" "$out" "$audio"
echo "par-render: parts [$(echo $todo | tr '\n' ' ')] in $(( $(date +%s) - t0 )) s -> $out"
