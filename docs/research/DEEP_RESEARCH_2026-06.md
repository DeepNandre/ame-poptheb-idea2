# Deep Research — Wedge, Moat & the Insurance Tension

> **Date:** 2026-06-08 · **Scope:** UK-focused · **Method:** 5 parallel web-research agents, adversarial flagging, cross-corroboration.
> **The asset under analysis:** a vertical-agnostic public-data intelligence engine — drop a pin on a building → it fuses UK property/building public records (planning, Land Registry ownership, EPC, flood/crime) + corporate OSINT (subdomains, employees, exposed infra) + optional on-site passive recon (WiFi/Bluetooth, CCTV/RTSP) + 3D schematics, queried in natural language. **The differentiator: it outputs raw sourced evidence (a source-stamped dossier), not rated scores. The non-commoditized core: the OSINT → real-world building/entity JOIN.**

**Source flags used throughout:** `[INDEPENDENT]` = government / regulator / trade body · `[VENDOR]` = a firm selling a related service · `[SECONDARY]` = press / analyst / reseller.

**Honesty caveat on method:** several primary sites (gov.uk, legislation.gov.uk, IBISWorld, vendor pricing pages) returned HTTP 403 to the automated fetcher. Figures below come from search-result extracts that quote those primary pages; every primary URL is given for human verification. Treat single-vendor market-sizing numbers as marketing-grade; lead with the independent/government figures.

---

## TL;DR — the three paths ranked against the quarter goal

Quarter goal = **first paying customer / LOI by validating ONE wedge with 5–10 real buyers.**

| Rank | Path | Why | Fastest-cash verdict |
|---|---|---|---|
| **1** | **UK EDD / asset-tracing wedge** | One budget holder per matter (partner/GC/MLRO/investigations lead), per-report ROI is obvious, the product *is* the job, demand is regulator-driven and rising. You displace **£550–£3,000+** of manual labour per report built over **5–9 days**. | **Best wedge.** 5–10 buyers are individually reachable; per-matter sale needs no accreditation. |
| **2** | **Bolttech / physical-security insurance (the live LOI)** | It's *signed* (£60k LOI evidence in repo). Physical security has **no incumbent "security-posture rating"** to fight — unlike cyber. But insurance buys on *loss-ratio proof*, and that takes a book + time. | **Bank it, don't expand on it yet.** Genuine wedge, slow second engine. |
| **3** | **Cyber-insurance / score-buying verticals** | The rating layer is already owned (BitSight in 7 of 10 top cyber carriers); the best buyers (Coalition, At-Bay, Corvus, Cowbell) vertically integrated and self-built their scanning. | **Avoid for now.** The strategy's "avoid score-buyers" call **survives** — but only for *cyber*, not all insurance. |

**The strategic punchline:** the original "avoid insurance" call was **half right**. It correctly identifies that you can't sell raw evidence into *cyber* insurance (incumbents own the rating). It's **wrong to extend that to the Bolttech physical-security deal**, because physical security has no rating incumbent. So: lead with EDD for cash this quarter; keep Bolttech as the proof-of-loss-ratio long game; stay out of cyber-insurance scoring.

---

## AREA 1 — The Winning Wedge: UK Enhanced Due Diligence & Asset Tracing

### 1a. Market size (lead with independent; treat analyst sizing skeptically)

The cleanest UK anchor and the best global proxy:

| Claim | Figure | Flag | Source |
|---|---|---|---|
| UK Investigation Services industry | **≈ £1.2bn (2026)**, ~7,800 firms, low-single-digit growth | [SECONDARY] (IBISWorld, paywalled) | ibisworld.com/united-kingdom/industry/investigation-services/200308 |
| Global corporate-investigation services | **$4.8bn (2025) → $9.1bn (2034), 7.4% CAGR**; Europe ≈ 27.6% | [SECONDARY] (Dataintelo) | dataintelo.com/report/global-corporate-investigation-services-market |
| Global due-diligence services | $8.4bn (2025) → $16.2bn (2034), ~7.6% CAGR | [SECONDARY] | dataintelo.com/report/global-due-diligence-services-market |
| Global customer due diligence (CDD) services | $3.39bn (2025) → $4.89bn (2029), ~10% CAGR | [SECONDARY] (TBRC) | einpresswire.com/article/845036639 |

