import subprocess

import httpx

# Surfshark on Linux runs as a full-tunnel WireGuard VPN (interface surfshark_wg),
# NOT a local SOCKS5 proxy. The kernel routes ALL outbound traffic through the
# tunnel, so Shodan calls are protected without any per-client proxy config. We
# verify the tunnel owns the default route before sending anything to Shodan.
VPN_IFACE_MATCH = ("surfshark", "wg")  # substrings that mark the VPN interface


def vpn_route_iface() -> str | None:
    """Return the interface the kernel would use to reach the internet, or None."""
    try:
        out = subprocess.run(
            ["ip", "route", "get", "1.1.1.1"],
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout
    except Exception:
        return None
    # Format: "1.1.1.1 dev surfshark_wg table ... src 10.14.0.2 ..."
    parts = out.split()
    if "dev" in parts:
        return parts[parts.index("dev") + 1]
    return None


def vpn_is_up() -> bool:
    """True only if external traffic egresses via the Surfshark WireGuard tunnel."""
    iface = vpn_route_iface() or ""
    return any(m in iface.lower() for m in VPN_IFACE_MATCH)


def osint_client() -> httpx.AsyncClient:
    """All Shodan calls use this. No proxy needed — the full-tunnel VPN routes it.
    Callers MUST gate on vpn_is_up() first so traffic never leaves outside the tunnel."""
    return httpx.AsyncClient(timeout=15.0)


def plain_client() -> httpx.AsyncClient:
    """For crt.sh and public cleartext endpoints (also tunnelled when the VPN is up)."""
    return httpx.AsyncClient(timeout=15.0)
