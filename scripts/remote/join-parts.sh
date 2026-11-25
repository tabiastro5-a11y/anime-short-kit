#!/bin/bash
# Join the kept parts of a render (<out>_parts/p<i>.mp4, in ranges.txt order) into one video and put the sound on it.
# Lossless for the picture (no re-encode). Each part goes through MPEG-TS (h264_mp4toannexb) so it carries its OWN codec
# headers: joining mp4s directly applies the FIRST file's headers to all of them, and a part encoded with other settings
# (e.g. an old film cut into parts, or another machine) stops decoding there (2026-11-24: 723 of 1929 frames).
# The TS parts are joined with the concat DEMUXER (it shifts each part's timestamps after the previous one; the concat:
# protocol kept the restarting timestamps and dropped 5 frames at the joins).
# Works on this PC (Git Bash) and on the rented machine.
#   bash scripts/remote/join-parts.sh <parts_dir> <out.mp4> [audio.wav]
set -e
parts=$1; out=$2; audio=${3:-}
: > "$parts/list.txt"; n=0
while read -r i a b; do
  [ -f "$parts/p$i.mp4" ] || { echo "missing $parts/p$i.mp4 (frames $a-$b)"; exit 1; }
  ffmpeg -nostdin -v error -y -i "$parts/p$i.mp4" -map 0:v:0 -c:v copy -bsf:v h264_mp4toannexb -f mpegts "$parts/p$i.ts"
  echo "file 'p$i.ts'" >> "$parts/list.txt"; n=$((n + 1)); want=$((b + 1))
done < "$parts/ranges.txt"
if [ -n "$audio" ]; then
  ffmpeg -v error -y -f concat -safe 0 -i "$parts/list.txt" -i "$audio" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$out"
else
  ffmpeg -v error -y -f concat -safe 0 -i "$parts/list.txt" -map 0:v:0 -c:v copy -movflags +faststart "$out"
fi
rm -f "$parts"/p*.ts
got=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$out")
[ "$got" = "$want" ] || { echo "JOIN CHECK FAILED: $got frames, expected $want"; exit 1; }
echo "joined $n parts -> $out ($got frames, checked)"
