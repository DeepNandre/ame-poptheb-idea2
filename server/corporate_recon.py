#!/usr/bin/env python3
"""
corporate_recon.py — Phase 2: Bluetooth / WiFi correlation engine for Building Scanner.

Takes:
  - OSINT discovery JSON (from osint_engine.py)
  - Live device scan list (from scanner.py stream, or captured JSON)
  - Optional --strict flag

Produces:
  - Per-device correlation with probable_owner, probability, company_email,
    device_type, department, reasoning[]
  - "employees_present" summary (the ones we have high confidence are in the building right now)
  - Ready for the "Corporate Recon" tab in the UI.

This is pure logic + CLI. No heavy deps. Designed to be spawned from the Node server
the same way scanner.py is, or called directly for testing.

Usage examples:
  # Full pipeline test (mock data)
  python3 server/osint_engine.py --company "Acme Corp" --mock > /tmp/osint.json
  python3 server/corporate_recon.py --osint-json /tmp/osint.json --devices-json samples/devices.json --pretty

  # Or pipe devices from a running scan capture
  # (you can capture a few seconds of scanner output into a JSON array)

  # Strict mode (higher precision, fewer false positives)
  python3 server/corporate_recon.py --osint-json osint.json --devices-json devs.json --strict
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def norm(s: str) -> str:
    """Lowercase + strip non-alphanum for fuzzy token matching."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def tokenize_name(full: str) -> List[str]:
    parts = re.split(r"[\s._-]+", (full or "").strip())
    tokens = [p.lower() for p in parts if len(p) >= 2]
    # Also add concatenated first+last without separator
    if len(tokens) >= 2:
        tokens.append(tokens[0] + tokens[-1])
    return tokens

def device_name(dev: Dict[str, Any]) -> str:
    """Best human-readable identifier we have for the device."""
    for key in ("ssid", "name", "device_name", "friendly_name"):
        val = dev.get(key)
        if val and isinstance(val, str) and val.strip():
            return val.strip()
    return dev.get("mac", "unknown-device")

def signal_bonus(sig: Any) -> float:
    """Higher signal strength = more likely the device is inside / close."""
    try:
        s = float(sig)
    except Exception:
        s = 30.0
    s = max(0.0, min(100.0, s))
    if s >= 80:
        return 0.18
    if s >= 65:
        return 0.12
    if s >= 50:
        return 0.07
    return 0.02

# ──────────────────────────────────────────────────────────────────────────────
# Core correlation
# ──────────────────────────────────────────────────────────────────────────────

