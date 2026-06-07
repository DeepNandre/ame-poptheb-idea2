#!/usr/bin/env python3
"""Building device scanner — company URL in, devices out (IP:port + URL).

Pass a company URL/domain and the script attributes its IP space, then runs a
list of device fingerprints over Shodan (cameras, RFID/access-control readers,
building-automation services) and prints each device it finds with a reachable
URL. Results are cached in camera_index.json keyed by building, so `show` reprints
without rescanning.

    python scan.py acme.com                 # scan + print + cache
    python scan.py acme.com --id hq         # cache under a custom building id
    python scan.py list                     # all cached buildings
    python scan.py show hq                  # reprint a cached building

SECURITY: Surfshark runs as a full-tunnel WireGuard VPN, so all traffic egresses
through it. The script runs a VPN preflight first (confirms the default route is
the surfshark_wg tunnel) and ABORTS if it isn't — your real IP is never exposed to
Shodan. Passive only: we read Shodan's index, we never probe the devices ourselves.

ATTRIBUTION: the apex domain is often CDN-fronted (Akamai/Cloudflare), so resolving
it gives the CDN's IP, not the org's. We instead pull subdomains from crt.sh,
resolve them, RDAP each IP, drop CDN/cloud-owned blocks, and keep what's left —
the org's real netblocks.
"""

import argparse
import asyncio
import concurrent.futures
import ipaddress
import json
import os
import pathlib
import socket
import sys
import urllib.parse

from dotenv import load_dotenv

# Project-local env: backend/.env first, then the project-root .env (cwd).
_HERE = pathlib.Path(__file__).resolve().parent
load_dotenv(_HERE / ".env")
load_dotenv(_HERE.parent / ".env")

from vpn import osint_client, plain_client, vpn_is_up, vpn_route_iface  # noqa: E402

SHODAN_API_KEY = os.getenv("SHODAN_API_KEY", "")
SHODAN_SEARCH_URL = "https://api.shodan.io/shodan/host/search"
RATE_LIMIT = 1.0  # Shodan: ~1 req/sec

INDEX_FILE = pathlib.Path(__file__).parent / "camera_index.json"
CIDR_LIMIT = 3  # cap net: queries per scan to stay within the rate/time budget
SUBDOMAIN_LIMIT = 250  # hostnames to resolve during attribution (concurrent)
RDAP_IP_LIMIT = 40  # distinct netblocks to RDAP-look-up
RDAP_URL = "https://rdap.arin.net/registry/ip/{ip}"  # follows redirects to other RIRs


# --- errors ------------------------------------------------------------------
# scan() raises these instead of calling sys.exit(), so the same engine can back
# both the CLI (translate to an exit code) and the API (translate to an HTTP
# status) without one ever tearing down the other's process.
class ScanError(Exception):
    """Base scan failure. exit_code drives the CLI; the API maps to an HTTP status."""

    exit_code = 1


class VpnDownError(ScanError):
    """The Surfshark tunnel isn't the default route, or its egress check failed."""

    exit_code = 2


class NoRangesError(ScanError):
    """No org-owned IP ranges resolved (apex likely fully CDN-fronted)."""

    exit_code = 3


# Orgs that own CDN/cloud space — their blocks aren't the building's own network.
CDN_ORGS = (
    "akamai",
    "cloudflare",
    "fastly",
    "amazon",
    "aws",
    "a100 row",  # Amazon's EU netblock registrant alias (AWS eu-central-1 etc.)
    "annapurna",  # Amazon subsidiary on some AWS allocations
    "cloudfront",
    "google",
    "microsoft",
    "azure",
    "incapsula",
    "imperva",
    "edgecast",
    "datacamp",
    "datapacket",
    "ovh",
    "digitalocean",
    "linode",
    "hetzner",
)