> **Skeptic's note:** analyst market-sizes diverge wildly and are all vendor reports — do not over-rely. The **demand evidence below (independent/government) is the defensible pitch material**, not the TAM decks. The broad "$400bn investigation & security services" figure was **discarded** as too broad/internally inconsistent.

### 1b. The unit economics you displace (this is the wedge's whole argument)

| Claim | Figure | Flag | Source |
|---|---|---|---|
| UK asset-trace report tiers | Basic address trace **£75**; Level-3 detailed asset search **£550**; Level-4 personal-credit report **£1,500** | [VENDOR] | tremark.co.uk/how-much-do-private-investigators-cost |
| Per-report DD / background range | **$150 (basic) → $3,000+ (global EDD)** | [VENDOR] | businessscreen.com/resources |
| EDD report turnaround | **5–9 business days** (Standard 5–7, Enhanced 7–9) | [VENDOR] | neotas.com/enhanced-due-diligence |
| UK PI / analyst rates | £30–£95/hr (corporate £60–95/hr); advisory firms $250–800/hr | [VENDOR]/[SECONDARY] | tremark.co.uk · ogscapital.com |

**Displacement summary:** a manual UK EDD/integrity report ≈ **£550–£3,000+**, **5–9 working days**, dominated by human research time. That labour is exactly what a source-stamped automated dossier collapses. *(Caveat: the "8–20 analyst-hours/report" is an inference from price ÷ rate, not an independently sourced datum — don't present it as fact.)*

### 1c. Who buys (named categories + firms)

Confirmed buyer channels for outside-in dossiers: **PE/VC & hedge funds** (pre-investment), **corporate M&A teams**, **law firms** (litigation, fraud recovery, contentious insolvency, IP), **litigation funders** (asset recovery), **banks' AML/KYC/financial-crime teams**, **boards & GCs** (internal investigations), **HNWIs** (incl. divorce-finance).

Firms that *sell* these reports today (your "displace-the-labour" comparables / potential channel partners): **Kroll, K2 Integrity, Control Risks, FTI Consulting, S-RM, Mintz Group, Deloitte/Big Four**, plus data platforms (**Sayari, LSEG/Refinitiv, Neotas, Diligencia, RDC**).

- S-RM sells pre-transaction DD to "the world's largest PE houses, corporate/M&A teams, financial institutions, banks and governments." [VENDOR] s-rminform.com/due-diligence
- FTI sells investigations to "boards, executive management, in-house counsel and their outside legal advisors." [VENDOR] fticonsulting.com
- Litigation-funder channel is real & funded: Mishcon de Reya × Harbour **$200m** JV targeting "asset recoveries, complex fraud and IP disputes." [SECONDARY] Chambers
- **Discarded:** a snippet claiming "K2 Integrity $4.19bn revenue" — garbled/false; K2 is a sub-£200m boutique.

### 1d. Demand drivers — the regulatory tailwind (the strongest, most independent evidence)

| Driver | What it forces | Effective date | Flag |
|---|---|---|---|
| **ECCTA "failure to prevent fraud"** offence | Large orgs (2 of 3: >250 staff / >£36m turnover / >£18m assets) must run **due diligence on associated persons** or face unlimited fine; strict liability | **In force 1 Sept 2025** | [SECONDARY]/[INDEPENDENT Home Office guidance] |
| **Companies House mandatory IDV** (ECCTA) | Identity verification for directors & PSCs; ACSP regime | **18 Nov 2025**; filer IDV compulsory **spring 2026** | [SECONDARY] |
| **Money Laundering Regs 2017 reg.33/35** | Mandatory **EDD** for high-risk third countries, PEPs, complex transactions; FATF-list dynamic since SI 2024/69 | ongoing | [INDEPENDENT] legislation.gov.uk |
| **Register of Overseas Entities** | Overseas owners of UK property must declare beneficial owners; ~15% non-compliant; penalties £10k–£50k/property | live, enforcement ramping | [INDEPENDENT]/[SECONDARY] |
| **OFSI sanctions enforcement** | £37bn assets reported frozen (£22.5bn Russia regime 2024-25); 57 enforcement actions | 2024-25 | [INDEPENDENT] OFSI Annual Review |

**Scale of the pain (independent — use these in every pitch):**
- **>£100bn/yr** laundered through/within the UK; ~£12bn generated domestically. [INDEPENDENT] NCA
- **£14.4bn/yr** total economic & social cost of fraud (E&W). [INDEPENDENT] Home Office
- **£38.3bn/yr** UK financial-crime compliance spend (+33% since 2021); UK firms spend **£21,400/hour** on screening. [SECONDARY] LexisNexis × Oxford Economics
- **£2.2bn** UK litigation-funding pool (10× in a decade) — the engine behind asset-tracing/fraud-recovery demand. [SECONDARY citing Civil Justice Council]
- UK fraud litigation = **~12% of judgments** (up from ~6% in 2014). [SECONDARY] Solomonic

### 1e. How it's bought (procurement)

Two motions:
1. **Per-matter** bespoke dossiers — owned by the **partner / GC / investigations lead / MLRO** who owns the matter; **low-thousands £** typical, complex multi-jurisdiction tracing open-ended. *This is your fast wedge — one human, one budget, one yes.*
2. **Annual enterprise subscriptions** to data platforms (Sayari/LSEG/RDC) — bought centrally by compliance/MLRO, per-seat/API-credit. *Slower, but the expansion path.*

> **Why this wins the quarter:** per-matter buyers can say yes alone, the ROI is a same-day £550–£3,000 labour comparison, and the regulatory clock (failure-to-prevent-fraud live, IDV mandatory) is forcing the work *now*. No accreditation needed to sell a report.

---

## AREA 2 — Competitive Landscape & Moat

### 2a. The four silos (and the fact that nobody joins them)

The capability you're building — **(corporate ownership/OSINT) × (a specific building) × (that building's physical/CCTV/wireless footprint)** — does not exist as a single product. It's fragmented across four disconnected silos:

