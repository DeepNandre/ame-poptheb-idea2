#!/usr/bin/env python3
"""
gbfs_audit.py — privacy-compliance auditor for public micromobility GBFS feeds.

What it does (and ONLY this):
  poll     Repeatedly fetch ONE public feed URL and save timestamped snapshots
           (+ response headers). Low frequency. Public data only.
  analyze  Read those snapshots and decide, with evidence, whether the feed
           leaks a trackable identifier:
             1. Do bike_ids rotate per the GBFS v2.0 requirement?  (Check #1)
             2. Does rental_uris hide a STABLE id behind a rotating bike_id?  (Check #2)
             3. Is there any rate-limiting?  (Check #4)
           Optional --ride-* flags do a SELF-RIDE correlation: prove the attack
           on your OWN trip only. (Check, safely.)

What it deliberately does NOT do:
  - No grid-scanning a city, no User-Agent/IP rotation, no rate-limit evasion.
  - No reconstructing other people's trips. The PoC is your own ride.

Stdlib only — no pip install. Run:  python3 gbfs_audit.py --help
"""
import argparse, glob, json, math, os, re, sys, time
from collections import defaultdict
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

UA = "VeloAudit/0.1 (responsible-disclosure research; contact: you@example.com)"
# Tokens inside rental_uris that look like a per-vehicle identifier.
ID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"  # uuid
                   r"|(?<![\w-])[A-Za-z0-9_-]{10,}(?![\w-])")  # or any long opaque token


# ---------- shared helpers ----------------------------------------------------

def vehicles(snapshot):
    """Yield (id, lat, lon, is_reserved, rental_uris) for v2 (bikes) or v3 (vehicles)."""
    data = snapshot.get("data", {})
    rows = data.get("bikes") or data.get("vehicles") or []
    for v in rows:
        vid = v.get("bike_id") or v.get("vehicle_id")
        if not vid:
            continue
        yield (
            vid,
            v.get("lat"), v.get("lon"),
            bool(v.get("is_reserved")),
            v.get("rental_uris") or {},
        )


def ruri_token(rental_uris):
    """Pull the longest id-looking token out of a rental_uris object, if any."""
    best = None
    for url in rental_uris.values():
        if not isinstance(url, str):
            continue
        for m in ID_RE.findall(url):
            tok = m if isinstance(m, str) else m[0]
            if tok and (best is None or len(tok) > len(best)):
                best = tok
    return best


def haversine_m(a_lat, a_lon, b_lat, b_lon):
    R = 6371000
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(h))


# ---------- poll --------------------------------------------------------------

def cmd_poll(args):
    if args.interval < 30:
        sys.exit("Refusing interval < 30s. This is a politeness/compliance check, not a scraper.")
    os.makedirs(args.out, exist_ok=True)
    print(f"Polling {args.url}\n  every {args.interval}s, {args.count} times -> {args.out}/")
    for i in range(args.count):
        ts = int(time.time())
        req = Request(args.url, headers={"User-Agent": UA, "Accept": "application/json"})
        status, headers, body = None, {}, None
        try:
            with urlopen(req, timeout=20) as r:
                status = r.status
                headers = dict(r.headers.items())
                body = r.read().decode("utf-8", "replace")
        except HTTPError as e:
            status = e.code
            headers = dict(e.headers.items()) if e.headers else {}
        except URLError as e:
            print(f"  [{i+1}/{args.count}] network error: {e.reason}")
            time.sleep(args.interval)
            continue
        stem = os.path.join(args.out, f"snap_{ts}")
        if body:
            with open(stem + ".json", "w") as f:
                f.write(body)
        with open(stem + ".headers.json", "w") as f:
            json.dump({"status": status, "headers": headers}, f, indent=2)
        rl = next((f"{k}={v}" for k, v in headers.items()
                   if "ratelimit" in k.lower() or k.lower() == "retry-after"), "none")
        print(f"  [{i+1}/{args.count}] HTTP {status}  rate-limit-headers: {rl}")
        if i + 1 < args.count:
            time.sleep(args.interval)
    print("Done. Now run:  python3 gbfs_audit.py analyze", args.out)