def correlate(
    osint: Dict[str, Any],
    devices: List[Dict[str, Any]],
    strict: bool = False,
) -> Dict[str, Any]:
    """
    Correlate live wireless devices against corporate OSINT intel.

    Returns a rich object the frontend can render directly in the Corporate Recon view.
    """
    employees: List[Dict[str, str]] = osint.get("employees") or []
    tech_stack: List[str] = [t.lower() for t in (osint.get("tech_stack") or [])]
    fingerprints: List[str] = [f.lower() for f in (osint.get("device_fingerprints") or [])]
    company = osint.get("company") or "Unknown"
    building = osint.get("building") or osint.get("company_domain") or "the building"

    # Precompute employee tokens for fast matching
    emp_index: List[Tuple[Dict[str, str], List[str]]] = []
    for e in employees:
        toks = set(tokenize_name(e.get("name", "")))
        # Also allow matching on email local part
        email_local = (e.get("email") or "").split("@")[0]
        toks.update(tokenize_name(email_local))
        emp_index.append((e, list(toks)))

    correlated: List[Dict[str, Any]] = []
    present: List[Dict[str, str]] = []  # high-confidence employees we think are physically here

    for dev in devices:
        dname = device_name(dev).lower()
        dname_norm = norm(dname)
        rssi = dev.get("rssi")
        sig = dev.get("signal_strength", 40)

        prob = 0.18  # baseline "something is transmitting here"
        reasons: List[str] = []
        owner = None
        email = None
        title = None
        dept = None

        # 1. Name / employee match (the big one)
        best_name_score = 0.0
        matched_emp = None
        for emp, toks in emp_index:
            score = 0.0
            for tok in toks:
                if not tok:
                    continue
                if tok in dname or tok in dname_norm:
                    # exact-ish token hit inside device name
                    score = 0.62 if not strict else 0.72
                    break
                # loose contains (e.g. "john" in "iPhone-JohnD")
                if len(tok) >= 3 and tok in dname_norm:
                    score = max(score, 0.48 if not strict else 0.58)
            if score > best_name_score:
                best_name_score = score
                matched_emp = emp

        if matched_emp and best_name_score > 0.3:
            reasons.append(f"name match: {matched_emp.get('name')}")
            prob += best_name_score
            owner = matched_emp.get("name")
            email = matched_emp.get("email")
            title = matched_emp.get("title") or "Employee"
            dept = title

        # 2. Tech stack / device fingerprint keyword match
        tech_hits = 0
        for kw in tech_stack + fingerprints:
            if not kw or len(kw) < 3:
                continue
            if kw in dname or kw in dname_norm:
                tech_hits += 1
                reasons.append(f"tech/fingerprint match: {kw}")
        if tech_hits:
            prob += min(0.28, 0.12 * tech_hits)

        # 3. Signal strength / proximity
        prob += signal_bonus(sig)
        if sig and float(sig) >= 70:
            reasons.append("strong signal — device is very close / inside")

        # Clamp and round
        prob = max(0.12, min(0.96, prob))
        prob = round(prob, 2)

        # Only surface devices that are either name-matched or reasonably interesting
        is_interesting = bool(reasons) or prob >= 0.55 or (sig and float(sig) > 65)

        if is_interesting:
            correlated.append({
                "mac": dev.get("mac"),
                "name": device_name(dev),
                "rssi": rssi,
                "signal_strength": sig,
                "timestamp": dev.get("timestamp"),
                "probable_owner": owner or "Unknown occupant / device",
                "probability": prob,
                "company_email": email or "",
                "title": title or "",
                "department": dept or (title or "Unknown"),
                "device_type": device_name(dev),
                "reasoning": reasons or ["detected inside building wireless footprint"],
            })

            if owner and prob >= 0.65:
                present.append({
                    "name": owner,
                    "email": email or "",
                    "title": title or "",
                    "probability": prob,
                    "device": device_name(dev),
                })

    # Dedup present employees (highest prob wins)
    best_present: Dict[str, Dict[str, Any]] = {}
    for p in present:
        key = (p["name"] or "").lower()
        if key not in best_present or p["probability"] > best_present[key]["probability"]:
            best_present[key] = p
    employees_present = sorted(best_present.values(), key=lambda x: -x["probability"])

    # Extra context for the UI tables
    return {
        "company": company,
        "building": building,
        "generated_at": _now(),
        "strict": strict,
        "correlated_devices": sorted(correlated, key=lambda x: -x["probability"]),
        "employees_present": employees_present,
        "summary": {
            "total_devices_scanned": len(devices),
            "correlated": len(correlated),
            "high_confidence": sum(1 for c in correlated if c["probability"] >= 0.7),
            "employees_present_count": len(employees_present),
            "cctv_cameras_count": len(osint.get("cctv_cameras", [])),
            "cctv_with_credentials": sum(
                1 for c in osint.get("cctv_cameras", [])
                if c.get("credentials") and c["credentials"].get("username")
            ),
        },
        "osint_context": {
            "subdomains": osint.get("subdomains", []),
            "tech_stack": osint.get("tech_stack", []),
            "exposed_devices": osint.get("exposed_devices", []),
            "device_fingerprints": osint.get("device_fingerprints", []),
            "cctv_cameras": osint.get("cctv_cameras", []),
            "cctv_scan": osint.get("cctv_scan", {}),
            "mocked": osint.get("mocked", False),
            "mocked_sources": osint.get("mocked_sources", []),
            "notes": osint.get("notes", []),
        },
    }

# ──────────────────────────────────────────────────────────────────────────────
# CLI (great for testing Phase 2 in isolation)
# ──────────────────────────────────────────────────────────────────────────────

def load_json(path: str) -> Dict[str, Any] | List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    p = argparse.ArgumentParser(
        description="Phase 2 — correlate live wireless devices with corporate OSINT intel."
    )
    p.add_argument("--osint-json", required=True, help="Path to osint_engine.py output JSON")
    p.add_argument("--devices-json", required=True, help="Path to array of scan devices (from scanner.py)")
    p.add_argument("--strict", action="store_true", help="Use stricter name matching (fewer false positives)")
    p.add_argument("--pretty", action="store_true", help="Pretty-print output JSON")
    args = p.parse_args()

    osint = load_json(args.osint_json)
    # devices file can be either a raw array or an object with "devices"
    raw = load_json(args.devices_json)
    if isinstance(raw, dict) and "devices" in raw:
        devices = raw["devices"]
    elif isinstance(raw, list):
        devices = raw
    else:
        devices = []

    result = correlate(osint, devices, strict=args.strict)

    print(json.dumps(result, indent=2 if args.pretty else None))

if __name__ == "__main__":
    main()
