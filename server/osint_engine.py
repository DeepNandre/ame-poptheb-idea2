#!/usr/bin/env python3
"""
osint_engine.py — Corporate OSINT / Social Engineering discovery for Building Scanner.

PHASE 1 (this file):
  Given a company name (and optionally a building address or explicit domain),
  run the best available OSINT sources and emit a single clean JSON object.

Sources (tried in priority order; honest empty state when a source is missing):
  1. Subfinder (CLI)             → subdomains
  2. theHarvester (CLI)          → employees (name + email)
  3. Shodan + Censys (API keys)  → exposed_devices (IPs, ports, services)
  4. Lightweight Wappalyzer      → tech_stack (homepage signature scan + optional CLI)

Design goals:
  - REAL DATA ONLY. No mock/demo data is ever injected. When a tool or key is
    missing, that source returns an empty array plus a note in "notes" saying why.
  - Always returns valid JSON in < 30s even with zero tools installed.
  - Real tools (when present) are used automatically via subprocess / direct REST.
  - No heavy Python dependencies. Uses stdlib + urllib; optional "requests" helps.

Usage (standalone):
  python3 server/osint_engine.py --company "Acme Corp" --address "123 Main St"
  python3 server/osint_engine.py --company "Example Ltd" --domain example.com --pretty

Environment variables for real APIs:
  SHODAN_API_KEY=...        # Shodan REST search (works on free tier)
  CENSYS_API_TOKEN=...      # Censys Platform Personal Access Token (Bearer)
  CENSYS_ORG_ID=...         # required for Censys Platform API access (paid plans)
  CENSYS_API_ID=...         # legacy classic Search API (optional fallback)
  CENSYS_API_SECRET=...

Later (Phase 2/3) this will be called from the Node server or frontend command bar
and its output will be correlated against live Bluetooth/WiFi scan data.
"""

import argparse
import json
import logging
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cameradar_engine import discover_cctv, extract_ip_range, scan_cameras

# ──────────────────────────────────────────────────────────────────────────────
# Logging (to stderr, like scanner.py). JSON only ever goes to stdout.
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [osint] %(levelname)s %(message)s",
)
logger = logging.getLogger("osint_engine")

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def log(msg: str):
    logger.info(msg)

def warn(msg: str):
    logger.warning(msg)

def err(msg: str):
    logger.error(msg)

# ──────────────────────────────────────────────────────────────────────────────
# Output schema helpers
# ──────────────────────────────────────────────────────────────────────────────

def make_empty_result(company: str, building: str, company_domain: str) -> Dict[str, Any]:
    return {
        "company": company,
        "building": building,
        "company_domain": company_domain,
        "subdomains": [],
        "employees": [],
        "exposed_devices": [],
        "tech_stack": [],
        "device_fingerprints": [],
        "cctv_cameras": [],
        "cctv_scan": {
            "building_ip_range": "",
            "total_cameras": 0,
            "source": None,
        },
        "mocked": False,
        "notes": [],
        "generated_at": _now(),
    }

def add_note(result: Dict[str, Any], note: str):
    if note not in result["notes"]:
        result["notes"].append(note)

# ──────────────────────────────────────────────────────────────────────────────
# Domain inference (very lightweight)
# ──────────────────────────────────────────────────────────────────────────────

def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s

# Browser-like UA — some public endpoints (crt.sh, Clearbit) reject the default.
_HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; BuildingScanner/1.0)"}

def _get_json(url: str, timeout: int = 20):
    req = urlrequest.Request(url, headers=_HTTP_HEADERS)
    with urlrequest.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))

_DOMAIN_RE = re.compile(r"^(?:https?://)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)", re.I)

def clean_domain(value: str) -> Optional[str]:
    """Extract a bare registrable domain from a URL/domain-ish string, else None."""
    if not value:
        return None
    m = _DOMAIN_RE.match(value.strip().lower())
    return m.group(1) if m else None

def resolve_company_domain(company: str) -> Optional[str]:
    """Company name -> primary domain via Clearbit's free autocomplete API."""
    try:
        url = "https://autocomplete.clearbit.com/v1/companies/suggest?" + urlencode({"query": company})
        data = _get_json(url, timeout=8)
        if isinstance(data, list) and data:
            dom = (data[0] or {}).get("domain")
            if dom:
                return dom.lower().strip()
    except Exception as e:
        warn(f"Clearbit lookup failed: {e}")
    return None