# ---------- analyze -----------------------------------------------------------

def load_snaps(folder):
    snaps = []
    for path in sorted(glob.glob(os.path.join(folder, "*.json"))):
        if path.endswith(".headers.json"):
            continue
        try:
            with open(path) as f:
                obj = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        m = re.search(r"(\d{9,})", os.path.basename(path))
        ts = int(m.group(1)) if m else obj.get("last_updated", 0)
        snaps.append((ts, obj))
    return sorted(snaps, key=lambda x: x[0])


def cmd_analyze(args):
    snaps = load_snaps(args.folder)
    if len(snaps) < 2:
        sys.exit(f"Need >=2 snapshots in {args.folder}. Run `poll` first (or drop captured JSON there).")

    span_min = (snaps[-1][0] - snaps[0][0]) / 60.0
    id_seen_at = defaultdict(list)        # bike_id -> [timestamps]
    id_locs = defaultdict(list)           # bike_id -> [(lat,lon)]
    id_snaps = defaultdict(set)           # bike_id -> {snapshot indices}
    rtoken_to_bikeids = defaultdict(set)  # rental_uris token -> {bike_ids}
    rtoken_seen_at = defaultdict(list)    # rental_uris token -> [timestamps]
    for idx, (ts, snap) in enumerate(snaps):
        for vid, lat, lon, reserved, ruris in vehicles(snap):
            id_seen_at[vid].append(ts)
            id_snaps[vid].add(idx)
            if lat is not None and lon is not None:
                id_locs[vid].append((lat, lon))
            tok = ruri_token(ruris)
            if tok:
                rtoken_to_bikeids[tok].add(vid)
                rtoken_seen_at[tok].append(ts)

    print(f"\n=== GBFS PRIVACY AUDIT — {args.folder} ===")
    print(f"snapshots: {len(snaps)}   window: {span_min:.0f} min   distinct bike_ids: {len(id_seen_at)}")

    # Check #1 — ID rotation: an id that TRAVELS a long way survived a trip = not rotating.
    MOVE_M = 200  # beyond GPS jitter; below typical rebalancing relocations
    moved, reappeared = {}, 0
    for vid in id_seen_at:
        locs = id_locs.get(vid, [])
        disp = max((haversine_m(locs[0][0], locs[0][1], la, lo) for la, lo in locs), default=0.0)
        if disp > MOVE_M:
            moved[vid] = disp
        s = sorted(id_snaps[vid])  # vanished then returned under the SAME id?
        if any(s[i+1] - s[i] > 1 for i in range(len(s) - 1)):
            reappeared += 1
    pct_moved = 100 * len(moved) / max(1, len(id_seen_at))
    print("\n[1] ID ROTATION  (same id that travels far = survived a trip = NOT rotating)")
    if span_min < 20:
        print("    ! window <20min — let it run 45-60min so bikes complete real trips.")
    if moved:
        print(f"    {len(moved)} ids ({pct_moved:.0f}%) moved >{MOVE_M}m under the SAME id "
              f"(max {max(moved.values()):.0f}m); {reappeared} vanished then returned under the same id.")
    if pct_moved > 10 and span_min >= 30:
        print("    ⚠ FLAG: ids survive trips and travel → feed likely does NOT rotate per GBFS v2.0.")
        print("      Confound: could be staff rebalancing — confirm with a self-ride (--ride-*).")
    else:
        print("    ids don't travel under a stable id → consistent with per-trip rotation. Likely compliant.")

    # Check #2 — rental_uris stable-id leak (the smoking gun)
    leaks = {tok: bids for tok, bids in rtoken_to_bikeids.items() if len(bids) > 1}
    print("\n[2] rental_uris STABLE-ID LEAK  (rotates bike_id but leaks a fixed id)")
    if not rtoken_to_bikeids:
        print("    no id-like token found in rental_uris (or none captured).")
    elif leaks:
        print(f"    \U0001f6a8 FINDING: {len(leaks)} rental_uris token(s) map to MULTIPLE bike_ids.")
        print("    A stable identifier survives bike_id rotation → trip correlation possible.")
        for tok, bids in list(leaks.items())[:3]:
            print(f"      token {tok[:24]}... seen under {len(bids)} different bike_ids")
        print("    → This is a reportable finding. Confirm with --ride-* on your own trip, then disclose.")
    else:
        print("    each rental_uris token maps to exactly one bike_id — no stable-id leak detected.")

    # Check #4 — rate limiting (from headers sidecars)
    print("\n[4] RATE-LIMITING")
    hdr_files = glob.glob(os.path.join(args.folder, "*.headers.json"))
    saw_rl, saw_429 = False, False
    for hf in hdr_files:
        try:
            with open(hf) as f:
                h = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        if h.get("status") == 429:
            saw_429 = True
        if any("ratelimit" in k.lower() or k.lower() == "retry-after" for k in h.get("headers", {})):
            saw_rl = True
    if not hdr_files:
        print("    no header sidecars (use `poll` to capture them).")
    elif saw_429 or saw_rl:
        print("    rate-limit signals present (429 or X-RateLimit/Retry-After). Throttled.")
    else:
        print(f"    ⚠ no rate-limit headers or 429s across {len(hdr_files)} requests — weak/absent throttling.")

    # Optional: self-ride correlation (prove it on YOUR trip only)
    if args.ride_start and args.ride_end:
        selfride(args, snaps)

    print("\n=== verdict: a FINDING in [1] or [2] is what you disclose. Else → compliance scoreboard. ===\n")


