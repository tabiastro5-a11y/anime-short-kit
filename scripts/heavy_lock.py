"""One heavy job at a time on this PC (same lock file as scripts/heavy.mjs). Use from the repo root:

    from heavy_lock import heavy_lock          # (scripts/ on sys.path)
    with heavy_lock("short_qa"):
        ...

Liveness of the holder is checked with OpenProcess/GetExitCodeProcess: on Windows os.kill(pid, 0) would KILL it."""
import contextlib
import ctypes
import datetime
import json
import os
import sys
import time

# the repo's out/ (not the caller's working directory: episode audio scripts run from their own folder)
LOCK = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out", ".heavy.lock"))


def _alive(pid: int) -> bool:
    if sys.platform != "win32":
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    k = ctypes.windll.kernel32
    h = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return False
    code = ctypes.c_ulong()
    ok = k.GetExitCodeProcess(h, ctypes.byref(code))
    k.CloseHandle(h)
    return bool(ok) and code.value == 259  # STILL_ACTIVE


@contextlib.contextmanager
def heavy_lock(label: str):
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    told = False
    while True:
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(fd, "w") as f:
                json.dump({"pid": os.getpid(), "label": label, "since": datetime.datetime.now().isoformat()}, f)
            break
        except FileExistsError:
            try:
                o = json.load(open(LOCK, encoding="utf-8"))
            except Exception:
                o = None
            if o and not _alive(int(o.get("pid", 0))):
                with contextlib.suppress(OSError):
                    os.remove(LOCK)
                continue
            if not told:
                print(f"waiting for another heavy job to finish ({(o or {}).get('label', '?')} since {(o or {}).get('since', '?')})", flush=True)
                told = True
            time.sleep(2)
    try:
        yield
    finally:
        with contextlib.suppress(Exception):
            if json.load(open(LOCK, encoding="utf-8")).get("pid") == os.getpid():
                os.remove(LOCK)