def infer_domain(company: str, explicit: Optional[str] = None) -> str:
    # 1. Explicit domain wins (strip scheme/www/path).
    if explicit:
        return clean_domain(explicit) or explicit.lower().strip()
    # 2. If the company field is itself a domain/URL, use it directly.
    as_domain = clean_domain(company)
    if as_domain:
        return as_domain
    # 3. Resolve the company NAME to a real domain (Clearbit, free, no key).
    resolved = resolve_company_domain(company)
    if resolved:
        log(f"Resolved {company!r} -> {resolved} via Clearbit")
        return resolved
    # 4. Last resort: naive slug + .com.
    base = slugify(company) or "example"
    return f"{base}.com"

# ──────────────────────────────────────────────────────────────────────────────
# 1. Subdomains via subfinder (CLI)
# ──────────────────────────────────────────────────────────────────────────────

def _raw_crtsh(domain: str, timeout: int = 15) -> Tuple[set, Optional[str]]:
    """Certificate Transparency logs (crt.sh). Retried — crt.sh 502s often."""
    out: set = set()
    url = "https://crt.sh/?" + urlencode({"q": f"%.{domain}", "output": "json"})
    last = None
    for _ in range(2):
        try:
            data = _get_json(url, timeout=timeout)
            for row in data if isinstance(data, list) else []:
                for field in ("name_value", "common_name"):
                    for n in str(row.get(field) or "").split("\n"):
                        out.add(n)
            return out, None
        except Exception as e:
            last = e
    return out, f"crt.sh unavailable ({last})"

def _raw_hackertarget(domain: str, timeout: int = 12) -> Tuple[set, Optional[str]]:
    """HackerTarget hostsearch — CSV 'host,ip'. Free, ~daily rate-limited."""
    out: set = set()
    try:
        url = "https://api.hackertarget.com/hostsearch/?" + urlencode({"q": domain})
        req = urlrequest.Request(url, headers=_HTTP_HEADERS)
        with urlrequest.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", "replace")
        if "API count exceeded" in text or "error check your search" in text.lower():
            return out, "HackerTarget rate-limited"
        for line in text.splitlines():
            host = line.split(",")[0].strip()
            if host:
                out.add(host)
        return out, None
    except Exception as e:
        return out, f"HackerTarget failed ({e})"

def _raw_otx(domain: str, timeout: int = 12) -> Tuple[set, Optional[str]]:
    """AlienVault OTX passive DNS — free, no key."""
    out: set = set()
    try:
        url = f"https://otx.alienvault.com/api/v1/indicators/domain/{domain}/passive_dns"
        data = _get_json(url, timeout=timeout)
        for rec in (data.get("passive_dns", []) if isinstance(data, dict) else []):
            h = (rec.get("hostname") or "").strip()
            if h:
                out.add(h)
        return out, None
    except Exception as e:
        return out, f"OTX failed ({e})"

def discover_subdomains(domain: str, timeout: int = 25) -> Tuple[List[str], List[str]]:
    """Resilient subdomain discovery from multiple FREE public-records sources
    (certificate transparency + passive DNS), merged and deduped. No API key
    needed; if one source is down the others still return data."""
    subs: set = set()
    notes: List[str] = []
    suffix = "." + domain

    for label, fn in (
        ("crt.sh", _raw_crtsh),
        ("HackerTarget", _raw_hackertarget),
        ("AlienVault OTX", _raw_otx),
    ):
        raw, err = fn(domain)
        if err:
            notes.append(err)
        clean = {
            s.strip().lower().lstrip("*.")
            for s in raw
        }
        clean = {s for s in clean if s and "@" not in s and (s == domain or s.endswith(suffix))}
        new = len(clean - subs)
        subs.update(clean)
        if clean:
            notes.append(f"{label}: {len(clean)} names (+{new} new)")

    # Optional subfinder CLI — merge extra passive-DNS sources if installed.
    try:
        proc = subprocess.run(
            ["subfinder", "-d", domain, "-silent", "-timeout", "8"],
            capture_output=True, text=True, timeout=45,
        )
        if proc.returncode == 0:
            extra = {l.strip().lower() for l in proc.stdout.splitlines() if l.strip()}
            new = extra - subs
            subs.update(extra)
            if new:
                notes.append(f"subfinder: +{len(new)} additional")
    except FileNotFoundError:
        pass
    except Exception:
        pass

    return sorted(subs), notes

# ──────────────────────────────────────────────────────────────────────────────
# 2. theHarvester — emails + contacts
# ──────────────────────────────────────────────────────────────────────────────

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
NAME_FROM_EMAIL_RE = re.compile(r"^([A-Za-z]+)[._-]?([A-Za-z]+)?@")

