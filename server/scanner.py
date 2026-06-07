#!/usr/bin/env python3
"""
WiFi + Bluetooth scanner.
 - macOS WiFi: `system_profiler SPAirPortDataType` — no root, no installs.
 - macOS Bluetooth: `system_profiler SPBluetoothDataType -json`
 - Linux WiFi: scapy passive sniff (needs root + monitor-mode interface).
 - Linux Bluetooth: `bluetoothctl` discovery when available.

Writes JSON lines to stdout; warnings/errors go to stderr.
"""

import hashlib
import json
import logging
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


logging.basicConfig(
    stream=sys.stderr,
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

EMIT_INTERVAL = 5  # seconds between scans
DEVICE_TTL = 30
MAX_DEVICES = 500


def emit(payload: dict):
    print(json.dumps(payload), flush=True)


def emit_error(message: str):
    emit({"type": "error", "message": message, "timestamp": _now()})


# ── macOS system_profiler ──────────────────────────────────────────────────────


def parse_system_profiler_output(output: str) -> List[Dict]:
    """
    Parse `system_profiler SPAirPortDataType` output.
    Networks are deduplicated by SSID; strongest RSSI wins when a network
    appears on multiple bands.
    """
    devices: Dict[str, Dict] = {}
    current_ssid: Optional[str] = None
    current_rssi: Optional[int] = None
    in_wifi_section = False

    SKIP_HEADERS = {
        "Current Network Information:",
        "Other Local Wi-Fi Networks:",
        "Wi-Fi:",
        "Interfaces:",
    }

    for line in output.split("\n"):
        if not line.strip():
            continue

        stripped = line.strip()
        indent = len(line) - len(line.lstrip(" "))

        # We're inside the Wi-Fi block once we see 'Wi-Fi:'
        if stripped in ("Wi-Fi:", "AirPort:") or stripped.startswith("Wi-Fi:"):
            in_wifi_section = True
            continue
        if not in_wifi_section:
            continue

        # Network names sit at indent 12, end with ':', and aren't section headers
        if indent == 12 and stripped.endswith(":") and stripped not in SKIP_HEADERS:
            # Save the previous network before starting a new one
            if current_ssid and current_rssi is not None:
                _save_device(devices, current_ssid, current_rssi)
            current_ssid = stripped[:-1]
            current_rssi = None
            continue

        # Signal line — keep the strongest reading across multiple bands
        if "Signal / Noise:" in stripped and current_ssid:
            m = re.search(r"(-\d+)\s*dBm", stripped)
            if m:
                rssi = int(m.group(1))
                if current_rssi is None or rssi > current_rssi:
                    current_rssi = rssi

    # Flush the last network
    if current_ssid and current_rssi is not None:
        _save_device(devices, current_ssid, current_rssi)

    return list(devices.values())


def _rssi_to_strength(rssi: int) -> int:
    return max(0, min(100, (rssi + 100) * 2))


# ── macOS Bluetooth (system_profiler JSON) ─────────────────────────────────────

BT_STATUS_RSSI = {
    "connected": -48,
    "nearby": -68,
    "paired": -82,
}


def parse_bluetooth_json(data: dict) -> List[Dict]:
    """Normalize Apple Bluetooth profiler JSON into scanner device objects."""
    devices: Dict[str, Dict] = {}
    blocks = data.get("SPBluetoothDataType") or []
    if not blocks:
        return []

    block = blocks[0] if isinstance(blocks[0], dict) else {}
    sections = (
        ("connected", "device_connected"),
        ("nearby", "device_not_connected"),
        ("paired", "device_paired"),
    )

    for status, key in sections:
        for item in block.get(key) or []:
            if not isinstance(item, dict):
                continue
            for name, props in item.items():
                if not isinstance(props, dict):
                    continue
                mac = (props.get("device_address") or "").upper()
                if not mac:
                    continue

                raw_rssi = props.get("device_rssi")
                if raw_rssi is not None:
                    try:
                        rssi = int(str(raw_rssi).replace("dBm", "").strip())
                    except ValueError:
                        rssi = BT_STATUS_RSSI.get(status, -75)
                else:
                    rssi = BT_STATUS_RSSI.get(status, -75)

                minor = props.get("device_minorType") or "Device"
                entry = {
                    "mac": mac,
                    "name": name,
                    "ssid": name,  # recon engine reads ssid first
                    "device_type": minor,
                    "status": status,
                    "rssi": rssi,
                    "signal_strength": _rssi_to_strength(rssi),
                    "radio": "bluetooth",
                    "timestamp": _now(),
                }
                prev = devices.get(mac)
                if not prev or entry["rssi"] > prev["rssi"]:
                    devices[mac] = entry

    return sorted(devices.values(), key=lambda d: d["rssi"], reverse=True)


def run_bluetooth_scan_macos() -> Optional[List[Dict]]:
    try:
        result = subprocess.run(
            ["system_profiler", "SPBluetoothDataType", "-json"],
            capture_output=True,
            text=True,
            timeout=25,
        )
        if result.returncode != 0 and not result.stdout.strip():
            logger.warning(f"Bluetooth profiler exited {result.returncode}")
            return None
        data = json.loads(result.stdout)
        return parse_bluetooth_json(data)
    except subprocess.TimeoutExpired:
        logger.warning("Bluetooth profiler timed out")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Bluetooth JSON parse failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Bluetooth scan failed: {e}")
        return None


def run_bluetooth_scan_linux() -> Optional[List[Dict]]:
    """Best-effort BLE/classic discovery via bluetoothctl."""
    if not shutil.which("bluetoothctl"):
        return []

    try:
        subprocess.run(
            ["bluetoothctl", "scan", "on"],
            capture_output=True,
            text=True,
            timeout=8,
        )
    except subprocess.TimeoutExpired:
        pass
    except Exception as e:
        logger.warning(f"bluetoothctl scan failed: {e}")
        return []

    try:
        result = subprocess.run(
            ["bluetoothctl", "devices"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception as e:
        logger.warning(f"bluetoothctl devices failed: {e}")
        return []

    devices: Dict[str, Dict] = {}
    for line in (result.stdout or "").splitlines():
        # Device AA:BB:CC:DD:EE:FF My Device Name
        m = re.match(r"Device\s+([0-9A-F:]{17})\s+(.*)", line.strip(), re.I)
        if not m:
            continue
        mac, name = m.group(1).upper(), m.group(2).strip() or "Unknown"
        rssi = -70
        devices[mac] = {
            "mac": mac,
            "name": name,
            "ssid": name,
            "device_type": "Device",
            "status": "nearby",
            "rssi": rssi,
            "signal_strength": _rssi_to_strength(rssi),
            "radio": "bluetooth",
            "timestamp": _now(),
        }

    return sorted(devices.values(), key=lambda d: d["mac"])


# ── Live BLE scan of NEARBY devices (bleak / CoreBluetooth) ─────────────────────
# Unlike system_profiler (which only lists devices PAIRED to this machine), this
# does an active BLE advertisement scan and reports devices physically AROUND you,
# with their real advertised RSSI. This is the primary Bluetooth path.

BLE_SCAN_SECONDS = 5.0

# Tracks whether we've already logged that BLE is unavailable, to avoid spamming
# the same warning every scan cycle while Bluetooth stays off.
_ble_unavailable_logged = False

# A few common Bluetooth SIG company identifiers, for friendlier labels.
BLE_COMPANY_IDS = {
    0x004C: "Apple",
    0x0006: "Microsoft",
    0x0075: "Samsung",
    0x00E0: "Google",
    0x0087: "Garmin",
    0x0157: "Huawei",
    0x0499: "Ruuvi",
    0x05A7: "Sonos",
    0x0059: "Nordic",
    0x004F: "Logitech",
    0x0131: "Tile",
    0x0822: "Fitbit",
}


def _ble_vendor(adv) -> Optional[str]:
    mfg = getattr(adv, "manufacturer_data", None) or {}
    for cid in mfg:
        if cid in BLE_COMPANY_IDS:
            return BLE_COMPANY_IDS[cid]
    return None


def run_ble_scan_bleak(duration: float = BLE_SCAN_SECONDS) -> Optional[List[Dict]]:
    """Active BLE advertisement scan → nearby devices with real RSSI.
    Returns None if bleak isn't installed or the adapter is unavailable, so the
    caller can fall back to the (paired-only) system_profiler path."""
    try:
        import asyncio
        from bleak import BleakScanner
    except ImportError:
        return None

    async def _scan():
        found = await BleakScanner.discover(timeout=duration, return_adv=True)
        devices: Dict[str, Dict] = {}
        for address, (dev, adv) in found.items():
            rssi = adv.rssi if adv and adv.rssi is not None else None
            # BLE RSSI is negative dBm; 127 (0x7F) / any non-negative value is the
            # "RSSI unavailable" sentinel — drop it so it can't masquerade as strong.
            if rssi is None or rssi >= 0:
                continue
            vendor = _ble_vendor(adv)
            name = (
                (adv.local_name if adv else None)
                or dev.name
                or (f"{vendor} device" if vendor else "Unknown BLE device")
            )
            devices[address] = {
                "mac": address,  # CoreBluetooth UUID on macOS (Apple hides real MACs)
                "name": name,
                "ssid": name,  # recon correlation reads ssid first
                "device_type": vendor or "BLE device",
                "status": "nearby",
                "rssi": rssi,
                "signal_strength": _rssi_to_strength(rssi),
                "radio": "bluetooth",
                "timestamp": _now(),
            }
        ranked = sorted(devices.values(), key=lambda d: d["rssi"], reverse=True)
        return ranked[:MAX_DEVICES]

    global _ble_unavailable_logged
    try:
        result = asyncio.run(_scan())
        _ble_unavailable_logged = False  # re-arm so a later outage warns again
        return result
    except Exception as e:
        if not _ble_unavailable_logged:
            logger.warning(
                f"Live BLE scan unavailable ({e}). Turn Bluetooth ON and grant your "
                f"terminal Bluetooth access in System Settings → Privacy & Security → "
                f"Bluetooth. Falling back to paired devices until then."
            )
            _ble_unavailable_logged = True
        return None


def run_bluetooth_scan() -> Optional[List[Dict]]:
    # Primary: live scan of nearby advertising BLE devices (what's around you).
    nearby = run_ble_scan_bleak()
    if nearby is not None:
        return nearby
    # Fallback only when bleak is unavailable: devices paired to THIS machine —
    # NOT a proximity scan. Install bleak (pip install bleak) for nearby scanning.
    if platform.system() == "Darwin":
        return run_bluetooth_scan_macos()
    return run_bluetooth_scan_linux()


def _save_device(devices: Dict, ssid: str, rssi: int):
    """Insert or update device, keeping the strongest RSSI seen."""
    if ssid in devices and devices[ssid]["rssi"] >= rssi:
        return
    pseudo_mac = ":".join(f"{b:02x}" for b in hashlib.md5(ssid.encode()).digest()[:6])
    devices[ssid] = {
        "mac": pseudo_mac,
        "ssid": ssid,
        "rssi": rssi,
        "timestamp": _now(),
        "signal_strength": _rssi_to_strength(rssi),
        "radio": "wifi",
    }


def run_system_profiler_scan() -> Optional[List[Dict]]:
    try:
        result = subprocess.run(
            ["system_profiler", "SPAirPortDataType"],
            capture_output=True,
            text=True,
            timeout=25,
        )
        if result.returncode != 0 and not result.stdout.strip():
            logger.warning(f"system_profiler exited {result.returncode}")
            return None
        return parse_system_profiler_output(result.stdout)
    except subprocess.TimeoutExpired:
        logger.warning("system_profiler timed out")
        return None
    except Exception as e:
        logger.error(f"system_profiler scan failed: {e}")
        return None


def scan_loop_macos():
    emit(
        {
            "type": "scanner_start",
            "message": "Scanning nearby WiFi and Bluetooth…",
            "timestamp": _now(),
        }
    )
    try:
        # NOTE: run WiFi then BLE sequentially. CoreBluetooth (via bleak) is
        # unreliable when another worker thread runs concurrently, so we do NOT
        # parallelize — the BLE scan owns the process for its window.
        while True:
            cycle_start = time.time()

            wifi_devices = run_system_profiler_scan()
            if wifi_devices is not None:
                emit(
                    {
                        "type": "scan_update",
                        "devices": wifi_devices,
                        "count": len(wifi_devices),
                        "timestamp": _now(),
                    }
                )

            # Live BLE scan of nearby devices — blocks ~BLE_SCAN_SECONDS.
            bt_devices = run_bluetooth_scan()
            if bt_devices is not None:
                emit(
                    {
                        "type": "bluetooth_scan_update",
                        "devices": bt_devices,
                        "count": len(bt_devices),
                        "timestamp": _now(),
                    }
                )

            time.sleep(max(0.5, EMIT_INTERVAL - (time.time() - cycle_start)))
    except KeyboardInterrupt:
        emit(
            {
                "type": "scanner_stop",
                "message": "Scanner stopped.",
                "timestamp": _now(),
            }
        )


# ── Linux scapy passive sniff ──────────────────────────────────────────────────


def get_linux_interface() -> str:
    try:
        result = subprocess.run(["ip", "link"], capture_output=True, text=True)
        for line in result.stdout.split("\n"):
            if "wlan" in line and "UP" in line:
                return line.split(":")[1].strip()
    except Exception:
        pass
    return "wlan0"


def check_raw_socket_permission(interface: str) -> bool:
    try:
        s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.IPPROTO_IP)
        s.bind((interface, 0))
        s.close()
        return True
    except PermissionError:
        return False
    except Exception:
        return True


def scan_loop_scapy():
    from scapy.all import sniff, Dot11, Dot11Beacon, Dot11ProbeResp, RadioTap  # type: ignore

    interface = get_linux_interface()

    if not check_raw_socket_permission(interface):
        emit_error(f"No permission to capture on {interface}. Try: sudo npm run api")
        sys.exit(1)

    devices: Dict[str, Dict] = {}
    last_emit = [0.0]

    def packet_callback(packet):
        if not (Dot11Beacon in packet or Dot11ProbeResp in packet):
            return
        if Dot11 not in packet:
            return
        mac = packet[Dot11].addr2
        if not mac:
            return
        ssid = None
        if Dot11Beacon in packet and packet[Dot11Beacon].info:
            ssid = packet[Dot11Beacon].info.decode("utf-8", errors="ignore")
        elif Dot11ProbeResp in packet and packet[Dot11ProbeResp].info:
            ssid = packet[Dot11ProbeResp].info.decode("utf-8", errors="ignore")
        rssi = packet[RadioTap].dBm_AntSignal if RadioTap in packet else None
        now = time.time()
        devices[mac] = {
            "mac": mac,
            "ssid": ssid or "Hidden Network",
            "rssi": rssi or -100,
            "timestamp": _now(),
            "signal_strength": _rssi_to_strength(rssi) if rssi else 0,
            "radio": "wifi",
            "_last_seen": now,
        }
        if len(devices) > MAX_DEVICES:
            oldest = min(devices, key=lambda m: devices[m]["_last_seen"])
            del devices[oldest]
        if now - last_emit[0] >= EMIT_INTERVAL:
            cutoff = now - DEVICE_TTL
            for m in [k for k, d in devices.items() if d["_last_seen"] < cutoff]:
                del devices[m]
            public = [
                {k: v for k, v in d.items() if k != "_last_seen"}
                for d in devices.values()
            ]
            if public:
                emit(
                    {
                        "type": "scan_update",
                        "devices": public,
                        "count": len(public),
                        "timestamp": _now(),
                    }
                )
            last_emit[0] = now

    emit(
        {
            "type": "scanner_start",
            "message": f"Passive WiFi + Bluetooth scan on {interface}…",
            "timestamp": _now(),
        }
    )
    try:
        sniff(
            iface=interface,
            prn=packet_callback,
            filter="(wlan beacon) or (wlan probe-resp)",
            store=False,
        )
    except KeyboardInterrupt:
        emit(
            {"type": "scanner_stop", "message": "Scanner stopped.", "timestamp": _now()}
        )
    except PermissionError:
        emit_error("Scanner requires root privileges. Try: sudo npm run api")
        sys.exit(1)
    except Exception as e:
        emit_error(str(e))
        sys.exit(1)


# ── entry point ────────────────────────────────────────────────────────────────


def _bluetooth_poll_loop(stop_event):
    """Background Bluetooth polling (Linux while scapy blocks)."""
    while not stop_event.is_set():
        devices = run_bluetooth_scan()
        if devices is not None:
            emit(
                {
                    "type": "bluetooth_scan_update",
                    "devices": devices,
                    "count": len(devices),
                    "timestamp": _now(),
                }
            )
        stop_event.wait(EMIT_INTERVAL)


# ── Demo mode: synthetic WiFi + BLE around the building ─────────────────────────
# Real capture needs sudo + a monitor-mode NIC (WiFi) and a powered BT adapter, which
# aren't available in a demo. This emits a stable, realistic set of nearby devices
# with live-looking RSSI jitter so the signal heatmap populates around the user's
# geolocation (the frontend places each device by its RSSI → distance). Enabled with
# SCANNER_DEMO=1, and used automatically on non-macOS when scapy isn't installed.

# (ssid, baseline RSSI dBm) — a City-of-London / Sky Garden flavoured airspace.
_DEMO_WIFI = [
    ("BTWiFi-with-FON", -45),
    ("Sky Garden Guest", -51),
    ("_SkyGarden_Staff", -58),
    ("Land Securities Guest", -55),
    ("The Fenchurch Restaurant", -60),
    ("Searcys Sky Pod", -64),
    ("Pret_Free_WiFi", -69),
    ("VM8419006", -63),
    ("EE-Hub-7G2K", -67),
    ("SKYQ5A8F", -72),
    ("TALKTALK-2F4A", -76),
    ("VodafoneConnect-3B9", -74),
    ("TP-Link_FE21", -71),
    ("DIRECT-9c-HP-M283", -78),
    ("Hidden Network", -82),
]

# (name, vendor/device_type, baseline RSSI dBm)
_DEMO_BLE = [
    ("iPhone", "Apple", -42),
    ("AirPods Pro", "Apple", -48),
    ("Apple Watch", "Apple", -52),
    ("John's MacBook Pro", "Apple", -55),
    ("Galaxy Buds2", "Samsung", -61),
    ("Fitbit Charge 5", "Fitbit", -66),
    ("Bose QC45", "Bose", -58),
    ("Sonos One", "Sonos", -73),
    ("Logitech MX Master", "Logitech", -69),
    ("Garmin fenix", "Garmin", -64),
    ("Tile", "Tile", -70),
    ("Surface Pro", "Microsoft", -67),
    ("Ruuvi 8F2A", "Ruuvi", -77),
    ("Samsung Smart TV", "Samsung", -75),
]

# Transient devices that drift in/out across cycles so counts feel live.
_DEMO_WIFI_TRANSIENT = [("Pixel_4821", -79), ("ZyXEL-A1F0", -81), ("Guest-2C", -77)]
_DEMO_BLE_TRANSIENT = [
    ("Unknown BLE device", "BLE device", -80),
    ("JBL Flip 6", "JBL", -72),
    ("Beats Studio", "Apple", -76),
]


def _fake_mac(seed: str) -> str:
    return ":".join(f"{b:02x}" for b in hashlib.md5(seed.encode()).digest()[:6])


def scan_loop_demo():
    """Emit synthetic WiFi + Bluetooth scan updates forever, with per-cycle RSSI
    jitter and a rotating transient device or two, so the heatmap looks alive."""
    import random

    emit(
        {
            "type": "scanner_start",
            "message": "Passive WiFi + Bluetooth scan (demo airspace)…",
            "timestamp": _now(),
        }
    )
    tick = 0
    while True:
        rng = random.Random(tick)

        wifi_pool = list(_DEMO_WIFI)
        if _DEMO_WIFI_TRANSIENT:
            wifi_pool.append(_DEMO_WIFI_TRANSIENT[tick % len(_DEMO_WIFI_TRANSIENT)])
        wifi = []
        for ssid, base in wifi_pool:
            rssi = max(-92, min(-30, base + rng.randint(-4, 4)))
            wifi.append(
                {
                    "mac": _fake_mac(ssid),
                    "ssid": ssid,
                    "rssi": rssi,
                    "signal_strength": _rssi_to_strength(rssi),
                    "radio": "wifi",
                    "timestamp": _now(),
                }
            )
        emit(
            {
                "type": "scan_update",
                "devices": wifi,
                "count": len(wifi),
                "timestamp": _now(),
            }
        )

        ble_pool = list(_DEMO_BLE)
        if _DEMO_BLE_TRANSIENT:
            ble_pool.append(_DEMO_BLE_TRANSIENT[tick % len(_DEMO_BLE_TRANSIENT)])
        ble = []
        for name, vendor, base in ble_pool:
            rssi = max(-92, min(-30, base + rng.randint(-4, 4)))
            ble.append(
                {
                    "mac": _fake_mac(name + vendor),
                    "name": name,
                    "ssid": name,
                    "device_type": vendor,
                    "status": "nearby",
                    "rssi": rssi,
                    "signal_strength": _rssi_to_strength(rssi),
                    "radio": "bluetooth",
                    "timestamp": _now(),
                }
            )
        emit(
            {
                "type": "bluetooth_scan_update",
                "devices": ble,
                "count": len(ble),
                "timestamp": _now(),
            }
        )

        tick += 1
        time.sleep(EMIT_INTERVAL)


def _demo_enabled() -> bool:
    return str(os.environ.get("SCANNER_DEMO", "")).lower() in ("1", "true", "yes", "on")


def main():
    if _demo_enabled():
        scan_loop_demo()
        return
    if platform.system() == "Darwin":
        scan_loop_macos()
    else:
        try:
            import scapy  # noqa: F401
        except ImportError:
            # No capture stack available off macOS — fall back to the demo airspace
            # so the heatmap still populates instead of dying with an error.
            scan_loop_demo()
            return
        import threading

        stop_event = threading.Event()
        bt_thread = threading.Thread(
            target=_bluetooth_poll_loop, args=(stop_event,), daemon=True
        )
        bt_thread.start()
        try:
            scan_loop_scapy()
        finally:
            stop_event.set()
            bt_thread.join(timeout=1)


if __name__ == "__main__":
    main()
