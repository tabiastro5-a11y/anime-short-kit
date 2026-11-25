#!/bin/bash
# Run the heavy GPU jobs on a rented Linux GPU machine, from THIS PC (Git Bash), repo root.
#   bash scripts/remote/remote.sh offers                     # cheapest offers meeting the conditions (free)
#   bash scripts/remote/remote.sh rent <offer_id>            # SPENDS MONEY (user's yes first): rent, wait, setup
#   bash scripts/remote/remote.sh up                         # SPENDS MONEY (user's yes first): start the stopped machine
#   bash scripts/remote/remote.sh render <Comp> <out.mp4> --audio <mix.wav>    # 8 parts side by side, parts kept locally
#   bash scripts/remote/remote.sh redo <Comp> <out.mp4> <a-b> --audio <mix.wav> # re-render only the parts touching a-b
#   bash scripts/remote/remote.sh render-local <Comp> <out.mp4> --audio <mix.wav>      # whole film on this PC, 8 parts kept
#   bash scripts/remote/remote.sh redo-local <Comp> <out.mp4> <a-b> --audio <mix.wav>  # same, on this PC (no GPU rental)
#   bash scripts/remote/remote.sh stills <Comp> <outPrefix> <frames> [scale] [PROPS-json]
#   bash scripts/remote/remote.sh down                       # STOP after each job (GPU billing off, set-up kept)
#   bash scripts/remote/remote.sh done                       # DESTROY (all billing off; next time = rent + setup)
#   bash scripts/remote/remote.sh setup | ssh | state
# Safety net: the machine stops itself after 20 idle minutes (idle-return.sh). Connection settings: .remote-render.env
# (NOT in Git; written by vast.py rent/start). Sent: code, public/ models, episode data/ and the --audio wav. Never sent:
# reference videos, assets/_downloads, API keys (~/.tts_keys.env), .git, out/.
set -e
cd "$(dirname "$0")/../.."
[ -f .remote-render.env ] && . ./.remote-render.env
: "${RR_USER:=root}" "${RR_DIR:=/root/anime}" "${RR_CONC:=4}"
SSH=(ssh -p "$RR_PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 "$RR_USER@$RR_HOST")
SCP=(scp -P "$RR_PORT" -o StrictHostKeyChecking=accept-new)
PY="python scripts/remote/vast.py"

send() {   # code + models + episode data (tar over ssh: rsync is not in Git Bash)
  local extra=("$@")
  local data=$(ls -d episodes/*/data 2>/dev/null)
  tar -cz --exclude=node_modules package.json package-lock.json tsconfig.json remotion.config.ts src scripts public $data "${extra[@]}" \
    | "${SSH[@]}" "mkdir -p '$RR_DIR' && tar -xz -C '$RR_DIR'"
}
remote_env() { echo "cd '$RR_DIR' && touch out/.last_job 2>/dev/null; set -a && [ -f scripts/remote/gpu.env ] && . scripts/remote/gpu.env; set +a; export RENDER_CONC=$RR_CONC;"; }
audio_of() { local a=""; while [ $# -gt 0 ]; do [ "$1" = "--audio" ] && a=$2; shift; done; echo "$a"; }
fetch_parts() {   # copy the remote <out>_parts (only the listed part files + ranges) to the same place here
  local out=$1; shift; local parts="${out%.mp4}_parts"; mkdir -p "$parts"
  local files="$parts/ranges.txt"; for i in "$@"; do files="$files $parts/p$i.mp4"; done
  for k in 1 2 3; do "${SSH[@]}" "cd '$RR_DIR' && tar -c $files" | tar -x && return 0; echo "retry fetch $k"; sleep 5; done; return 1
}
touched_parts() {   # part numbers whose frame range overlaps a-b (from the local ranges.txt)
  local parts=$1 a=${2%-*} b=${2#*-}
  awk -v A="$a" -v B="$b" '$3 >= A && $2 <= B {printf "%s%s", (n++ ? "," : ""), $1}' "$parts/ranges.txt"
}

cmd=$1; shift || true
case "$cmd" in
  offers) $PY offers ;;
  rent)   # SPENDS MONEY
    $PY rent "$1"; . ./.remote-render.env
    SSH=(ssh -p "$RR_PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 "$RR_USER@$RR_HOST")
    sleep 20; send; "${SSH[@]}" "cd '$RR_DIR' && bash scripts/remote/setup.sh"
    ;;
  up)     # SPENDS MONEY: start the stopped machine, re-arm the idle watcher
    $PY start; . ./.remote-render.env
    SSH=(ssh -p "$RR_PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 "$RR_USER@$RR_HOST")
    for k in 1 2 3 4 5 6; do "${SSH[@]}" true 2>/dev/null && break; sleep 10; done
    "${SSH[@]}" "cd '$RR_DIR' && (pkill -f idle-return.sh || true) && touch out/.last_job && (nohup setsid bash scripts/remote/idle-return.sh >/dev/null 2>&1 &) && nvidia-smi --query-gpu=name --format=csv,noheader"
    ;;
  setup) send; "${SSH[@]}" "cd '$RR_DIR' && bash scripts/remote/setup.sh" ;;
  render)   # <Comp> <out.mp4> --audio <wav>
    comp=$1; out=$2; shift 2; audio=$(audio_of "$@"); t0=$(date +%s)
    send ${audio:+"$audio"}
    "${SSH[@]}" "cd '$RR_DIR' && bash scripts/remote/par-render.sh $comp '$out' '$audio' ${RR_PROCS:-8}"
    mkdir -p "$(dirname "$out")"
    for k in 1 2 3; do "${SCP[@]}" "$RR_USER@$RR_HOST:$RR_DIR/$out" "$out" && break; echo "retry $k"; sleep 5; done
    fetch_parts "$out" $(seq 0 $(( ${RR_PROCS:-8} - 1 )))
    echo "fetched $out + its parts  ($(( $(date +%s) - t0 )) s including transfer)"
    ;;
  redo)     # <Comp> <out.mp4> <a-b> --audio <wav>: only the parts that touch frames a-b, on the GPU; joined here
    comp=$1; out=$2; range=$3; shift 3; audio=$(audio_of "$@"); parts="${out%.mp4}_parts"; t0=$(date +%s)
    [ -f "$parts/ranges.txt" ] || { echo "no $parts/ranges.txt: render the whole film once first"; exit 1; }
    only=$(touched_parts "$parts" "$range"); echo "frames $range -> parts $only"
    send
    "${SSH[@]}" "mkdir -p '$RR_DIR/$parts'" && "${SCP[@]}" "$parts/ranges.txt" "$RR_USER@$RR_HOST:$RR_DIR/$parts/ranges.txt"
    "${SSH[@]}" "cd '$RR_DIR' && bash scripts/remote/par-render.sh $comp '$out' '' 8 $only"
    fetch_parts "$out" $(echo "$only" | tr ',' ' ')
    bash scripts/remote/join-parts.sh "$parts" "$out" "$audio"
    echo "redo $range done in $(( $(date +%s) - t0 )) s"
    ;;
  render-local)  # <Comp> <out.mp4> --audio <wav>: the whole film on this PC in 8 parts (kept for redo-local), then joined
    comp=$1; out=$2; shift 2; audio=$(audio_of "$@"); parts="${out%.mp4}_parts"; t0=$(date +%s); P=${RR_PROCS:-8}
    total=$(node scripts/remote/frames.mjs "$comp" | tail -1); mkdir -p "$parts"; : > "$parts/ranges.txt"
    for i in $(seq 0 $((P - 1))); do echo "$i $((i * total / P)) $(((i + 1) * total / P - 1))" >> "$parts/ranges.txt"; done
    while read -r i a b; do
      rm -rf "$parts/p$i.mp4" "$parts/p${i}_chunks"
      node scripts/render-short.mjs "$comp" "$parts/p$i.mp4" --frames $a-$b | grep -E "done:|retry|FAIL|rror" || true
    done < "$parts/ranges.txt"
    bash scripts/remote/join-parts.sh "$parts" "$out" "$audio"
    echo "render-local done in $(( $(date +%s) - t0 )) s"
    ;;
  redo-local)   # same as redo, rendered on this PC one part after another (no rental)
    comp=$1; out=$2; range=$3; shift 3; audio=$(audio_of "$@"); parts="${out%.mp4}_parts"; t0=$(date +%s)
    [ -f "$parts/ranges.txt" ] || { echo "no $parts/ranges.txt: render the whole film once first"; exit 1; }
    only=$(touched_parts "$parts" "$range"); echo "frames $range -> parts $only"
    for i in $(echo "$only" | tr ',' ' '); do
      read -r _ a b < <(awk -v i="$i" '$1 == i' "$parts/ranges.txt")
      rm -rf "$parts/p$i.mp4" "$parts/p${i}_chunks"   # no resume: the point is to re-render
      node scripts/render-short.mjs "$comp" "$parts/p$i.mp4" --frames $a-$b
    done
    bash scripts/remote/join-parts.sh "$parts" "$out" "$audio"
    echo "redo-local $range done in $(( $(date +%s) - t0 )) s"
    ;;
  stills)   # <Comp> <outPrefix> <frames> [scale] [props-json]
    comp=$1; prefix=$2; frames=$3; scale=${4:-0.5}; props=${5:-}
    send
    "${SSH[@]}" "$(remote_env) COMP=$comp ${props:+PROPS='$props'} node scripts/bridge-stills.mjs '$prefix' $frames $scale"
    mkdir -p "$(dirname "$prefix")"
    "${SSH[@]}" "cd '$RR_DIR' && tar -cz $prefix*" | tar -xz
    echo "fetched ${prefix}*"
    ;;
  down) $PY stop ;;           # after every job: GPU billing off, set-up kept
  done) $PY destroy-current ;; # all billing off
  state) $PY state ;;
  ssh) "${SSH[@]}" ;;
  *) sed -n 2,16p "$0"; exit 1 ;;
esac