def parse_theharvester_output(text: str) -> List[Dict[str, str]]:
    employees: List[Dict[str, str]] = []
    seen = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("[*]") or line.startswith("[-]"):
            continue
        for email in EMAIL_RE.findall(line):
            if email in seen:
                continue
            seen.add(email)
            m = NAME_FROM_EMAIL_RE.match(email)
            name = ""
            if m:
                first = m.group(1).capitalize()
                last = (m.group(2) or "").capitalize()
                name = f"{first} {last}".strip()
            # Try to pull a title-ish hint if present on the same line
            title = ""
            if " - " in line:
                parts = line.split(" - ", 1)
                if len(parts) > 1:
                    title = parts[1].strip()[:60]
            employees.append({
                "name": name or email.split("@")[0].replace(".", " ").title(),
                "email": email,
                "title": title or "Employee",
            })
    return employees

# Curated keyless theHarvester sources. "-b all" pulls dozens of sources, many
# of which need API keys or hang — this set is free, reliable, and yields emails
# (search engines) plus hosts.
THEHARVESTER_SOURCES = "bing,duckduckgo,brave,yahoo,crtsh,otx,rapiddns,urlscan,hackertarget"

def harvest_contacts(domain: str, timeout: int = 60) -> Tuple[List[Dict[str, str]], List[str]]:
    notes: List[str] = []
    for cmd in ("theHarvester", "theharvester"):
        try:
            proc = subprocess.run(
                [cmd, "-d", domain, "-b", THEHARVESTER_SOURCES],
                capture_output=True, text=True, timeout=timeout,
            )
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            notes.append("theHarvester timed out")
            return [], notes
        except Exception as e:
            notes.append(f"theHarvester failed: {e}")
            return [], notes
        emps = parse_theharvester_output(proc.stdout or "")
        # Keep only emails on the target domain — drops theHarvester's own banner
        # credit (cmartorella@edge-security.com) and unrelated noise.
        suffix = "@" + domain.lower()
        emps = [e for e in emps if str(e.get("email", "")).lower().endswith(suffix)]
        if not emps:
            notes.append("theHarvester ran — no public emails found for this domain")
        return emps, notes
    notes.append("theHarvester not found in PATH — employee harvesting skipped")
    return [], notes

# ──────────────────────────────────────────────────────────────────────────────
# 3. Shodan + Censys — exposed infrastructure
# ──────────────────────────────────────────────────────────────────────────────

def shodan_search(org: str, api_key: str, limit: int = 8) -> List[Dict[str, Any]]:
    # Use Shodan REST search (no extra deps)
    q = f'org:"{org}"'
    url = "https://api.shodan.io/shodan/host/search?" + urlencode({"key": api_key, "query": q, "limit": limit})
    try:
        with urlrequest.urlopen(url, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))
        devices = []
        for m in data.get("matches", [])[:limit]:
            devices.append({
                "ip": m.get("ip_str"),
                "port": m.get("port"),
                "service": m.get("product") or m.get("os") or m.get("_shodan", {}).get("module", "unknown"),
                "location": m.get("location", {}).get("city") or "unknown",
                "org": org,
            })
        return devices
    except Exception as e:
        warn(f"Shodan query failed: {e}")
        return []

def _parse_censys_hits(hits: List[Dict[str, Any]], org: str, limit: int) -> List[Dict[str, Any]]:
    devices: List[Dict[str, Any]] = []
    for hit in hits[:limit]:
        ip = hit.get("ip")
        location = (hit.get("location") or {}).get("city") or "unknown"
        services = hit.get("services") or []
        if not services:
            devices.append({"ip": ip, "port": None, "service": "unknown", "location": location, "org": org})
            continue
        for s in services[:3]:
            software = s.get("software") or [{}]
            service = s.get("service_name") or (software[0].get("product") if software else None) or "unknown"
            devices.append({"ip": ip, "port": s.get("port"), "service": service, "location": location, "org": org})
    return devices


