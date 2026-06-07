# Capturing the live feed (the one manual step)

Everything else is automated. We just need the **real feed URL** the app calls,
because every published URL is dead/now-authenticated. Two ways:

## Option A — HTTP Toolkit (easiest, ~10 min)
1. Install **HTTP Toolkit** (free) on your laptop: https://httptoolkit.com
2. Click **Android device via ADB** (or **iOS**) and follow the pairing steps.
3. On your phone, open the **Lime** (or **Dott**) app. Browse the map, then take a
   short real ride and end it — all on **your own account**.
4. In HTTP Toolkit, filter requests for `gbfs`, `free_bike_status`, `vehicle_status`,
   `map`, or the operator's domain (`lime.bike`, `ridedott.com`, `voiapp.io`).
5. Copy:
   - the **public feed URL** (no `Authorization` header) → use with `poll`
   - any **`trip_receipt` / `trip_summary`** calls (these have `Authorization`) → note the
     `trip_id` / `transaction_id` format for the IDOR check (your own account only).

## Option A2 — iPhone + Mac via Proxyman (YOUR setup, ~10 min)
1. Install **Proxyman** (free) on your Mac: https://proxyman.io
2. Proxyman → **Certificate menu → Install Certificate on iOS → Physical Device**. Follow it:
   - Connect iPhone to the **same Wi-Fi** as the Mac; set iPhone Wi-Fi proxy to the Mac IP:9090.
   - On iPhone: install the profile, then **Settings → General → VPN & Device Management** (trust it)
     **and Settings → General → About → Certificate Trust Settings** (flip it ON). Both are required.
3. Open the **Lime / Dott** app, browse, take a short real ride, end it — **your own account only**.
4. In Proxyman, filter by host (`lime.bike`, `ridedott.com`, `voiapp.io`).
5. Copy any **`trip_receipt` / `trip_summary` / ride-history** calls (they carry an `Authorization` header)
   and note the **`trip_id` / `transaction_id` format** — that's the IDOR target (your own account only).

> ⚠️ **Cert-pinning reality check:** if the app pins certificates, Proxyman shows TLS errors and you
> see no decrypted traffic. On a non-jailbroken iPhone this is hard to bypass. If you hit that wall,
> stop — don't sink hours into it. The public-feed audit (#1) is the reliable path.

## Option B — mitmproxy
1. `pip install mitmproxy` → run `mitmweb`.
2. Set phone Wi-Fi proxy to your laptop IP : 8080, install the mitm cert on the phone.
3. (If the app uses cert pinning, unpin with Frida/objection — **your own device only**.)
4. Same as A step 4–5.

## Then run the audit
```bash
# 1) point poll at the PUBLIC feed url you captured, while you ride + return a bike
python3 gbfs_audit.py poll "<PUBLIC_FEED_URL>" --out snapshots --interval 60 --count 120

# 2) get a verdict (add your ride window to prove it on YOUR trip)
python3 gbfs_audit.py analyze snapshots \
  --ride-start <unix_ts_start> --ride-end <unix_ts_end> \
  --start-latlon 51.5246,-0.0782 --end-latlon 51.5135,-0.0890
```

## What the verdict means
- **[2] FINDING** (rental_uris leaks a stable id) → strongest, most likely real bug. Disclose it.
- **[1] FLAG** (ids don't rotate) → the 2020 bug is still live. Disclose it.
- Everything clean → you have a **compliance scoreboard** (still a credible Validate deliverable).

## Rules (keep it a bounty, not a crime)
- Your own account, your own ride. One-record PoC. Never reconstruct strangers' trips.
- Disclose to the vendor first (Lime: bugcrowd.com/lime). No regulator CC on day one.