# Infra subdomains that usually point to an org's own network (not a CDN). Used as
# a fallback so attribution survives a CT-log outage, and to surface physical-
# security hosts directly.
INFRA_SUBS = (
    "vpn",
    "vpn2",
    "remote",
    "ns1",
    "ns2",
    "ns3",
    "dns",
    "dns1",
    "dns2",
    "mail",
    "mx",
    "mx1",
    "smtp",
    "imap",
    "webmail",
    "exchange",
    "owa",
    "web",
    "www2",
    "intranet",
    "portal",
    "gateway",
    "gw",
    "fw",
    "firewall",
    "dmz",
    "proxy",
    "ldap",
    "ad",
    "dc",
    "radius",
    "vc",
    "citrix",
    "cam",
    "cctv",
    "camera",
    "cameras",
    "nvr",
    "dvr",
    "access",
    "door",
    "badge",
    "hvac",
    "bms",
    "bacnet",
    "scada",
    "wifi",
    "wlan",
    "controller",
)

# --- the fingerprint list (the core; extend freely) --------------------------
# {cidr} / {org} are filled per target. Grouped by device category.
DEVICE_QUERIES: dict[str, list[str]] = {
    "camera": [
        # netblock-scoped, NOT org:"{org}" — RDAP sometimes returns a short/ambiguous
        # org token (e.g. "IC" for Imperial) and Shodan's org: filter then matches
        # unrelated orgs. net:{cidr} keeps every hit inside the attributed space.
        "net:{cidr} has_screenshot:true",
        "net:{cidr} port:554",
        'net:{cidr} product:"Hikvision IP Camera"',
        'net:{cidr} product:"Dahua"',
        'net:{cidr} product:"Axis"',
        "net:{cidr} server:GeoHttpServer",
    ],
    "access_control": [
        'net:{cidr} "HID VertX" port:4070',
        'net:{cidr} product:"Lenel"',
        'net:{cidr} product:"Genetec"',
        'net:{cidr} product:"Honeywell" port:443',
        'net:{cidr} "rfid"',
    ],
    "building_service": [
        "net:{cidr} port:47808",  # BACnet
        "net:{cidr} port:502",  # Modbus
    ],
}


def normalise_domain(raw: str) -> str:
    """Accept a full URL or a bare domain; return the registrable host."""
    raw = raw.strip()
    if "://" not in raw:
        raw = "//" + raw
    host = urllib.parse.urlparse(raw).hostname or ""
    return host.lower().removeprefix("www.")


def device_url(ip: str, port: int) -> str:
    """A human-clickable address for the device."""
    if port == 554:
        return f"rtsp://{ip}:{port}"
    if port in (443, 8443):
        return f"https://{ip}:{port}"
    if port in (80, 8080, 8000):
        return f"http://{ip}:{port}"
    return f"{ip}:{port}"


async def shodan_search(client, query: str, limit: int = 100) -> list[dict]:
    """One Shodan REST search (tunnelled). Returns the raw match list."""
    r = await client.get(
        SHODAN_SEARCH_URL,
        params={"key": SHODAN_API_KEY, "query": query, "limit": limit},
    )
    r.raise_for_status()
    return r.json().get("matches", [])


def classify(bucket: str, port: int, product: str) -> str:
    """Label a device by its actual signal, not just which query found it.
    A broad query (e.g. has_screenshot) can return RDP/web hosts, so we reclassify."""
    p = product.lower()
    if port == 554 or any(
        x in p for x in ("camera", "hikvision", "dahua", "axis", "nvr", "dvr", "rtsp")
    ):
        return "camera"
    if port in (4070, 4050) or any(
        x in p for x in ("hid", "lenel", "genetec", "rfid", "access control", "badge")
    ):
        return "access_control"
    if port == 3389 or "remote desktop" in p or "rdp" in p or "vnc" in p:
        return "remote_access"
    if port in (47808, 502) or any(x in p for x in ("bacnet", "modbus", "scada")):
        return "building_service"
    return bucket  # fall back to the query bucket it came from


def build_queries(category: str, cidrs: list[str], org: str) -> list[str]:
    out: list[str] = []
    for tmpl in DEVICE_QUERIES[category]:
        if "{cidr}" in tmpl:
            out += [tmpl.format(cidr=c, org=org) for c in cidrs]
        else:
            out.append(tmpl.format(org=org))
    return out