def censys_search(
    org: str,
    token: str = "",
    org_id: str = "",
    api_id: str = "",
    api_secret: str = "",
    limit: int = 8,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Search Censys for hosts belonging to an organization.

    Returns (devices, note). `note` is None on clean success, otherwise a precise,
    user-facing reason it found nothing (so the UI never says "no results" when
    the real cause is auth or plan limits).

    - Modern: Censys Platform API. Needs a Personal Access Token (Bearer) AND a
      CENSYS_ORG_ID. Free-tier tokens cannot use the search API at all (UI only).
    - Legacy: classic Search API v2 with API ID + Secret (Basic auth).
    """
    # ── Modern Censys Platform API (token + org id) ──────────────────────────
    if token:
        if not org_id:
            return [], (
                "Censys skipped — set CENSYS_ORG_ID to query the Platform API. "
                "Free-tier Personal Access Tokens are UI-only; exposures shown are from Shodan."
            )
        url = "https://api.platform.censys.io/v3/global/search/query"
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Organization-ID": org_id,
            "Content-Type": "application/json",
        }
        body = json.dumps({
            "query": f'host.autonomous_system.name: "{org}"',
            "page_size": limit,
        }).encode()
        req = urlrequest.Request(url, data=body, headers=headers, method="POST")
        try:
            with urlrequest.urlopen(req, timeout=18) as resp:
                data = json.loads(resp.read().decode("utf-8", "replace"))
        except HTTPError as e:
            if e.code == 403:
                return [], "Censys skipped — token/org lacks API search access (free plans are UI-only)."
            if e.code == 401:
                return [], "Censys skipped — token rejected (401); it may be expired or invalid."
            return [], f"Censys Platform API error: HTTP {e.code}"
        except Exception as e:
            warn(f"Censys Platform query failed: {e}")
            return [], f"Censys Platform API call failed: {e}"
        result = data.get("result") or data
        hits = result.get("hits") or result.get("results") or []
        devices = _parse_censys_hits(hits, org, limit)
        return devices, (None if devices else "Censys returned no hosts for this organization.")

    # ── Legacy classic Search API v2 (API ID + Secret) ───────────────────────
    if api_id and api_secret:
        import base64
        url = "https://search.censys.io/api/v2/hosts/search"
        auth = base64.b64encode(f"{api_id}:{api_secret}".encode()).decode()
        headers = {"Content-Type": "application/json", "Authorization": f"Basic {auth}"}
        body = json.dumps({"q": f'autonomous_system.organization: "{org}"', "per_page": limit}).encode()
        req = urlrequest.Request(url, data=body, headers=headers, method="POST")
        try:
            with urlrequest.urlopen(req, timeout=18) as resp:
                data = json.loads(resp.read().decode("utf-8", "replace"))
        except HTTPError as e:
            return [], f"Censys (legacy) error: HTTP {e.code}"
        except Exception as e:
            warn(f"Censys legacy query failed: {e}")
            return [], f"Censys (legacy) call failed: {e}"
        devices = _parse_censys_hits(data.get("result", {}).get("hits", []), org, limit)
        return devices, (None if devices else "Censys (legacy) returned no results.")

    return [], None

def discover_exposed_devices(company: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    notes: List[str] = []
    devices: List[Dict[str, Any]] = []

    shodan_key = os.environ.get("SHODAN_API_KEY")
    censys_token = os.environ.get("CENSYS_API_TOKEN")
    censys_id = os.environ.get("CENSYS_API_ID")
    censys_secret = os.environ.get("CENSYS_API_SECRET")

    shodan_attempted = False
    censys_attempted = False

    if shodan_key:
        shodan_attempted = True
        log("Querying Shodan (real key present)…")
        shodan_devices = shodan_search(company, shodan_key)
        if shodan_devices:
            devices.extend(shodan_devices)
        else:
            # The call ran but returned nothing or errored inside the function
            notes.append("Shodan call completed with no results (may be rate limit, bad key, or no matches for the org string)")
    else:
        notes.append("SHODAN_API_KEY not present — Shodan skipped")

    censys_org = os.environ.get("CENSYS_ORG_ID", "")
    if censys_token or (censys_id and censys_secret):
        censys_attempted = True
        log("Querying Censys…")
        censys_devices, censys_note = censys_search(
            company,
            token=censys_token or "",
            org_id=censys_org,
            api_id=censys_id or "",
            api_secret=censys_secret or "",
        )
        if censys_devices:
            devices.extend(censys_devices)
        if censys_note:
            notes.append(censys_note)
    else:
        notes.append("No Censys token or legacy credentials present — Censys skipped")

    # Dedup by (ip,port)
    seen = set()
    unique = []
    for d in devices:
        key = (d.get("ip"), d.get("port"))
        if key not in seen:
            seen.add(key)
            unique.append(d)

    # Real-data-only: never inject demo devices. Be explicit about why it's empty.
    if not unique and not shodan_attempted and not censys_attempted:
        notes.append("No Shodan or Censys credentials configured — exposed-infrastructure scan skipped")
    elif not unique:
        notes.append("Shodan/Censys returned no exposed devices (check org name spelling, credits, or rate limits)")

    return unique, notes

# ──────────────────────────────────────────────────────────────────────────────
# 4. Tech stack — tiny built-in detector + optional wappalyzer CLI
# ──────────────────────────────────────────────────────────────────────────────

TECH_SIGNATURES = [
    (r"react", "React"),
    (r"next\.js|__next", "Next.js"),
    (r"vue", "Vue.js"),
    (r"angular", "Angular"),
    (r"node\.js|express", "Node.js / Express"),
    (r"django|flask|fastapi", "Python (Django/Flask/FastAPI)"),
    (r"rails|ruby on rails", "Ruby on Rails"),
    (r"aws|amazonaws|cloudfront", "AWS"),
    (r"cloudflare", "Cloudflare"),
    (r"vercel", "Vercel"),
    (r"postgres|postgresql", "PostgreSQL"),
    (r"mysql|mariadb", "MySQL"),
    (r"mongodb|mongo", "MongoDB"),
    (r"graphql", "GraphQL"),
    (r"tailwind", "Tailwind CSS"),
    (r"shopify", "Shopify"),
]

def detect_tech_from_html(html: str, headers: Dict[str, str]) -> List[str]:
    found = set()
    lower = (html or "").lower()
    server = headers.get("Server", "") + " " + headers.get("X-Powered-By", "")
    for pattern, name in TECH_SIGNATURES:
        if re.search(pattern, lower) or re.search(pattern, server, re.I):
            found.add(name)
    # Header heuristics
    if "x-vercel-id" in {k.lower() for k in headers}:
        found.add("Vercel")
    if any("cloudflare" in v.lower() for v in headers.values()):
        found.add("Cloudflare")
    return sorted(found)

def detect_tech_stack(domain: str) -> Tuple[List[str], List[str]]:
    notes: List[str] = []
    tech: List[str] = []

    # Try real wappalyzer CLI first if present
    for cmd in ["wappalyzer", "wappalyzer-cli"]:
        try:
            proc = subprocess.run(
                [cmd, f"https://{domain}"],
                capture_output=True, text=True, timeout=18,
            )
            if proc.returncode == 0 and proc.stdout:
                # Many CLIs output JSON array of tech names
                try:
                    data = json.loads(proc.stdout)
                    if isinstance(data, list):
                        tech = [str(x) for x in data][:12]
                        return tech, notes
                except Exception:
                    pass
                # Fallback: space separated
                tech = [t.strip() for t in proc.stdout.split() if len(t.strip()) > 1][:12]
                return tech, notes
        except FileNotFoundError:
            continue
        except Exception as e:
            notes.append(f"wappalyzer CLI error: {e}")

    # Fallback: fetch homepage and run our tiny signature engine
    url = f"https://{domain}"
    try:
        req = urlrequest.Request(url, headers={"User-Agent": "Launch-OSINT/0.1 (recon)"})
        with urlrequest.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", "replace")[:200_000]
            headers = {k: v for k, v in resp.headers.items()}
        tech = detect_tech_from_html(html, headers)
        if not tech:
            notes.append("Homepage fetched but no strong tech signatures detected")
    except (HTTPError, URLError, TimeoutError, Exception) as e:
        notes.append(f"Could not fetch https://{domain} for tech detection: {e}")
        tech = []

    if not tech:
        tech = ["Unknown / static site"]
    return tech, notes

# ──────────────────────────────────────────────────────────────────────────────
# 5. CCTV — Cameradar RTSP discovery (see cameradar_engine.py)
# ──────────────────────────────────────────────────────────────────────────────

def _run_cctv_layer(ip_range: Optional[str], use_cctv_sample: bool):
    if use_cctv_sample:
        return scan_cameras(ip_range or "sample", use_sample=True)
    return discover_cctv(ip_range)

def run_osint(
    company: str,
    address: str = "",
    explicit_domain: Optional[str] = None,
    ip_range: Optional[str] = None,
    use_cctv_sample: bool = False,
) -> Dict[str, Any]:
    t0 = time.time()
    domain = infer_domain(company, explicit_domain)
    result = make_empty_result(company or "Unknown Company", address or "Unknown Building", domain)

    if not ip_range:
        ip_range = os.environ.get("CAMERADAR_IP_RANGE") or os.environ.get("CCTV_IP_RANGE")

    log(f"Starting OSINT for {company!r} (domain guess: {domain})")
    if ip_range:
        log(f"CCTV target range: {ip_range}")

    # Run OSINT phases in parallel (CCTV may run up to CAMERADAR_TIMEOUT seconds)
    with ThreadPoolExecutor(max_workers=5) as ex:
        f_subs = ex.submit(discover_subdomains, domain)
        f_emps = ex.submit(harvest_contacts, domain)
        f_devs = ex.submit(discover_exposed_devices, company)
        f_tech = ex.submit(detect_tech_stack, domain)
        f_cctv = ex.submit(_run_cctv_layer, ip_range, use_cctv_sample)

        subs, sub_notes = f_subs.result()
        emps, emp_notes = f_emps.result()
        devs, dev_notes = f_devs.result()
        tech, tech_notes = f_tech.result()
        cctv_result, cctv_notes = f_cctv.result()

    # Merge notes
    for n in sub_notes + emp_notes + dev_notes + tech_notes + cctv_notes:
        add_note(result, n)

    # Fill result — no fake data; empty arrays when tools/keys unavailable
    result["subdomains"] = subs or []
    if not subs:
        add_note(result, "No subdomains found in certificate transparency for this domain")

    result["employees"] = emps or []
    if not emps:
        add_note(result, "No employees discovered (install theHarvester for email/name harvesting)")

    result["exposed_devices"] = devs

    result["tech_stack"] = tech or []

    result["cctv_cameras"] = cctv_result.get("cameras", [])
    result["cctv_scan"] = {
        "building_ip_range": cctv_result.get("building_ip_range", ip_range or ""),
        "total_cameras": cctv_result.get("total_cameras", len(result["cctv_cameras"])),
        "source": cctv_result.get("source"),
        "scanned_at": cctv_result.get("scanned_at"),
    }

    # Device fingerprints from real infra + tech only
    fps = set()
    for d in devs:
        svc = (d.get("service") or "").lower()
        if "ssh" in svc or "linux" in svc:
            fps.add("Linux Server")
        if "nginx" in svc or "http" in svc:
            fps.add("Web Server")
        if "cloudflare" in svc:
            fps.add("Cloudflare Edge")
    for t in tech:
        if "node" in t.lower() or "express" in t.lower():
            fps.add("Node.js Backend")
        if "postgres" in t.lower():
            fps.add("PostgreSQL Database")
        if "react" in t.lower() or "next" in t.lower():
            fps.add("Modern Web Frontend")
    result["device_fingerprints"] = sorted(fps)

    # Per-source "simulated data" tracking. The only opt-in simulated source is the
    # offline CCTV reference dataset (--use-cctv-sample). Everything else is real.
    mocked_sources: List[str] = []
    if any("sample file" in n.lower() or "reference dataset" in n.lower() for n in result["notes"]):
        mocked_sources.append("cctv")

    result["mocked_sources"] = mocked_sources
    result["mocked"] = len(mocked_sources) > 0

    log(
        f"OSINT complete in {time.time() - t0:.1f}s — mocked={result['mocked']} — "
        f"{len(result['employees'])} employees, {len(result['subdomains'])} subdomains, "
        f"{len(result['cctv_cameras'])} cameras"
    )
    return result

# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="Corporate OSINT engine for Building Scanner (Phase 1)."
    )
    p.add_argument("--company", required=True, help="Company or tenant name (e.g. 'Acme Corp')")
    p.add_argument("--address", "--building", default="", help="Building address (for context)")
    p.add_argument("--domain", default=None, help="Explicit primary domain (overrides inference)")
    p.add_argument("--ip-range", default=None, help="IP/CIDR for Cameradar CCTV scan (e.g. 192.168.1.0/24)")
    p.add_argument("--use-cctv-sample", action="store_true", help="Use server/samples/cameradar_sample.json for offline CCTV demo")
    p.add_argument("--pretty", action="store_true", help="Pretty-print the JSON")
    args = p.parse_args()

    ip_range = args.ip_range or os.environ.get("CAMERADAR_IP_RANGE") or os.environ.get("CCTV_IP_RANGE")
    result = run_osint(
        company=args.company,
        address=args.address,
        explicit_domain=args.domain,
        ip_range=ip_range,
        use_cctv_sample=args.use_cctv_sample,
    )

    json_str = json.dumps(result, indent=2 if args.pretty else None, sort_keys=False)
    # Single JSON blob to stdout — exactly like the scanner emits lines
    print(json_str)

if __name__ == "__main__":
    main()