| Silo | Best-in-class | What it does | Where it stops |
|---|---|---|---|
| **OSINT / link analysis** | Maltego ($6,600/yr Pro), Skopenow (~$22k/yr), ShadowDragon, Fivecast, Babel Street | Digital footprint, identity & network mapping | No building/CCTV/wireless tie (Maltego can *manually* chain Shodan+WiGLE+geocoding — DIY, not productized) |
| **Entity resolution / ownership** | Sayari (500M+ entities), Moody's Orbis (625M+), D&B, LexisNexis, OpenCorporates (£2.25k–£12k/yr), Companies House (free) | Beneficial-ownership chains, corporate networks | Address-level only; Sayari geolocates to *jurisdiction/facility*, never a building's footprint |
| **Attack-surface scanners** | Shodan ($49–69 one-time+), Censys, BitSight, SecurityScorecard | Internet-exposed devices, cameras, certs, ratings | IP/city-rough geolocation; no parcel entry point; not tied to ownership |
| **Property / ownership → building** | Searchland (£195/mo+), LandTech, Nimbus, CoStar, Land Registry (CCOD/OCOD free) | Parcel → company → directors/contacts | Stops dead at identity; **zero** corporate-OSINT/exposed-infra |

### 2b. The nearest approximations (and why they're not you)

- **Babel Street Locate X** — ad-ID bid-stream → a *person's* location to within meters. Strongest "digital → exact place" join in the market, but it tracks **people, not buildings**, isn't joined to corporate ownership, and is legally radioactive. [INDEPENDENT] 404 Media / EFF / Krebs
- **Liferaft Navigator** (acquired by **Securitas, Feb 2026**) — geofences online threats around **your own** mapped facilities. Closest protective-intelligence convergence, but **inward-facing** and threat-centric, not a building-footprint profiler. [INDEPENDENT/SECONDARY]
- **Maltego** — the only analyst-configurable path that can chain Shodan + WiGLE + Google geocoding + "same-building" address merging. **Manual DIY assembly, not a turnkey join.** [VENDOR]
- **Sayari** — joins ownership networks to facility addresses/jurisdictions for supply-chain risk; stops before the physical footprint. [VENDOR]

### 2c. Independent confirmation from the property side

A separate research pass on UK property tools reached the same conclusion from the opposite direction: **property platforms reach corporate/personal identity and stop.** Searchland resolves a parcel → Ultimate Parent Company → named directors + their other appointments; LandTech adds in-app skip tracing; Nimbus exports a company's entire estate; CoStar Tenants surfaces occupier + key contacts. **None ingest domains, IPs, certificates, or exposed devices.** The bridge is structurally available (UPRN → title/polygon → corporate proprietor [CCOD/OCOD, free] → Companies House officers → company domain → OSINT scan) but **unbuilt**. [INDEPENDENT Land Registry / VENDOR]