def selfride(args, snaps):
    rs, re_ = args.ride_start, args.ride_end
    print("\n[PoC] SELF-RIDE CORRELATION (your own trip)")
    def near(lat, lon, target):
        if target is None or lat is None or lon is None:
            return True
        tlat, tlon = target
        return haversine_m(lat, lon, tlat, tlon) <= args.radius
    start_pt = tuple(map(float, args.start_latlon.split(","))) if args.start_latlon else None
    end_pt = tuple(map(float, args.end_latlon.split(","))) if args.end_latlon else None
    before = {vid: (lat, lon) for ts, s in snaps if ts <= rs
              for vid, lat, lon, *_ in vehicles(s) if near(lat, lon, start_pt)}
    after = {vid for ts, s in snaps if ts >= re_
             for vid, lat, lon, *_ in vehicles(s) if near(lat, lon, end_pt)}
    vanished = set(before) - {vid for ts, s in snaps if ts >= re_ for vid, *_ in vehicles(s)}
    reappeared = after - set(before)
    print(f"    candidates that vanished near your start: {len(vanished)}")
    print(f"    candidates that appeared near your end:   {len(reappeared)}")
    if len(vanished) <= 3 and vanished:
        print(f"    → narrow set {list(vanished)[:3]} — if one of these is YOUR bike, the trip is reconstructable.")


def main():
    p = argparse.ArgumentParser(description="Privacy-compliance auditor for public GBFS feeds.")
    sub = p.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("poll", help="fetch one public feed URL repeatedly")
    pp.add_argument("url")
    pp.add_argument("--out", default="snapshots")
    pp.add_argument("--interval", type=int, default=60, help="seconds between polls (min 30)")
    pp.add_argument("--count", type=int, default=120, help="how many polls (120 x 60s = 2h)")
    pp.set_defaults(func=cmd_poll)

    pa = sub.add_parser("analyze", help="analyze captured snapshots")
    pa.add_argument("folder")
    pa.add_argument("--ride-start", type=int, help="unix ts you started YOUR ride")
    pa.add_argument("--ride-end", type=int, help="unix ts you ended YOUR ride")
    pa.add_argument("--start-latlon", help="lat,lon of ride start (optional)")
    pa.add_argument("--end-latlon", help="lat,lon of ride end (optional)")
    pa.add_argument("--radius", type=int, default=80, help="meters for location match")
    pa.set_defaults(func=cmd_analyze)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
