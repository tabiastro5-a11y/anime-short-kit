#!/bin/bash
# Runs ON the rented Linux GPU machine (vast.ai etc.), once per machine, from the project folder:
#   bash scripts/remote/setup.sh
# Installs Node 20, ffmpeg, Chrome's Linux libraries + Vulkan, the project's packages and Remotion's Chrome for Testing,
# then checks which GL backend really uses the GPU and writes it to scripts/remote/gpu.env (read by remote.sh).
# Remotion docs: /docs/miscellaneous/cloud-gpu (--gl=vulkan, --chrome-mode=chrome-for-testing) and the Docker guide
# (--gl=angle-egl). The container must be started with NVIDIA_DRIVER_CAPABILITIES=all (graphics, not only compute).
set -e
cd "$(dirname "$0")/../.."
export DEBIAN_FRONTEND=noninteractive

echo "== GPU"
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv || { echo "nvidia-smi not found: this is not a GPU machine"; exit 1; }
echo "NVIDIA_DRIVER_CAPABILITIES=${NVIDIA_DRIVER_CAPABILITIES:-<unset>}  (needs 'all' or to include 'graphics')"

echo "== packages"
apt-get update -qq
ASOUND=$(apt-cache show libasound2t64 >/dev/null 2>&1 && echo libasound2t64 || echo libasound2)   # Ubuntu 24.04 renamed it
apt-get install -y -qq curl ca-certificates gnupg ffmpeg libvulkan1 vulkan-tools \
  libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm-dev $ASOUND libxrandr2 libxkbcommon-dev \
  libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 fonts-noto-cjk >/dev/null
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

echo "== project packages"
npm ci --no-audit --no-fund --loglevel=error
npx remotion browser ensure --chrome-mode=chrome-for-testing

echo "== which GL backend uses the GPU"
# hosts with a very new NVIDIA driver (610, 2026-11-24) cannot start Vulkan inside the container; angle-egl works there,
# but only when the EGL loader libraries are installed (the CUDA image has none)
apt-get install -y -qq libegl1 libgles2 libgl1 libglvnd0 >/dev/null 2>&1 || true
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/tmp}
for GL in vulkan angle-egl egl; do
  OUT=$(npx remotion gpu --chrome-mode=chrome-for-testing --gl=$GL 2>&1 || true)
  echo "--- $GL"; echo "$OUT" | grep -iE "webgl|canvas|rasteriz|gpu" | head -6
  if echo "$OUT" | grep -iqE "webgl[^:]*: *hardware accelerated"; then
    printf 'RENDER_GL=%s\nRENDER_CHROME_MODE=chrome-for-testing\n' "$GL" > scripts/remote/gpu.env
    echo ">> using $GL"; break
  fi
done
if [ ! -s scripts/remote/gpu.env ]; then
  echo "!! no backend reported hardware-accelerated WebGL. Check NVIDIA_DRIVER_CAPABILITIES=all on the instance (docs: scripts/remote/README.md)."
  exit 2
fi
echo "== idle auto-return (safety net)"
pkill -f idle-return.sh 2>/dev/null || true
nohup setsid bash scripts/remote/idle-return.sh > /dev/null 2>&1 &
sleep 2; tail -2 out/idle-return.log 2>/dev/null
echo "== done"