### 2d. Where the moat IS and IS NOT

**NOT a moat (commoditized — don't claim these as differentiation):**
- Social/digital-footprint investigation & link analysis (many overlapping vendors).
- Corporate registry / beneficial-ownership data (Sayari, Orbis, D&B, OpenCorporates, Companies House) — differentiation is now coverage & resolution quality.
- Internet attack-surface scanning & security ratings (Shodan/Censys; BitSight/SecurityScorecard duopoly).

**THE moat (rare-to-nonexistent):**
- A **productized join of corporate-ownership/OSINT data to a specific physical building AND that building's physical/CCTV/wireless/access-control footprint.** No vendor does this end-to-end; it still lives in manual red-team tradecraft. Liferaft/Securitas and Maltego's transform chain are the nearest approximations — leaving clear white-space.

**Two corrections to internal assumptions:**
- Land Registry Title Register is now **£7, not ~£3** (rose 9 Dec 2024). Update the German Shepherd ROI doc's data-layer table.
- "RealCadastre" could **not be verified** as a live UK platform (Lightbox parcel data is US-only).

> **Moat caveat (be honest with yourself):** the *join* is the moat, but the inputs are public. The defensibility is in (a) the productized, source-stamped chaining no one else sells, (b) the on-site passive recon layer (your biggest legal liability *and* your hardest-to-copy data), and (c) accumulated entity-resolution quality over time. A well-funded incumbent (Sayari, Maltego, a property platform) *could* build the join — your lead is execution + first-mover proof, not a patent.

---

## AREA 3 — The Insurance-MGA Tension (addressed head-on)

**The contradiction:** the strategy says "avoid people who buy scores (insurance/lending/CRE) — incumbents own the rating." Yet you hold a **signed £60k Bolttech physical-security LOI**. Which is right?

### 3a. Cyber insurance — the strategy's "avoid" call is CORRECT here

- The best outside-in buyers **vertically integrated and self-built** their scanning: Coalition (73% fewer claims; ~7% YoY frequency drop), At-Bay (up to 5× less ransomware), Corvus (acquired by Travelers for ~$435m *for* its scanning IP), Cowbell (proprietary "Cowbell Factors", though it *also* blends in FICO's score). [VENDOR/SECONDARY] These motivated buyers **don't buy a third party's raw evidence — they own the rating as core IP tied to loss ratios.**
- The score layer is concentrated: **"7 of the 10 largest cyber insurers use BitSight";** SecurityScorecard partners with Willis. [VENDOR] **The rating is owned.**
- Barriers are hardening: Lloyd's HITRUST consortium (accredited, standardized evidence pipes), DORA third-party-data governance, model-validation/false-positive-attribution liability. A new unaccredited evidence feed is disadvantaged. [VENDOR/SECONDARY]

→ **A raw-evidence startup faces a hard wedge in cyber. The "avoid" call stands.**

### 3b. Physical security — the strategy's call DOES NOT extend here

- There is **no BitSight-equivalent "physical-security posture rating"** licensed by carriers. The standard framework is **COPE** (Construction, Occupancy, Protection, Exposure) — and "Protection" is still **stale, inspection-driven attribute data**, not a continuously-scored outside-in rating. [VENDOR]
- Carriers already pay for **outside-in property data** (Nearmap/Betterview aerial CV, LexisNexis Flyreel, Guidewire HazardHub) — the *behaviour* of buying external data is normalized; it just hasn't been applied to security posture. [VENDOR]
- The loss pool is real: UK insurers paid **£1.6bn property claims in Q2 2025** (+7%); **8% of premises burgled** (2023 CVS); 245,284 burglaries recorded YE March 2025. [INDEPENDENT] ABI / Home Office / ONS

→ **In physical security there is no rating incumbent to fight.** That's precisely the gap German Shepherd/Bolttech sits in. The "avoid insurance" rule was over-generalized from cyber.

### 3c. The market is large and MGA-friendly

- UK MGAs write **>£13.2bn GWP** across 233 agencies (MGAA) — fastest-growing P&C segment; 57% of carriers plan to increase MGA capacity. [INDEPENDENT] MGAA
- Lloyd's: **>33% of premium** flows through delegated authority. [INDEPENDENT] Lloyd's
- Global cyber GWP **~$15–17bn (2025)**, ~10%+ CAGR, possibly $30–50bn by 2030. [SECONDARY citing reinsurers] — large, but per 3a, not your wedge as an evidence seller.

### 3d. Verdict: genuine wedge or distraction?

**Bolttech is a genuine wedge — but a *second engine*, not the quarter's sprint.** Reasoning:
- ✅ It's signed and physical-security has no rating incumbent → the structural objection doesn't apply.
- ✅ It hands you a marquee logo + distribution into 230+ insurers + reseller margin.
- ⚠️ But insurance ultimately buys on **proven loss-ratio impact**, which requires a book and 12+ months — the way Coalition had to *prove* its 73%. You can't validate "5–10 buyers will pay" fastest through insurers.
- ⚠️ Don't let it pull you into **cyber-insurance scoring** (3a) — that's where the strategy's warning genuinely bites.

> **Reconcile it like this in STRATEGY.md:** "Avoid *score-buying* verticals where an incumbent owns the rating (cyber-insurance, lending, CRE valuation). Physical-security insurance is the exception — no rating incumbent exists — so Bolttech is a valid *parallel* bet, run as a loss-ratio proof over 12 months, not as the primary cash wedge this quarter."

---

## Synthesis & concrete next actions

**Ranking against "first paying customer / LOI from 5–10 real buyers, this quarter":**

1. **EDD / asset-tracing (primary sprint).** Per-matter buyer, single budget holder, instant ROI story (£550–£3,000 + 5–9 days of labour you erase), regulatory clock forcing the work now, **no accreditation barrier**. The OSINT→building/entity join is genuinely non-commoditized and *is the job* for asset-tracing.
2. **Bolttech / physical-security insurance (parallel, bank the signed deal).** Real, no rating incumbent, marquee distribution — but loss-ratio proof is a 12-month game, not a quarter sprint.
3. **Cyber-insurance / score verticals (avoid).** Rating owned by incumbents; best buyers self-build. Strategy's warning holds *here specifically*.

**Concrete next actions:**
1. **Pick the EDD sub-wedge.** Of the buyer channels, **asset-tracing / fraud-recovery boutiques + litigation funders** are the sharpest: the OSINT→building/entity join *is* their deliverable, ROI is per-report, and the £2.2bn funding pool + 12%-of-judgments fraud-litigation trend means budget exists. Target these before bank AML (longer procurement) or PE (subscription motion).
2. **Build the discovery list (5–10 real buyers).** Boutiques + funders to approach: asset-recovery practices, contentious-insolvency teams, the Mishcon/Harbour-style funded fraud shops, mid-tier investigations firms (S-RM tier and below). I can draft this list + a discovery script next.
3. **Frame the pitch on the displacement math, not TAM.** "Your analyst spends 5–9 days and £550–£3,000 building this dossier by hand; we deliver the same source-stamped evidence in minutes, and we add the one thing no tool gives you — the building→company→exposed-infrastructure join." Lead with independent numbers (NCA £100bn, £38.3bn compliance spend, failure-to-prevent-fraud live).
4. **Fix the two factual errors** in the German Shepherd ROI doc: Land Registry Title Register is **£7 not £3**; drop/relabel "RealCadastre."
5. **Reconcile STRATEGY.md** with the cyber-vs-physical distinction in 3d so the Bolttech deal and the "avoid insurance" rule stop contradicting each other.
6. **Validation success metric (unchanged):** a buyer says "I'd pay £X because nothing I use shows me the building→entity→infrastructure join," and signs a pilot/LOI.

---

### Appendix — figures deliberately discarded or flagged shaky
- ❌ "K2 Integrity $4.19bn revenue" — garbled/false (boutique, sub-£200m).
- ❌ "$400bn+ investigation & security services market" — too broad, internally inconsistent, not an EDD proxy.
- ⚠️ "8–20 analyst-hours per EDD report" — inference from price ÷ rate, not independently sourced.
- ⚠️ All analyst TAM numbers — vendor reports, mutually inconsistent; use only as directional colour.
- ⚠️ Vendor pricing (Skopenow ~$22k, Maltego ~$6.6k, OpenCorporates £2.25k–12k) — from reseller/listing sites; verify with vendors before relying.
- ⚠️ OFSI "frozen assets" varies by definition/date: £22.5bn (Russia regime 2024-25) vs £28.7bn (cumulative since Feb 2022) vs ~£37bn (all regimes reported) — always state which.
