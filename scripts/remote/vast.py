"""vast.ai helper (this PC only). Reads VAST_API_KEY from ~/.tts_keys.env and never prints it or sends it anywhere but
vast.ai's own API (Authorization header, not the URL).

  python scripts/remote/vast.py list                 # your instances: id, state, GPU, $/h, ssh host:port
  python scripts/remote/vast.py destroy <id>         # return (destroy) one instance: billing stops
  python scripts/remote/vast.py destroy-current      # return the instance in .remote-render.env (matched by ssh host/port)
  python scripts/remote/vast.py offers               # the 5 cheapest offers that meet the studio's conditions (free, read-only)
  python scripts/remote/vast.py rent <offer_id>      # SPENDS MONEY: rent that offer, wait until SSH works, write .remote-render.env
  python scripts/remote/vast.py start                # SPENDS MONEY: start the stopped instance of .remote-render.env, wait, update host/port
  python scripts/remote/vast.py stop                 # stop it (GPU billing stops; its disk is kept and billed a little)
  python scripts/remote/vast.py state                # state of the instance of .remote-render.env

rent / start begin billing: Claude runs them only after the user said yes in chat for that time (price shown).
stop / destroy reduce billing: Claude runs them as soon as the remote work is done.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

API = "https://console.vast.ai/api/v0"
ROOT = pathlib.Path(__file__).resolve().parents[2]


def key():
    for line in (pathlib.Path.home() / ".tts_keys.env").read_text(encoding="utf-8").splitlines():
        if line.startswith("VAST_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("VAST_API_KEY not found in ~/.tts_keys.env")


def call(method, path):
    base = API
    if method == "GET1":   # instance listing moved to v1 (v0 answers 410 deprecated_endpoint, 2026-11)
        method, base = "GET", API.replace("/v0", "/v1")
    r = urllib.request.Request(base + path, method=method, headers={"Authorization": f"Bearer {key()}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            body = res.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        if e.code == 410 and "/v0" in base:   # endpoint retired: same call on v1
            return call(method if method != "GET" else "GET1", path) if method == "GET" else _v1(method, path)
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")


def _v1(method, path):
    r = urllib.request.Request(API.replace("/v0", "/v1") + path, method=method, headers={"Authorization": f"Bearer {key()}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            body = res.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")


def destroy(iid):
    """return one instance, then check it is really gone (listing) and say so"""
    call("DELETE", f"/instances/{iid}/")
    left = [i for i in instances() if str(i.get("id")) == str(iid) and (i.get("actual_status") or "") not in ("exited", "destroyed")]
    print(f"destroyed {iid}" + ("" if not left else f"  -- WARNING: still listed as {left[0].get('actual_status')}; check the vast.ai Instances page"))


def instances():
    return call("GET1", "/instances/").get("instances", [])


def ssh_of(i):
    """direct ssh (public ip + mapped 22/tcp) and the proxy ssh, whichever exist"""
    out = []
    ports = (i.get("ports") or {}).get("22/tcp") or []
    if i.get("public_ipaddr") and ports:
        out.append((i["public_ipaddr"].strip(), str(ports[0].get("HostPort"))))
    if i.get("ssh_host") and i.get("ssh_port"):
        out.append((str(i["ssh_host"]), str(i["ssh_port"])))
    return out


def env():
    e = {}
    p = ROOT / ".remote-render.env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").split():
            if "=" in line:
                k, v = line.split("=", 1); e[k] = v
    return e


# ---------------- the studio's conditions (scripts/remote/README.md) ----------------
COND = {"gpu_name": {"eq": "RTX 4090"}, "num_gpus": {"eq": 1}, "rentable": {"eq": True}, "rented": {"eq": False},
        "reliability2": {"gte": 0.99}, "cpu_cores_effective": {"gte": 12}, "cpu_ram": {"gte": 32000}, "verified": {"eq": True},
        "inet_down": {"gte": 200}, "disk_space": {"gte": 30}, "order": [["dph_total", "asc"]], "type": "on-demand", "limit": 40}
BLOCKED_GEO = ("China", ", CN")   # setup downloads (Google, npm, GitHub) fail or crawl there
IMAGE = "nvidia/cuda:12.6.3-runtime-ubuntu24.04"   # what setup.sh was tested on (Ubuntu 24.04)


def post(path, body, method="POST"):
    r = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode(),
                               headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=90) as res:
            b = res.read(); return json.loads(b) if b else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")


def offers(n=5):
    rows = post("/bundles/", COND).get("offers", [])
    rows = [o for o in rows if not any(b in (o.get("geolocation") or "") for b in BLOCKED_GEO)]
    # NVIDIA driver 600+ (2026-11-24, 610.57): Vulkan does not start in the container and the angle-egl fallback draws
    # garbage boxes in rendered videos -> only offer machines with an older driver
    old = [o for o in rows if int(str(o.get("driver_version") or "0").split(".")[0] or 0) < 600]
    return (old or rows)[:n]


def fmt_offer(o):
    return (f"{o['id']}  {o.get('geolocation')}  ${o.get('dph_total', 0):.3f}/h  CPU {o.get('cpu_cores_effective', 0):.0f}  "
            f"RAM {round(o.get('cpu_ram', 0) / 1024)}GB  信頼度 {100 * (o.get('reliability2') or o.get('reliability') or 0):.1f}%  回線 {o.get('inet_down', 0):.0f}Mbps  ドライバー {o.get('driver_version')}")


def write_env(i):
    host, port = ssh_of(i)[0]
    old = env()
    lines = [f"RR_HOST={host}", f"RR_PORT={port}", f"RR_USER={old.get('RR_USER', 'root')}", f"RR_DIR={old.get('RR_DIR', '/root/anime')}",
             f"RR_CONC={old.get('RR_CONC', '4')}", f"RR_INSTANCE={i['id']}"]
    (ROOT / ".remote-render.env").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"ssh: {host}:{port}  (written to .remote-render.env)")


def wait_running(iid, timeout=600):
    import time
    t0 = time.time()
    while time.time() - t0 < timeout:
        hit = [i for i in instances() if str(i.get("id")) == str(iid)]
        if hit and hit[0].get("actual_status") == "running" and ssh_of(hit[0]):
            write_env(hit[0]); return hit[0]
        time.sleep(10)
    sys.exit(f"instance {iid} not running after {timeout} s: check the vast.ai Instances page")


def current():
    e = env()
    if e.get("RR_INSTANCE"):
        hit = [i for i in instances() if str(i.get("id")) == e["RR_INSTANCE"]]
        if hit: return hit[0]
    hit = [i for i in instances() if (e.get("RR_HOST"), e.get("RR_PORT")) in ssh_of(i)]
    return hit[0] if hit else None


def set_state(iid, state):
    for path in (f"/instances/{iid}/",):
        try:
            return post(path, {"state": state}, method="PUT")
        except SystemExit as e:
            print(e)
    return None


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        rows = instances()
        if not rows:
            print("no instances (nothing is being billed for GPU time)")
        for i in rows:
            print(f"{i.get('id')}  {i.get('actual_status') or i.get('cur_state')}  {i.get('gpu_name')}  ${i.get('dph_total', 0):.3f}/h  "
                  f"{i.get('geolocation', '')}  ssh {' / '.join(f'{h}:{p}' for h, p in ssh_of(i))}")
    elif cmd == "destroy":
        destroy(sys.argv[2])
    elif cmd == "destroy-current":
        e = env()
        hit = [i for i in instances() if (e.get("RR_HOST"), e.get("RR_PORT")) in ssh_of(i)]
        if not hit:
            print("no instance matches .remote-render.env (already returned?)")
            return
        for i in hit:
            destroy(i["id"])
        rest = instances()
        print("instances left:", len(rest), "(none: no GPU billing)" if not rest else "-- run `list` to see them")
    elif cmd == "offers":
        rows = offers()
        if not rows:
            print("no offer meets the conditions right now")
        for o in rows:
            print(fmt_offer(o))
    elif cmd == "rent":   # SPENDS MONEY: only after the user's yes for this time
        oid = sys.argv[2]
        r = post(f"/asks/{oid}/", {"client_id": "me", "image": IMAGE, "disk": 30, "runtype": "ssh",
                                    "env": {"NVIDIA_DRIVER_CAPABILITIES": "all"}, "label": "anime-render"}, method="PUT")
        iid = r.get("new_contract") or r.get("id")
        if not iid:
            sys.exit(f"rent failed: {str(r)[:300]}")
        print(f"rented offer {oid} -> instance {iid}; waiting for SSH ...")
        wait_running(iid)
    elif cmd == "start":  # SPENDS MONEY: only after the user's yes for this time
        i = current() or sys.exit("no instance in .remote-render.env: rent one first")
        set_state(i["id"], "running")
        print(f"starting {i['id']} ..."); wait_running(i["id"])
    elif cmd == "stop":
        i = current()
        if not i:
            print("nothing to stop"); return
        set_state(i["id"], "stopped")
        print(f"stopped {i['id']} (GPU billing off; disk kept)")
    elif cmd == "state":
        i = current()
        print("no instance" if not i else f"{i['id']}  {i.get('actual_status')}  ${i.get('dph_total', 0):.3f}/h (running)  ssh {ssh_of(i)}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