# --- attribution (domain → real org netblocks) -------------------------------
def _resolve(host: str) -> str | None:
    try:
        return socket.gethostbyname(host)
    except Exception:
        return None


def _rdap_org_name(d: dict) -> str:
    """Pull the org/registrant name out of an RDAP record."""
    for e in d.get("entities", []) or []:
        va = e.get("vcardArray")
        if va and len(va) > 1:
            for item in va[1]:
                if item and item[0] in ("fn", "org") and len(item) > 3:
                    val = item[3]
                    if isinstance(val, list):
                        val = " ".join(str(x) for x in val)
                    if val:
                        return str(val)
    return d.get("name", "") or ""


def _cidr_from_rdap(d: dict) -> str | None:
    for c in d.get("cidr0_cidrs", []) or []:
        pfx = c.get("v4prefix") or c.get("v6prefix")
        ln = c.get("length")
        if pfx and ln is not None:
            return f"{pfx}/{ln}"
    s, e = d.get("startAddress"), d.get("endAddress")
    if s and e:
        try:
            nets = list(
                ipaddress.summarize_address_range(
                    ipaddress.ip_address(s), ipaddress.ip_address(e)
                )
            )
            return str(nets[0]) if nets else None
        except ValueError:
            return None
    return None


async def rdap_lookup(client, ip: str) -> tuple[str | None, str]:
    """IP → (cidr, org_name) via RDAP. Returns (None, '') on failure."""
    try:
        r = await client.get(
            RDAP_URL.format(ip=ip),
            follow_redirects=True,
            headers={"Accept": "application/rdap+json"},
        )
        r.raise_for_status()
        d = r.json()
    except Exception:
        return None, ""
    return _cidr_from_rdap(d), _rdap_org_name(d)


async def certspotter_hosts(domain: str) -> set[str]:
    """Subdomains from SSLMate CertSpotter (CT log, free tier, more reliable than crt.sh)."""
    hosts: set[str] = set()
    url = (
        "https://api.certspotter.com/v1/issuances"
        f"?domain={domain}&include_subdomains=true&expand=dns_names"
    )
    try:
        async with plain_client() as c:
            r = await c.get(url, timeout=20.0)
            if r.status_code == 200:
                for e in r.json():
                    for name in e.get("dns_names", []) or []:
                        name = name.strip().lstrip("*.").lower()
                        if name.endswith(domain):
                            hosts.add(name)
    except Exception:
        pass
    return hosts


async def crt_sh_hosts(domain: str) -> set[str]:
    """Subdomains from crt.sh (often overloaded — best-effort secondary source)."""
    hosts: set[str] = set()
    try:
        async with plain_client() as c:
            r = await c.get(f"https://crt.sh/?q=%.{domain}&output=json", timeout=20.0)
            if r.status_code == 200:
                for e in r.json():
                    for name in (e.get("name_value", "") or "").splitlines():
                        name = name.strip().lstrip("*.").lower()
                        if name.endswith(domain):
                            hosts.add(name)
    except Exception:
        pass
    return hosts


async def gather_hosts(domain: str) -> list[str]:
    """Candidate hostnames from CT logs + an infra wordlist. CT sources run in parallel."""
    cs, crt = await asyncio.gather(certspotter_hosts(domain), crt_sh_hosts(domain))
    hosts = {domain, f"www.{domain}"} | cs | crt
    hosts |= {f"{sub}.{domain}" for sub in INFRA_SUBS}
    return list(hosts)


async def resolve_all(hosts: list[str]) -> list[str]:
    """Resolve hostnames → unique IPs, concurrently (blocking getaddrinfo in threads)."""
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as ex:
        results = await asyncio.gather(
            *(loop.run_in_executor(ex, _resolve, h) for h in hosts)
        )
    ips: list[str] = []
    for ip in results:
        if ip and ip not in ips:
            ips.append(ip)
    return ips


