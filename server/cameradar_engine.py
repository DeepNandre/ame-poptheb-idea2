#!/usr/bin/env python3
"""
cameradar_engine.py — RTSP/CCTV discovery for Building Scanner.

Runs Cameradar (CLI or Docker) against an IP range and returns normalized JSON.
No fake data unless CAMERADAR_SAMPLE_PATH or --use-sample is explicitly set.

Install (macOS):
  go install github.com/Ullaakut/cameradar/v6/cmd/cameradar@latest
  export PATH="$PATH:$(go env GOPATH)/bin"

Docker:
  docker pull ullaakut/cameradar

Usage:
  python3 server/cameradar_engine.py --ip-range 192.168.1.0/24
  python3 server/cameradar_engine.py --ip-range 10.0.0.50 --pretty
  python3 server/cameradar_engine.py --use-sample   # demo with server/samples/cameradar_sample.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [cameradar] %(levelname)s %(message)s",
)
log = logging.getLogger("cameradar_engine")

DEFAULT_TIMEOUT = int(os.environ.get("CAMERADAR_TIMEOUT", "120"))
from urllib.parse import urlparse

SAMPLE_PATH = Path(__file__).parent / "samples" / "cameradar_sample.json"
PROJECT_BIN = Path(__file__).resolve().parent.parent / "bin" / "cameradar"
IP_RANGE_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3})(?:/(?:[0-9]|[12][0-9]|3[0-2]))?\b"
)


def extract_ip_range(text: str) -> Optional[str]:
    """Pull first CIDR or IP from free text (command bar)."""
    m = IP_RANGE_RE.search(text or "")
    return m.group(0) if m else None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cred_pair(raw: Any) -> Optional[Dict[str, str]]:
    if not raw:
        return None
    if isinstance(raw, dict):
        user = raw.get("username") or raw.get("user") or raw.get("login")
        pwd = raw.get("password") or raw.get("pass") or raw.get("secret")
        if user or pwd:
            return {"username": user or "", "password": pwd or ""}
    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        return {"username": str(raw[0]), "password": str(raw[1])}
    if isinstance(raw, str) and ":" in raw:
        user, _, pwd = raw.partition(":")
        return {"username": user, "password": pwd}
    return None


def normalize_camera(entry: Dict[str, Any]) -> Dict[str, Any]:
    ip = entry.get("ip") or entry.get("address") or entry.get("host") or ""
    port = int(entry.get("port") or 554)
    route = entry.get("route") or entry.get("path") or ""
    if not route:
        routes = entry.get("routes") or entry.get("available_routes") or []
        if isinstance(routes, list) and routes:
            route = routes[0] if isinstance(routes[0], str) else routes[0].get("route", "")
        elif isinstance(routes, str):
            route = routes

    creds = _cred_pair(entry.get("credentials") or entry.get("creds"))
    if not creds:
        creds = _cred_pair(entry.get("authentication"))

    model = entry.get("model") or entry.get("device_model") or entry.get("brand") or "Unknown"
    manufacturer = (
        entry.get("manufacturer")
        or entry.get("brand")
        or entry.get("vendor")
        or "Unknown"
    )

    rtsp_url = entry.get("rtsp_url") or entry.get("url") or ""
    if not rtsp_url and ip:
        auth = ""
        if creds and creds.get("username"):
            auth = f"{creds['username']}:{creds.get('password', '')}@"
        rtsp_url = f"rtsp://{auth}{ip}:{port}{route}"

    return {
        "ip": ip,
        "port": port,
        "model": model,
        "manufacturer": manufacturer,
        "route": route or "/",
        "credentials": creds,
        "rtsp_url": rtsp_url,
        "accessible": bool(entry.get("accessible", True)),
    }


def parse_cameradar_payload(raw: Any) -> List[Dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = (
            raw.get("cameras")
            or raw.get("devices")
            or raw.get("streams")
            or raw.get("results")
            or []
        )
        if not items and raw.get("ip"):
            items = [raw]
    else:
        return []

    out: List[Dict[str, Any]] = []
    for item in items:
        if isinstance(item, dict):
            cam = normalize_camera(item)
            if cam["ip"]:
                out.append(cam)
    return out


def parse_m3u(text: str) -> List[Dict[str, Any]]:
    """Parse Cameradar v6 M3U playlist output."""
    cameras: List[Dict[str, Any]] = []
    title = "Unknown"
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#EXTM3U"):
            continue
        if line.startswith("#EXTINF"):
            title = line.split(",", 1)[-1].strip() if "," in line else "Unknown"
            continue
        if line.startswith(("rtsp://", "rtsps://")):
            u = urlparse(line)
            creds = None
            if u.username is not None:
                creds = {"username": u.username, "password": u.password or ""}
            cameras.append(
                normalize_camera(
                    {
                        "ip": u.hostname,
                        "port": u.port or 554,
                        "route": u.path or "/",
                        "model": title,
                        "credentials": creds,
                        "rtsp_url": line,
                    }
                )
            )
            title = "Unknown"
    return cameras


def find_runner() -> Tuple[Optional[str], Optional[str]]:
    """Return (command_or_path, mode) where mode is 'cli' | 'docker'."""
    custom = os.environ.get("CAMERADAR_BIN")
    if custom and Path(custom).is_file():
        return custom, "cli"
    if PROJECT_BIN.is_file():
        return str(PROJECT_BIN), "cli"
    if shutil.which("cameradar"):
        return "cameradar", "cli"
    gopath_bin = Path.home() / "go" / "bin" / "cameradar"
    if gopath_bin.is_file():
        return str(gopath_bin), "cli"
    if shutil.which("docker"):
        return "docker", "docker"
    return None, None


def run_cameradar_cli(bin_path: str, ip_range: str, out_dir: Path, timeout: int) -> Tuple[str, str]:
    m3u_file = out_dir / "cameradar_output.m3u"
    cmd = [
        bin_path,
        "--targets",
        ip_range,
        "--ui",
        "plain",
        "--output",
        str(m3u_file),
    ]
    log.info("Running: %s", " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return proc.stdout, proc.stderr


def run_cameradar_docker(ip_range: str, out_dir: Path, timeout: int) -> Tuple[str, str]:
    m3u_name = "cameradar_output.m3u"
    container_out = f"/out/{m3u_name}"
    cmd = [
        "docker",
        "run",
        "--rm",
        "--net=host",
        "-v",
        f"{out_dir}:/out",
        "ullaakut/cameradar",
        "--targets",
        ip_range,
        "--ui",
        "plain",
        "--output",
        container_out,
    ]
    log.info("Running: %s", " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return proc.stdout, proc.stderr


def load_sample(path: Optional[Path] = None) -> Dict[str, Any]:
    sample = path or Path(os.environ.get("CAMERADAR_SAMPLE_PATH", str(SAMPLE_PATH)))
    with open(sample, "r", encoding="utf-8") as f:
        data = json.load(f)
    cameras = parse_cameradar_payload(data.get("cameras", data))
    return {
        "building_ip_range": data.get("building_ip_range", "sample"),
        "total_cameras": len(cameras),
        "cameras": cameras,
        "source": "sample",
        "scanned_at": _now(),
    }


def scan_cameras(
    ip_range: str,
    *,
    timeout: int = DEFAULT_TIMEOUT,
    use_sample: bool = False,
) -> Tuple[Dict[str, Any], List[str]]:
    notes: List[str] = []

    if use_sample or os.environ.get("CAMERADAR_USE_SAMPLE") == "1":
        try:
            result = load_sample()
            notes.append(f"CCTV results from reference dataset ({SAMPLE_PATH.name})")
            return result, notes
        except Exception as e:
            notes.append(f"Sample CCTV file unavailable: {e}")
            return empty_result(ip_range), notes

    runner, mode = find_runner()
    if not runner:
        notes.append(
            "CCTV scanner not available on server — contact admin or enable demo dataset"
        )
        return empty_result(ip_range), notes

    with tempfile.TemporaryDirectory(prefix="cameradar_") as tmp:
        out_dir = Path(tmp)
        m3u_file = out_dir / "cameradar_output.m3u"
        stdout = ""
        stderr = ""
        try:
            if mode == "docker":
                stdout, stderr = run_cameradar_docker(ip_range, out_dir, timeout)
            else:
                stdout, stderr = run_cameradar_cli(runner, ip_range, out_dir, timeout)
        except subprocess.TimeoutExpired:
            notes.append(f"CCTV scan timed out after {timeout}s — try a smaller subnet (e.g. /25)")
            return empty_result(ip_range), notes
        except FileNotFoundError:
            notes.append("CCTV scanner binary not found")
            return empty_result(ip_range), notes
        except Exception as e:
            notes.append(f"CCTV scan failed: {e}")
            return empty_result(ip_range), notes

        if stderr.strip():
            low = stderr.lower()
            # Cameradar prints "attacking devices: no stream found" when a subnet
            # simply has no RTSP cameras — that's a normal empty result, not an error.
            if "no stream found" in low or "no streams" in low:
                log.info("No accessible RTSP cameras on %s", ip_range)
            else:
                log.info("scanner notice: %s", stderr.strip()[:500])

        cameras: List[Dict[str, Any]] = []
        if m3u_file.is_file():
            try:
                cameras = parse_m3u(m3u_file.read_text(encoding="utf-8"))
            except Exception as e:
                notes.append(f"Could not parse CCTV scan output: {e}")

        if not cameras:
            legacy_json = out_dir / "cameradar_output.json"
            if legacy_json.is_file():
                try:
                    with open(legacy_json, "r", encoding="utf-8") as f:
                        cameras = parse_cameradar_payload(json.load(f))
                except Exception as e:
                    notes.append(f"Could not parse legacy CCTV JSON output: {e}")

        if not cameras and stdout.strip():
            try:
                cameras = parse_cameradar_payload(json.loads(stdout))
            except Exception:
                for line in stdout.splitlines():
                    line = line.strip()
                    if line.startswith("{"):
                        try:
                            cameras.extend(parse_cameradar_payload(json.loads(line)))
                        except Exception:
                            pass

        if cameras:
            notes.append(f"CCTV scan found {len(cameras)} camera(s) on {ip_range}")
        else:
            notes.append(
                f"CCTV scan completed on {ip_range} — no RTSP streams found (ports 554/5554/8554)"
            )

        return {
            "building_ip_range": ip_range,
            "total_cameras": len(cameras),
            "cameras": cameras,
            "source": mode,
            "scanned_at": _now(),
        }, notes


def empty_result(ip_range: str = "") -> Dict[str, Any]:
    return {
        "building_ip_range": ip_range,
        "total_cameras": 0,
        "cameras": [],
        "source": None,
        "scanned_at": _now(),
    }


def discover_cctv(ip_range: Optional[str]) -> Tuple[Dict[str, Any], List[str]]:
    if not ip_range or not ip_range.strip():
        return empty_result(), [
            "No building network range — enter a CIDR above (e.g. 192.168.1.0/25)"
        ]
    return scan_cameras(ip_range.strip())


def main():
    p = argparse.ArgumentParser(description="Cameradar CCTV discovery for Building Scanner")
    p.add_argument("--ip-range", "-t", help="Target IP or CIDR (e.g. 192.168.1.0/24)")
    p.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Scan timeout seconds")
    p.add_argument("--use-sample", action="store_true", help="Load demo sample JSON")
    p.add_argument("--pretty", action="store_true")
    args = p.parse_args()

    if args.use_sample:
        result = load_sample()
        notes: List[str] = ["Using sample CCTV data"]
    else:
        if not args.ip_range:
            p.error("--ip-range is required unless --use-sample")
        result, notes = scan_cameras(args.ip_range, timeout=args.timeout)

    payload = {"cctv": result, "notes": notes}
    print(json.dumps(payload, indent=2 if args.pretty else None))


if __name__ == "__main__":
    main()