async def attribute(client, domain: str) -> tuple[list[str], str]:
    """domain → (collapsed real-org CIDRs, org name), CDN/cloud blocks dropped.

    The apex is often CDN-fronted, so we enumerate subdomains, resolve them, and
    RDAP each unique IP. Each distinct netblock is looked up once (we skip IPs
    already inside a known block), so a /11 like MIT's costs a single RDAP call.
    """
    hosts = await gather_hosts(domain)
    ips = await resolve_all(hosts[:SUBDOMAIN_LIMIT])

    cidr_org: dict[str, str] = {}  # cidr → owning org (CDN blocks excluded)
    org_votes: dict[str, int] = {}
    known_nets: list = []  # blocks already RDAP'd (kept OR dropped) — avoids re-lookup
    rdap_calls = 0
    for ip in ips:
        ipa = ipaddress.ip_address(ip)
        if any(ipa in n for n in known_nets):
            continue
        if rdap_calls >= RDAP_IP_LIMIT:
            break
        cidr, org = await rdap_lookup(client, ip)
        rdap_calls += 1
        await asyncio.sleep(0.2)  # be polite to RDAP
        if not cidr or not org:
            continue
        try:
            known_nets.append(ipaddress.ip_network(cidr, strict=False))
        except ValueError:
            pass
        if any(c in org.lower() for c in CDN_ORGS):
            continue  # remembered (so we skip its IPs) but not scanned
        cidr_org[cidr] = org
        org_votes[org] = org_votes.get(org, 0) + 1

    if not org_votes:
        return [], domain.split(".")[0]

    # Keep only the dominant org's blocks — drops cross-org false positives (e.g. a
    # vendor subdomain that resolves into GoDaddy/other space).
    org = max(org_votes, key=org_votes.get)
    nets = []
    for cidr, owner in cidr_org.items():
        if owner != org:
            continue
        try:
            nets.append(ipaddress.ip_network(cidr, strict=False))
        except ValueError:
            continue
    collapsed = [
        str(n) for n in ipaddress.collapse_addresses(n for n in nets if n.version == 4)
    ]
    return collapsed, org


# --- scanning ----------------------------------------------------------------
async def vpn_preflight() -> str:
    """Confirm the VPN tunnel owns the default route, then return the egress IP."""
    async with osint_client() as c:
        r = await c.get("https://api.ipify.org")
        r.raise_for_status()
        return r.text.strip()


async def vpn_status() -> dict:
    """Non-fatal VPN health snapshot for the API /health endpoint."""
    up = vpn_is_up()
    egress = None
    if up:
        try:
            egress = await vpn_preflight()
        except Exception:
            up = False  # tunnel claims default route but can't actually egress
    return {"vpn_up": up, "iface": vpn_route_iface(), "egress_ip": egress}


async def scan(domain: str) -> dict:
    """Run the full pipeline for a domain. Raises ScanError on failure (never exits)."""
    print("[*] VPN preflight…", flush=True)
    if not vpn_is_up():
        iface = vpn_route_iface() or "unknown"
        raise VpnDownError(
            f"Surfshark VPN is not the default route (egress iface: {iface}). "
            f"Connect Surfshark before scanning so your real IP is never sent to Shodan."
        )
    try:
        egress = await vpn_preflight()
    except Exception as e:
        raise VpnDownError(f"VPN up but egress check failed ({e}).") from e
    print(f"[+] Tunnelled via {vpn_route_iface()} → egress {egress}", flush=True)

    print(f"[*] Attributing IP space for {domain} (CT logs → RDAP)…", flush=True)
    devices: list[dict] = []
    seen: set[tuple[str, int]] = set()
    async with osint_client() as client:
        cidrs, org = await attribute(client, domain)
        if not cidrs:
            raise NoRangesError(
                f"No org-owned IP ranges found for {domain}. "
                f"Apex may be fully CDN-fronted with no resolvable org subdomains."
            )
        scan_cidrs = cidrs[:CIDR_LIMIT]
        print(f"[+] org={org!r}  cidrs={scan_cidrs}", flush=True)

        for category in DEVICE_QUERIES:
            print(f"[*] Scanning: {category}…", flush=True)
            for q in build_queries(category, scan_cidrs, org):
                try:
                    matches = await shodan_search(client, q)
                except Exception as e:
                    print(f"    [!] query failed ({q[:50]}): {e}", file=sys.stderr)
                    matches = []
                for b in matches:
                    ip = b.get("ip_str", "")
                    port = b.get("port", 0)
                    product = b.get("product", "") or ""
                    version = b.get("version", "") or ""
                    key = (ip, port)
                    if not ip or key in seen:
                        continue
                    seen.add(key)
                    devices.append(
                        {
                            "category": classify(category, port, product),
                            "ip": ip,
                            "port": port,
                            "product": product,
                            "version": version,
                            "url": device_url(ip, port),
                            "shodan": f"https://www.shodan.io/host/{ip}",
                        }
                    )
                await asyncio.sleep(RATE_LIMIT)

    return {"domain": domain, "org": org, "cidrs": scan_cidrs, "devices": devices}


# --- index -------------------------------------------------------------------
def load_index() -> dict:
    if INDEX_FILE.exists():
        return json.loads(INDEX_FILE.read_text())
    return {}


def save_to_index(building_id: str, result: dict):
    index = load_index()
    index[building_id] = result
    INDEX_FILE.write_text(json.dumps(index, indent=2))


def print_devices(result: dict):
    devices = result.get("devices", [])
    if not devices:
        print("\nNo devices found.")
        return
    print(
        f"\n{len(devices)} device(s) for {result['domain']} (org: {result['org']}):\n"
    )
    header = f"{'CATEGORY':<16} {'PRODUCT':<24} {'URL':<28} SHODAN"
    print(header)
    print("-" * len(header))
    for d in sorted(devices, key=lambda x: (x["category"], x["ip"])):
        product = (f"{d['product']} {d['version']}".strip()) or "-"
        print(f"{d['category']:<16} {product:<24} {d['url']:<28} {d['shodan']}")


# --- cli ---------------------------------------------------------------------
def cmd_list():
    index = load_index()
    if not index:
        print("No buildings cached yet. Run: python scan.py <company-url>")
        return
    print(f"{'BUILDING':<20} {'DOMAIN':<24} DEVICES")
    print("-" * 56)
    for bid, r in index.items():
        print(f"{bid:<20} {r.get('domain', ''):<24} {len(r.get('devices', []))}")


def cmd_show(building_id: str):
    index = load_index()
    r = index.get(building_id)
    if not r:
        print(
            f"No cached building '{building_id}'. Run: python scan.py list",
            file=sys.stderr,
        )
        sys.exit(1)
    print_devices(r)


def main():
    # Subcommands and "scan a domain" don't mix cleanly under argparse subparsers
    # (a bare domain gets read as an unknown subcommand), so dispatch the verbs by hand.
    argv = sys.argv[1:]
    if argv and argv[0] == "list":
        cmd_list()
        return
    if argv and argv[0] == "show":
        if len(argv) < 2:
            print("usage: python scan.py show <building_id>", file=sys.stderr)
            sys.exit(1)
        cmd_show(argv[1])
        return

    p = argparse.ArgumentParser(
        description="Building device scanner (cameras, RFID, services).",
        usage="scan.py <company-url> [--id ID]  |  scan.py list  |  scan.py show <id>",
    )
    p.add_argument("target", nargs="?", help="company URL or domain to scan")
    p.add_argument("--id", help="building id to cache under (defaults to the domain)")
    args = p.parse_args()

    if not args.target:
        p.print_help()
        sys.exit(1)

    domain = normalise_domain(args.target)
    if not domain:
        print(f"Could not parse a domain from {args.target!r}", file=sys.stderr)
        sys.exit(1)

    try:
        result = asyncio.run(scan(domain))
    except ScanError as e:
        print(f"[!] {e}", file=sys.stderr)
        sys.exit(e.exit_code)
    building_id = (args.id or domain).strip().lower()
    save_to_index(building_id, result)
    print_devices(result)
    print(
        f"\n[+] Cached as '{building_id}'. Reprint with: python scan.py show {building_id}"
    )


if __name__ == "__main__":
    main()
