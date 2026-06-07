// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE PACK — single source of truth for the /validate dashboard.
//
// TEAMMATES: edit THIS file to add evidence. The dashboard renders from it.
// Rules that keep us judge-safe (Validate track):
//   1. Every claim must trace to a DATED, independently checkable source.
//   2. Never invent numbers. If you don't have it yet, add it to `pendingEvidence`
//      with status "pending" — honesty scores; fabrication is a disqualification.
//   3. status: "verified"  = a judge can check the source today.
//      status: "pending"   = we have it but it isn't wired up / public yet.
//      status: "self"      = our own log/claim, not yet third-party verifiable.
// ─────────────────────────────────────────────────────────────────────────────

export type Status = "verified" | "pending" | "self";

export interface Source {
  label: string; // e.g. "Bolttech LOI (GS-LOI-2026-001)"
  href?: string; // link a judge can open
  dated?: string; // ISO date the source is from, e.g. "2026-06-06"
}

export interface Kpi {
  value: string;
  label: string;
  sub?: string;
  status: Status;
  source?: Source;
}

export interface Claim {
  id: string;
  claim: string;
  evidence: string;
  source: Source;
  verify: string; // how a third party reproduces / checks this
  status: Status;
}

// ── The one thing we are proving ─────────────────────────────────────────────
export const thesis = {
  kicker: "Validation evidence pack",
  headline: "German Shepherd has real, paid commercial demand from the insurance market.",
  sub: "Every claim below traces to a dated, independently checkable source. This page is the proof, not the pitch.",
  asOf: "2026-06-07",
};

// ── Headline metrics ─────────────────────────────────────────────────────────
export const kpis: Kpi[] = [
  {
    value: "£20,000",
    label: "Pilot value committed",
    sub: "Bolttech, 12-month platform access + 1 free month",
    status: "verified",
    source: { label: "Bolttech LOI · GS-LOI-2026-001", href: "/evidence/bolttech-loi.pdf", dated: "2026-06-06" },
  },
  {
    value: "1",
    label: "Signed Letter of Intent",
    sub: "Named signatory, regional GM / Chief Growth Officer",
    status: "verified",
    source: { label: "Bolttech LOI · GS-LOI-2026-001", href: "/evidence/bolttech-loi.pdf", dated: "2026-06-06" },
  },
  {
    value: "24h",
    label: "Field validation sprint",
    sub: "Buildings & events entered, staff interviewed on-site",
    status: "self",
    source: { label: "Field validation log (below)", href: "#field-log" },
  },
  {
    value: "Live",
    label: "Working product",
    sub: "Address → physical risk surface, every finding sourced",
    status: "verified",
    source: { label: "German Shepherd scanner", href: "/app" },
  },
];

// ── Claims ledger — the heart of the rigour score ────────────────────────────
export const claims: Claim[] = [
  {
    id: "loi-bolttech",
    claim: "A global insurer has committed to a paid pilot.",
    evidence:
      "Bolttech signed a non-binding Letter of Intent: £20,000 pilot, 12 months full platform access + 1 free month on launch, plus reseller rights into their insurance-provider network.",
    source: { label: "Bolttech LOI · GS-LOI-2026-001", href: "/evidence/bolttech-loi.pdf", dated: "2026-06-06" },
    verify: "Open the LOI PDF. Check the signatory (Baldev Singh), role, value (£20,000), reference (GS-LOI-2026-001) and date (6 Jun 2026).",
    status: "verified",
  },
  {
    id: "decision-maker",
    claim: "The LOI is signed by an actual decision-maker, not a junior contact.",
    evidence:
      "Signatory is Baldev Singh — Regional General Manager (Thailand, Singapore, Philippines) and Chief Growth Officer (Asia & Middle East) at Bolttech.",
    source: { label: "Bolttech LOI signature block", href: "/evidence/bolttech-loi.pdf", dated: "2026-06-06" },
    verify: "Cross-reference the named title against Bolttech's public leadership / LinkedIn. The role sits over device, property and SME risk lines.",
    status: "verified",
  },
  {
    id: "product-works",
    claim: "The product is real and runs, not a mockup.",
    evidence:
      "German Shepherd turns any address into a physical risk surface from public + passively gathered data (wireless signals, corporate OSINT, exposed infrastructure, planning record). Live at /app.",
    source: { label: "Live scanner", href: "/app" },
    verify: "Visit /app and run a scan. Findings are sourced and audit-ready; the engine is real-data-only (no mock OSINT).",
    status: "verified",
  },
  {
    id: "field-demand",
    claim: "Demand was validated in person, not just inferred.",
    evidence:
      "We ran consent-based frontline interviews with building security and reception staff — Shahab detailed real incidents and the controls already in place; Aziz declined recording. Those findings shaped the product direction and the outbound that produced the LOI.",
    source: { label: "Field research interviews", href: "#field-research", dated: "2026-06-05" },
    verify: "See the field research section: structured per-interview findings, consent status and verbatim quotes, dated 5 Jun 2026.",
    status: "self",
  },
  {
    id: "field-sites",
    claim: "Field validation hit named, real sites — not anonymous anecdotes.",
    evidence:
      "During the sprint the team accessed real London sites (King's College London, let in legally overnight) and visited an insurer directly — filming live from Konsilio Insurance's London head office — documented publicly on X as it happened.",
    source: {
      label: "Team X posts · @Vedaant_k, @BathoIsaac",
      href: "https://x.com/Vedaant_k",
      dated: "2026-06-06",
    },
    verify: "Open the team's X feeds (dated during the hack): posts name King's College London and Konsilio Insurance with photos and video on site.",
    status: "verified",
  },
  {
    id: "build-in-public",
    claim: "The team builds in public and ships under pressure.",
    evidence:
      "Founder Isaac Batho posts build-in-public updates through the Pop the Bubble hack — including the launch announcement tied directly to the field validation: breaking into buildings, then offering to insure them.",
    source: {
      label: "Isaac Batho · LinkedIn (Pop the Bubble launch)",
      href: "https://www.linkedin.com/feed/update/urn:li:activity:7469163045601218560/",
      dated: "2026-06-07",
    },
    verify: "Open the LinkedIn post; cross-check the #popthebubble tag and the live product link in the post.",
    status: "verified",
  },
];

// ── Featured artifact: the Bolttech LOI ──────────────────────────────────────
export const loi = {
  company: "Bolttech",
  reference: "GS-LOI-2026-001",
  date: "6 June 2026",
  type: "Non-binding Letter of Intent",
  signatory: "Baldev Singh",
  signatoryRole:
    "Regional General Manager (Thailand, Singapore, Philippines) · Chief Growth Officer (Asia & Middle East)",
  pilotValue: "£20,000",
  access: "12 months full platform access + 1 free month on product launch",
  pdfUrl: "/evidence/bolttech-loi.pdf",
  terms: [
    "£20,000 pilot covering an agreed set of policyholder building profiles.",
    "12 months of full platform access: live wireless scanning, corporate OSINT, exposed-infrastructure mapping, planning-record lookup, building intelligence graph.",
    "One additional free month of access on full product launch.",
    "Reseller rights: Bolttech may distribute the platform to its insurance-provider network (formal terms TBC).",
    "Joint use-case scoping, technical integration, and signal-to-risk mapping across embedded protection & SME risk.",
    "Progress toward a formal commercial agreement subject to satisfactory pilot outcomes.",
  ],
  deliverables: [
    "Building intelligence reports — risk profiles per policyholder site.",
    "Signal-to-risk mapping — our data signals mapped to Bolttech underwriting variables.",
    "Integration specification — how outputs connect to their underwriting/distribution stack.",
    "Pilot evaluation report — coverage, data quality, signal accuracy, rollout recommendation.",
    "Reseller onboarding pack — tooling for Bolttech to distribute the platform.",
  ],
};

// ── Field validation log — the 24h method, reproducible ──────────────────────
export interface FieldEntry {
  when: string;
  action: string;
  detail: string;
}
export const fieldLog: FieldEntry[] = [
  {
    when: "Weekend window",
    action: "Entered real buildings & events",
    detail:
      "Decision-makers and building managers were off over the weekend — so we went to the people who are always there.",
  },
  {
    when: "On-site",
    action: "Interviewed security guards & reception",
    detail:
      "Asked front-line staff what they actually do day to day, what they worry about, and where physical risk is invisible to them.",
  },
  {
    when: "Same day",
    action: "Mapped needs → outbound",
    detail:
      "Turned the interviews into a clear need statement, then reached out via direct links to the right people to test whether the solution was useful.",
  },
  {
    when: "Within 24h",
    action: "Captured intent",
    detail:
      "Converted conversations into Letters of Intent — including the Bolttech LOI featured above.",
  },
];

// ── Product capabilities — what German Shepherd actually does ────────────────
// Verified against the live product at /app (tabs: Overview · WiFi · Bluetooth ·
// Recon · CCTV · Graph) and the source. Real-data-only by design.
export interface Feature {
  title: string;
  detail: string;
}
export const productNote =
  "Real-data-only: missing keys or tools return an honest empty state, never mock data. The hosted build demonstrates the full UI and public-data flows; live radio, CCTV and OSINT scanning run against the local backend + engines (npm run dev, real API keys).";
export const features: Feature[] = [
  {
    title: "Natural-language command bar",
    detail:
      "“Ask anything” — an LLM interprets intent (locate, investigate, recon) and drives the map and panels.",
  },
  {
    title: "3D map & planning-record lookup",
    detail:
      "Mapbox 3D city view plus live council registers (PlanIt / Idox) — public drawings classified by what they reveal. “Google shows the outside; the planning record shows the inside.”",
  },
  {
    title: "Corporate OSINT recon",
    detail:
      "Exposed infrastructure (Shodan / Censys), subdomains, harvested contacts and tech stack — each source shown as live or skipped (provenance, no black box).",
  },
  {
    title: "Live WiFi heatmap",
    detail:
      "Real device signals mapped by RSSI → distance (log-distance path-loss) — an honest estimate, not fabricated GPS.",
  },
  {
    title: "Live Bluetooth (BLE) heatmap",
    detail: "Nearby BLE devices scanned and rendered as a distinct purple heat layer.",
  },
  {
    title: "CCTV discovery + live feed",
    detail:
      "Discovers cameras on the local network and streams an RTSP → MJPEG feed with honest connection states.",
  },
  {
    title: "Crime & planning-designation overlays",
    detail:
      "data.police.uk crime heat plus conservation areas, listed buildings, Article 4, TPO and green-belt polygons from planning.data.gov.uk.",
  },
  {
    title: "Building intelligence graph + evidence report",
    detail:
      "Relationships across signals into one graph, exportable as a sourced, audit-ready evidence report.",
  },
];

// ── Field research — consent-based frontline interviews ──────────────────────
export interface Interview {
  name: string;
  role: string;
  locationType: string;
  consent: string;
  keyIncident: string;
  existingControls?: string;
  painPoint: string;
  opportunity: string;
  quote?: string;
  confidence: "high" | "medium" | "low";
  dated: string;
}
export const interviews: Interview[] = [
  {
    name: "Shahab",
    role: "Frontline restaurant / building security staff",
    locationType: "Restaurant inside a managed building, London",
    consent: "Consented — conversation captured",
    keyIncident:
      "A group entered the restaurant with no money or food and refused to leave; staff felt limited to calling police or asking them to go. The risk was an ambiguous human moment, not a locked door.",
    existingControls:
      "Cameras, sensors, control-room alerts, radio checks, access-controlled doors, and a routine where staff notify control before entering restricted areas.",
    painPoint:
      "Handling, escalating and learning from ambiguous incidents — not a lack of physical security.",
    opportunity: "Voice-to-incident-report with escalation guidance and training insights.",
    quote:
      "We have cameras. We have sensors. If someone tries to open the door, it alerts the control room. The moment you open the door, control gets the signal.",
    confidence: "high",
    dated: "2026-06-05",
  },
  {
    name: "Security officer · ex-Peninsula 5★",
    role: "~2.5 years in security; previously Peninsula Hotel (5-star)",
    locationType: "Commercial / residential building, London",
    consent: "Anonymous research — consented",
    keyIncident:
      "A calculated intruder wore an NHS lanyard to pass as a contractor, walked in unchallenged, went to the basement bike racks and stole a bike. Procedures were tightened afterwards; the gate-open window was cut from 15 seconds to 2.",
    existingControls:
      "CCTV (“eyes everywhere”, #1), radio comms (#2), front-of-house officer with a red panic/lockdown button, SOPs (fire first, 90-second window), card/app access with reception verification, and a facilities-manager permit flow for contractors.",
    painPoint:
      "Impersonation / tailgating (the lanyard trick) and miscommunication between tenants, facilities managers, cleaners and engineers — plus app-access verification friction.",
    opportunity:
      "Attacker's-eye view: surface how someone could impersonate, tailgate or learn access patterns from the outside — exactly the exposure underwriters can't see.",
    quote:
      "He had a lanyard, so it seemed like he worked for the NHS… he didn't look suspicious, he just went in, went downstairs, took the bike.",
    confidence: "high",
    dated: "2026-06-05",
  },
  {
    name: "Security officer · residential high-rise",
    role: "On shift, speaking for the security team (SIA-licensed)",
    locationType: "Residential high-rise, London (opposite 255)",
    consent: "Anonymous research — consented",
    keyIncident:
      "Intruders reached the top of a neighbouring tower (255) via a crane to film stunts — police attended and used this building to monitor them. Since then, locked-door checks keep even residents off the roof.",
    existingControls:
      "CCTV (the most-relied-on system), full alarm coverage with door-open triggers and location indication, NFC patrol touch-points that log timestamps, lone-worker check-ins (hourly call / panic button), and visitor verification (sit and text your host).",
    painPoint:
      "Lone-worker vulnerability — a single guard is a single point of failure — plus roof/height access and verifying who actually belongs.",
    opportunity:
      "Passive external risk view + lone-worker monitoring: see the exposure before an incident, not after.",
    quote:
      "Without CCTV you cannot function as security — that is how you deduce what is going on.",
    confidence: "high",
    dated: "2026-06-05",
  },
  {
    name: "Aziz",
    role: "Frontline / reception staff",
    locationType: "Building reception, London",
    consent: "Declined recording — written notes only",
    keyIncident:
      "Short interaction; no detailed security insight gathered before recording was declined.",
    painPoint:
      "Research-process learning: asking for a name and to record too early created friction with frontline staff.",
    opportunity: "Lead with anonymous, two-question framing; ask to record only after rapport.",
    confidence: "low",
    dated: "2026-06-05",
  },
];

// ── What the field research told us (insight, not a product pivot) ───────────
export const insight = {
  label: "What the field research told us",
  body:
    "Sites already have the hardware — cameras, sensors, control rooms. The real gap is ambiguous human moments: tailgating, people who won't leave, uncertainty over how to escalate. That messy, human side of physical risk is exactly what insurers underwrite — and what German Shepherd surfaces from the outside, before an incident.",
};

// ── Field footage — primary-source video from the sprint ─────────────────────
export const fieldFootage = {
  src: "/evidence/field-footage.mp4",
  caption:
    "On-site field footage, captured during the 24-hour sprint — the team gaining access to real London buildings.",
  dated: "2026-06-06",
  status: "verified" as Status,
};

// ── Why the truth matters (market significance) ──────────────────────────────
export const significance = {
  narrative:
    "We insure the insurer: we show insurers what attackers already know about their policyholders, so clients are more secure and insurers pay out less.",
  points: [
    "Building-level physical risk, drawn from passive signals + OSINT + the planning record, is a risk dimension existing underwriting data does not cover.",
    "Bolttech operates across device, property and SME risk products — a distribution channel into a whole insurer network, not a single team.",
    "Reseller rights in the LOI mean validated demand can scale market-wide, not just one pilot.",
    "Embedded protection & SME underwriting is a multi-region opportunity (Asia & Middle East named in the LOI).",
  ],
};

// ── How a judge verifies everything ──────────────────────────────────────────
export const verifySteps: string[] = [
  "Open the Bolttech LOI PDF and check signatory, role, value, reference and date.",
  "Run a live scan at /app — confirm the product produces sourced findings, not mock data.",
  "Read the field validation log for the reproducible demand-discovery method.",
  "Open the linked LinkedIn post to confirm the founder's build-in-public track record.",
  "Anything marked 'pending' is honestly flagged as not-yet-public — ask us and we'll show it live.",
];

// ── Pending evidence — honesty slots teammates fill in as data lands ─────────
export interface Pending {
  label: string;
  owner?: string;
  note: string;
}
export const pendingEvidence: Pending[] = [
  { label: "Additional LOIs", note: "More Letters of Intent toward the $50K LOI raise — add each as a verified claim + PDF when signed." },
  { label: "Product usage logs", note: "Scan counts / sessions from /app — wire in once captured for a depth-of-proof artifact." },
  { label: "Public data corroboration", note: "Public datasets backing specific risk findings — add source links per claim." },
  { label: "Teammates' social posts", note: "Dated Pop the Bubble posts from the rest of the team — add real URLs under Build-in-public as they come in." },
];

// ════════════════════════════════════════════════════════════════════════════
// PRICING & ROI  —  why the LOI is priced at £20,000, and what it grows into.
//
// IMPORTANT FRAMING: German Shepherd is PHYSICAL building security / in-person
// penetration testing (break-in, intrusion, tailgating, theft, business
// interruption) — NOT cybersecurity. Every number below is sourced; sources are
// tagged independent / vendor / secondary in `externalSources` so a judge can
// weight them. Lead with independent (govt / ABI / trade-body) figures.
// ════════════════════════════════════════════════════════════════════════════

export type SourceKind = "independent" | "vendor" | "secondary";

export interface ExternalSource {
  id: string;
  label: string; // what it is
  publisher: string; // who published it
  href: string;
  dated: string;
  kind: SourceKind;
  note?: string;
}

// ── Part 1: the brief — why we priced the LOI as we did ──────────────────────
export const pricingSummary = {
  kicker: "Pricing rationale",
  headline: "Why the pilot is priced at £20,000",
  lede:
    "German Shepherd does the reconnaissance an in-person penetration tester does — finding how a building can actually be entered — as software. We priced the pilot against two anchors: what that recon costs to do by hand, and what a single break-in costs an insurer. The full cost breakdown and growth path are below.",
  points: [
    {
      label: "Priced like a real physical engagement",
      body:
        "£20,000 sits inside the published range for a physical penetration test (£5,000–£40,000 per engagement; £1,000–£1,600 per tester-day in the UK) and below a full red-team (£30,000–£100,000+). We're priced as a serious multi-day assessment — delivered at software margins and repeatable across every site.",
      source: {
        label: "UK pen-test price guides — JUMPSEC / SECFORCE",
        href: "https://www.jumpsec.com/guides/how-much-does-penetration-testing-cost-in-the-uk/",
        dated: "2026",
      },
    },
    {
      label: "Cheaper than one break-in",
      body:
        "The average UK commercial property insurance claim is £17,400. The whole 12-month pilot costs roughly 1.1× a single claim — so influencing the outcome of one break-in across the agreed buildings repays it.",
      source: {
        label: "ABI — UK property claims, Q2 2025",
        href: "https://www.abi.org.uk/news/news-articles/2025/7/1.6-billion-paid-in-property-claims-in-q2-2025/",
        dated: "2025-07",
      },
    },
    {
      label: "A risk insurers can't see",
      body:
        "26% of UK business premises are hit by crime each year, and physical pen-test teams breach 80–99% of the buildings they target. Insurers underwrite buildings they have never seen from an attacker's side — exactly the gap German Shepherd closes before a loss.",
      source: {
        label: "Home Office Commercial Victimisation Survey 2023; IBM X-Force Red",
        href: "https://www.gov.uk/government/statistics/crime-against-businesses-findings-from-the-2023-commercial-victimisation-survey/crime-against-businesses-findings-from-the-2023-commercial-victimisation-survey",
        dated: "2023",
      },
    },
    {
      label: "A land price, not the ceiling",
      body:
        "£20,000 is a deliberately low-friction entry for a marquee insurer that brings reseller rights into 230+ carriers. The value price scales per-building and per-insurer in the formal commercial agreement.",
      source: { label: "Bolttech LOI · GS-LOI-2026-001", href: "/evidence/bolttech-loi.pdf", dated: "2026-06-06" },
    },
  ],
  reportAnchor: "#pricing-report",
};

// ── Part 2: the larger report — cost breakdown & growth path ─────────────────
export interface CostLine {
  item: string; // the LOI deliverable
  whatItIs: string; // plain-English what it is
  marketRate: string; // what it costs bought separately
  source?: Source;
}

export interface LossRow {
  stat: string; // the headline number
  detail: string;
  source: Source;
  kind: SourceKind;
}

export interface RoiRow {
  scenario: string;
  saved: string;
  roi: string;
}

export interface GrowthTier {
  stage: string;
  price: string;
  scope: string;
  rationale: string;
  status: Status;
}

export const pricingReport = {
  anchorId: "pricing-report",
  kicker: "Full cost breakdown & growth path",
  headline: "Why this LOI was signed at £20,000 — and what it grows into",
  intro:
    "This is the breakdown behind the headline price: what £20,000 actually buys, the physical-security losses it is priced against, a deliberately conservative return model, and the tiered path from a single pilot to a network-wide revenue line. Numbers in this section are physical-security figures — burglary, intrusion, theft and business interruption — not cyber.",

  // (a) what £20k buys — the cost stack vs market rates
  costStack: {
    label: "What £20,000 actually buys",
    intro:
      "Bought separately at market rates, the LOI deliverables cost many multiples of the pilot fee. German Shepherd delivers the same building reconnaissance as software, so the marginal cost per site collapses.",
    lines: [
      {
        item: "Building intelligence reports (per-site physical risk profiles)",
        whatItIs:
          "The reconnaissance phase of a physical penetration test — entry points, cameras, wireless/OSINT footprint and the planning record — automated for every agreed building.",
        marketRate: "£5,000–£40,000 per site by hand (£1,000–£1,600 per tester-day, UK)",
        source: {
          label: "Bright Defense; JUMPSEC; SECFORCE pen-test cost guides",
          href: "https://www.brightdefense.com/resources/what-is-physical-penetration-testing/",
          dated: "2026",
        },
      },
      {
        item: "12-month continuous platform access",
        whatItIs:
          "Always-on monitoring of each building's external risk surface — not a one-off snapshot — plus the building intelligence graph.",
        marketRate: "≈ £15,000+/yr for comparable continuous outside-in monitoring (entry SaaS tier)",
        source: {
          label: "UpGuard published pricing (category benchmark)",
          href: "https://www.upguard.com/pricing/",
          dated: "2026",
        },
      },
      {
        item: "Signal-to-risk mapping → underwriting variables",
        whatItIs:
          "Bespoke work mapping our data signals onto Bolttech's underwriting model across property & SME risk lines.",
        marketRate: "Custom risk-data consulting — typically £ tens of thousands",
      },
      {
        item: "Integration spec + reseller onboarding pack",
        whatItIs:
          "Technical docs to wire outputs into their stack, plus tooling to distribute German Shepherd to their insurer network.",
        marketRate: "Channel & integration enablement — normally a separate paid workstream",
      },
    ] as CostLine[],
    takeaway:
      "At market rates the building-assessment line alone — even a modest pilot scope of 10–25 sites — represents £50,000–£1,000,000 of manual physical pen-testing. £20,000 prices the entire 12-month engagement below a single comprehensive manual assessment.",
  },

  // (b) the loss we price against — all sourced, mostly independent
  lossContext: {
    label: "The physical-security loss we price against",
    intro:
      "Insurers pay these losses today because building-level physical risk is invisible to existing underwriting data. Each figure below is independently checkable.",
    rows: [
      {
        stat: "£17,400",
        detail: "Average UK commercial property insurance claim (Q2 2025); £1.6bn paid in property claims that quarter.",
        source: {
          label: "Association of British Insurers",
          href: "https://www.abi.org.uk/news/news-articles/2025/7/1.6-billion-paid-in-property-claims-in-q2-2025/",
          dated: "2025-07",
        },
        kind: "independent",
      },
      {
        stat: "26%",
        detail:
          "of UK business premises were a victim of crime in the last year — 8% burglary, 14% theft; rising to 41% in retail & wholesale.",
        source: {
          label: "Home Office Commercial Victimisation Survey 2023",
          href: "https://www.gov.uk/government/statistics/crime-against-businesses-findings-from-the-2023-commercial-victimisation-survey/crime-against-businesses-findings-from-the-2023-commercial-victimisation-survey",
          dated: "2023",
        },
        kind: "independent",
      },
      {
        stat: "1 in 10",
        detail:
          "small businesses that were victims of crime lost over £10,000; 81% of small firms were hit by crime over two years.",
        source: {
          label: "FSB — Cracking the Case",
          href: "https://www.fsb.org.uk/resource-report/cracking-the-case-uncovering-the-cost-of-small-business-crime.html",
          dated: "2023-12",
        },
        kind: "independent",
      },
      {
        stat: "£4.2bn",
        detail: "Total cost of UK retail crime — including £2.2bn of direct customer theft, up 21% year on year.",
        source: {
          label: "British Retail Consortium Crime Survey 2025",
          href: "https://brc.org.uk/news-and-events/news/operations/2025/ungated/brc-retail-crime-survey-2025/",
          dated: "2025",
        },
        kind: "independent",
      },
      {
        stat: "80–99%",
        detail:
          "of buildings are successfully breached by physical pen-test teams; tailgating succeeds on 60–90% of first attempts, and fewer than 1 in 5 staff challenge a stranger.",
        source: {
          label: "Pinkerton (~80%); IBM X-Force Red (99%)",
          href: "https://pinkerton.com/our-insights/blog/onsite-penetration-testing-and-social-engineering-for-physical-security",
          dated: "2024",
        },
        kind: "vendor",
      },
      {
        stat: "23%",
        detail:
          "Only 23% of premises-holding SMEs carry business-interruption cover, and up to 40% of UK SMEs are underinsured — so a single physical incident can be existential.",
        source: {
          label: "ABI / Public First — SME underinsurance; FCA",
          href: "https://www.publicfirst.co.uk/smallbusbigrisk",
          dated: "2026-01",
        },
        kind: "independent",
      },
    ] as LossRow[],
  },

  // (c) ROI model — deliberately conservative, physical-framed
  roi: {
    label: "The return model (deliberately conservative)",
    intro:
      "We model the lever that hits the insurer's P&L directly: better physical risk selection and remediation prompts that reduce break-in, theft and business-interruption claims on a property book.",
    assumptions: [
      "Claim frequency: 5% per commercial policy per year — below the Home Office prevalence (8% burglary + 14% theft), discounted for unclaimed and sub-excess incidents.",
      "Severity: £10,000 per claim — conservative, below the ABI all-cause commercial average of £17,400 (FSB: 1 in 10 victims lose >£10,000).",
      "Expected crime-loss cost = 5% × £10,000 = £500 per policy per year.",
      "Worked on a modest book of 1,000 SME commercial-property policies → ≈ £500,000 expected crime-loss cost per year.",
    ],
    rows: [
      { scenario: "Break-even (≈4% fewer crime claims)", saved: "£20,000", roi: "1.0× (pays for itself)" },
      { scenario: "5% fewer crime claims", saved: "£25,000", roi: "1.25×" },
      { scenario: "10% fewer crime claims", saved: "£50,000", roi: "2.5×" },
      { scenario: "20% fewer crime claims", saved: "£100,000", roi: "5×" },
    ] as RoiRow[],
    singleClaim:
      "£20,000 ≈ 1.1× the average commercial property claim (£17,400). Across the agreed pilot buildings, German Shepherd only needs to prevent or re-price a single break-in to repay the entire pilot.",
    breakEven:
      "On a 1,000-policy book the pilot breaks even at a ~4% reduction in crime claims. With severity at the ABI £17,400 average instead of our £10,000, the same 5% reduction is worth ~£43,500 — a 2.2× return. Either way, modest prevention dwarfs the fee.",
  },

  // (d) what it grows into — tiers + market backdrop
  growth: {
    label: "What it grows into",
    intro:
      "The pilot is the land price. Expansion is priced per-building, per-insurer, and as a share of premium written on screened risk — so revenue scales with Bolttech's network, not with our headcount.",
    tiers: [
      {
        stage: "Pilot — signed",
        price: "£20,000 / 12 months",
        scope: "An agreed set of policyholder buildings, one insurer (Bolttech), + 1 free month on launch.",
        rationale: "Low-friction entry that retires the demand risk and unlocks reseller rights.",
        status: "verified",
      },
      {
        stage: "Per-insurer platform licence",
        price: "£30,000–£60,000 / yr per carrier",
        scope: "Full platform access for each insurer in Bolttech's network.",
        rationale: "Still below a single manual red-team and below enterprise security-ratings seats.",
        status: "pending",
      },
      {
        stage: "Per-building screening",
        price: "£25–£150 per building profiled",
        scope: "Usage-based screening at underwriting, embedded in the quote flow.",
        rationale: "30–1,000× cheaper per building than a £5k–£40k manual assessment, at software margin.",
        status: "pending",
      },
      {
        stage: "Reseller revenue share",
        price: "Per-policy data fee / share of premium",
        scope: "Across Bolttech's 230+ insurers and 700+ distribution partners.",
        rationale: "Scales with their ~$85bn of premiums quoted annually — the real prize in the LOI.",
        status: "pending",
      },
    ] as GrowthTier[],
    marketBackdrop: [
      {
        stat: "~$2.9bn → 12%+ CAGR",
        detail:
          "Penetration-testing market, growing inside a $130bn+ global physical-security industry.",
        source: {
          label: "Mordor Intelligence; Grand View Research",
          href: "https://www.mordorintelligence.com/industry-reports/penetration-testing-market",
          dated: "2026",
        },
        kind: "independent" as SourceKind,
      },
      {
        stat: "$700bn–$950bn",
        detail: "Forecast embedded-insurance gross written premium by 2030 — Bolttech's core market.",
        source: {
          label: "Strategy& / PwC; Mordor Intelligence",
          href: "https://www.strategyand.pwc.com/de/en/industries/financial-services/embedded-insurance.html",
          dated: "2025",
        },
        kind: "independent" as SourceKind,
      },
      {
        stat: "$2.1bn",
        detail: "Bolttech valuation (Series C) — 230+ insurers, 700+ distributors, ~$85bn premiums quoted/yr.",
        source: {
          label: "TechCrunch",
          href: "https://techcrunch.com/2025/06/04/singapore-based-insurtech-bolttech-closes-147m-series-c-at-a-2-1b-valuation/",
          dated: "2025-06",
        },
        kind: "independent" as SourceKind,
      },
    ],
  },
};

// ── Sources & methodology — the full citation library for the pricing work ────
export const externalSources: ExternalSource[] = [
  {
    id: "abi-claims",
    label: "Average UK commercial property claim £17,400; £1.6bn property claims paid Q2 2025",
    publisher: "Association of British Insurers (ABI)",
    href: "https://www.abi.org.uk/news/news-articles/2025/7/1.6-billion-paid-in-property-claims-in-q2-2025/",
    dated: "2025-07",
    kind: "independent",
  },
  {
    id: "cvs-2023",
    label: "26% of business premises hit by crime/yr; 8% burglary, 14% theft, 41% retail & wholesale",
    publisher: "Home Office — Commercial Victimisation Survey 2023",
    href: "https://www.gov.uk/government/statistics/crime-against-businesses-findings-from-the-2023-commercial-victimisation-survey/crime-against-businesses-findings-from-the-2023-commercial-victimisation-survey",
    dated: "2023",
    kind: "independent",
  },
  {
    id: "fsb-crime",
    label: "81% of small firms hit by crime over two years; 1 in 10 victims lost >£10,000",
    publisher: "Federation of Small Businesses — Cracking the Case",
    href: "https://www.fsb.org.uk/resource-report/cracking-the-case-uncovering-the-cost-of-small-business-crime.html",
    dated: "2023-12",
    kind: "independent",
  },
  {
    id: "brc-crime",
    label: "Total UK retail crime £4.2bn incl. £2.2bn customer theft (+21% YoY)",
    publisher: "British Retail Consortium — Crime Survey 2025",
    href: "https://brc.org.uk/news-and-events/news/operations/2025/ungated/brc-retail-crime-survey-2025/",
    dated: "2025",
    kind: "independent",
  },
  {
    id: "abi-underinsurance",
    label: "Only 23% of premises-holding SMEs carry business-interruption cover",
    publisher: "ABI / Public First — Small Business, Big Risk",
    href: "https://www.publicfirst.co.uk/smallbusbigrisk",
    dated: "2026-01",
    kind: "independent",
  },
  {
    id: "jumpsec-price",
    label: "UK pen-test day rate £1,000–£1,600/tester; engagements typically 3–10 days",
    publisher: "JUMPSEC; SECFORCE (UK pen-test price guides)",
    href: "https://www.jumpsec.com/guides/how-much-does-penetration-testing-cost-in-the-uk/",
    dated: "2026",
    kind: "vendor",
  },
  {
    id: "brightdefense-price",
    label: "Physical pen test $4,800 (basic single-site) to $50,000+ (multi-site)",
    publisher: "Bright Defense",
    href: "https://www.brightdefense.com/resources/what-is-physical-penetration-testing/",
    dated: "2026",
    kind: "vendor",
  },
  {
    id: "upguard-price",
    label: "Continuous outside-in monitoring from ~$19k/yr (entry SaaS tier) — category benchmark",
    publisher: "UpGuard (published pricing)",
    href: "https://www.upguard.com/pricing/",
    dated: "2026",
    kind: "vendor",
  },
  {
    id: "ibm-xforce",
    label: "Social engineers physically compromise targets in 99% of engagements",
    publisher: "IBM X-Force Red",
    href: "https://www.ibm.com/services/social-engineering",
    dated: "2024",
    kind: "vendor",
    note: "Widely cited but vendor-published; pair with the independent tailgating surveys.",
  },
  {
    id: "pinkerton",
    label: "~80% of onsite physical pen-tests succeed via the human element",
    publisher: "Pinkerton",
    href: "https://pinkerton.com/our-insights/blog/onsite-penetration-testing-and-social-engineering-for-physical-security",
    dated: "2024",
    kind: "vendor",
  },
  {
    id: "boonedam-tailgating",
    label: "48% of organisations reported ≥1 tailgating breach in two years (independent survey)",
    publisher: "Boon Edam / Readex Research",
    href: "https://blog.boonedam.com/en-us/hidden-risks-of-tailgating-and-piggybacking",
    dated: "2023",
    kind: "independent",
  },
  {
    id: "pentest-market",
    label: "Pen-test market ~$2.9bn, ~12%+ CAGR; physical-security industry $130bn+",
    publisher: "Mordor Intelligence; Grand View Research",
    href: "https://www.mordorintelligence.com/industry-reports/penetration-testing-market",
    dated: "2026",
    kind: "independent",
  },
  {
    id: "embedded-market",
    label: "Embedded-insurance GWP forecast $700bn–$950bn by 2030",
    publisher: "Strategy& / PwC; Mordor Intelligence",
    href: "https://www.strategyand.pwc.com/de/en/industries/financial-services/embedded-insurance.html",
    dated: "2025",
    kind: "independent",
  },
  {
    id: "bolttech-valuation",
    label: "Bolttech $2.1bn valuation; 230+ insurers, 700+ distributors, ~$85bn premiums quoted/yr",
    publisher: "TechCrunch; bolttech.io",
    href: "https://techcrunch.com/2025/06/04/singapore-based-insurtech-bolttech-closes-147m-series-c-at-a-2-1b-valuation/",
    dated: "2025-06",
    kind: "independent",
  },
];

export const sourcesNote =
  "German Shepherd is physical-security intelligence (in-person penetration testing), so figures here are physical losses — burglary, intrusion, theft, business interruption — not cyber. Independent = government, regulator, or trade-body data; Vendor = published by a firm selling a related service (directional, used as supporting colour); Secondary = reputable reporting of a primary source. Two widely-repeated claims are deliberately excluded as unreliable: the \"£12.9bn business-crime\" figure (unverified, retailer-sourced) and \"80% of businesses close within 18 months of a disaster\" (US FEMA, not UK).";

// ── The licensed data layer (cost of goods + moat) ───────────────────────────
// The paid UK property/building data that German Shepherd licenses to turn an
// address into a risk surface. The point: input data alone costs more per year
// than the £20k pilot — so the price is a strategic land deal, and the licensed
// layer is a moat a scraper cannot copy. Prices are providers' public/list rates.
export interface DataSource {
  provider: string;
  what: string;
  price: string;
  href: string;
}
export interface DataGroup {
  category: string;
  items: DataSource[];
}
export const dataCostBase = {
  label: "The data cost base behind the platform",
  intro:
    "German Shepherd's building intelligence runs on licensed, paid UK property data — not scraping. These are the inputs behind a single building profile, at providers' public rates.",
  headline:
    "£20,000 does not even cover our data bill. HM Land Registry's National Polygon Service alone is £20,000/year — the entire pilot fee — before CoStar, Ordnance Survey Premium, environmental, credit and footfall data. That is why the pilot is a strategic land price, not a margin play: the licensed data layer is a moat a scraper can't copy.",
  groups: [
    {
      category: "Property ownership & boundaries — HM Land Registry",
      items: [
        {
          provider: "Title Register / Title Plan",
          what: "Authoritative ownership + plan behind the free price-paid feed.",
          price: "~£3 per title",
          href: "https://www.gov.uk/search-property-information-land-registry",
        },
        {
          provider: "National Polygon Service",
          what: "Every property boundary in England & Wales.",
          price: "£20,000 / year",
          href: "https://use-land-property-data.service.gov.uk/datasets/nps",
        },
        {
          provider: "Commercial & Corporate Ownership Data",
          what: "Who owns what, including overseas owners.",
          price: "Bulk licensed — price on application",
          href: "https://use-land-property-data.service.gov.uk/",
        },
      ],
    },
    {
      category: "Ordnance Survey Premium",
      items: [
        {
          provider: "AddressBase Premium",
          what: "Full UPRN/address with lifecycle and cross-references.",
          price: "OS Data Hub Premium / partner — scales with usage",
          href: "https://osdatahub.os.uk/",
        },
        {
          provider: "MasterMap Topography + Building Height",
          what: "Actual building footprints and heights.",
          price: "OS Data Hub Premium / partner — scales with usage",
          href: "https://osdatahub.os.uk/",
        },
      ],
    },
    {
      category: "Commercial property intelligence",
      items: [
        {
          provider: "CoStar",
          what: "Dominant CRE database — tenancies, lease events, valuations, ownership.",
          price: "Enterprise — typically £10k+ / year",
          href: "https://www.costar.co.uk/",
        },
        {
          provider: "LandInsight / LandTech",
          what: "Site sourcing, ownership, planning history in one UI.",
          price: "~£100–£300 / month per seat",
          href: "https://land.tech/",
        },
        {
          provider: "Nimbus Maps",
          what: "Site intelligence, ownership, lease data.",
          price: "SaaS — monthly per seat",
          href: "https://www.nimbusmaps.co.uk/",
        },
        {
          provider: "Beauhurst",
          what: "Company/owner intelligence for the businesses inside buildings.",
          price: "Enterprise annual licence",
          href: "https://www.beauhurst.com/",
        },
      ],
    },
    {
      category: "Environmental & risk",
      items: [
        {
          provider: "Landmark Information Group",
          what: "Contaminated land, flood, ground stability, full environmental search.",
          price: "~£40–£60 per report, or licence",
          href: "https://www.landmark.co.uk/",
        },
        {
          provider: "Groundsure",
          what: "Environmental / climate risk reports.",
          price: "Per report",
          href: "https://www.groundsure.com/",
        },
      ],
    },
    {
      category: "Business & credit data (occupants)",
      items: [
        {
          provider: "Companies House Premium / bulk",
          what: "Full data products beyond the free API.",
          price: "Bulk / licensed",
          href: "https://find-and-update.company-information.service.gov.uk/",
        },
        {
          provider: "Dun & Bradstreet · Creditsafe · Red Flag Alert",
          what: "Financial health, credit scores, director networks for occupants.",
          price: "Annual subscriptions",
          href: "https://www.redflagalert.com/",
        },
      ],
    },
    {
      category: "Footfall & mobility",
      items: [
        {
          provider: "Huq Industries · Placer.ai · SafeGraph / Advan",
          what: "Real footfall and visit data for locations.",
          price: "Enterprise licensing",
          href: "https://huq.io/",
        },
      ],
    },
  ] as DataGroup[],
  takeaway:
    "Two fixed licences alone — National Polygon (£20,000/yr) and CoStar (£10k+/yr) — exceed the pilot fee before a single per-report or per-seat cost. The £20k buys the relationship and the resale channel; the data layer is what makes the product hard to copy.",
};

// ── Build-in-public (bonus +12) — real, dated posts only ─────────────────────
export interface Post {
  platform: string;
  href: string;
  summary: string;
  dated: string;
  status: Status;
}
export const buildInPublic: Post[] = [
  {
    platform: "LinkedIn · Isaac Batho",
    href: "https://www.linkedin.com/feed/update/urn:li:activity:7469163045601218560/",
    summary:
      "“The BUBBLE has been POPPED.” Pop the Bubble launch — we break into buildings, now we'll insure them. #popthebubble",
    dated: "2026-06-07",
    status: "verified",
  },
  {
    platform: "X · @BathoIsaac",
    href: "https://x.com/BathoIsaac",
    summary:
      "Live from Konsilio Insurance's London head office: “The BUBBLE has been POPPED” → spectre-peach.vercel.app. #popthebubble",
    dated: "2026-06-07",
    status: "verified",
  },
  {
    platform: "X · @BathoIsaac",
    href: "https://x.com/BathoIsaac",
    summary:
      "“Taking Corgi for a walk with German Shepherd at the Pop the Bubble Hackathon to help secure buildings and events.”",
    dated: "2026-06-07",
    status: "verified",
  },
  {
    platform: "X · @Vedaant_k",
    href: "https://x.com/Vedaant_k",
    summary:
      "“We did indeed break in to some of the coolest places in London, signed an LOI, and now we're going to sell German Shepherd to the places we cooked.” (~439 views)",
    dated: "2026-06-07",
    status: "verified",
  },
  {
    platform: "X · @BathoIsaac",
    href: "https://x.com/BathoIsaac",
    summary:
      "“We're testing how secure your event is by breaking in. Let me know if you want us to try break in!!!” Tagged @nvidia, @hoaqclub and others.",
    dated: "2026-06-07",
    status: "verified",
  },
  {
    platform: "X · @Vedaant_k",
    href: "https://x.com/Vedaant_k",
    summary:
      "“Thank you Kings for letting us in last night completely legally” — King's College London site access, photographed. (~1K views)",
    dated: "2026-06-07",
    status: "verified",
  },
  {
    platform: "X · @Vedaant_k",
    href: "https://x.com/Vedaant_k",
    summary:
      "“At the Pop the Bubble hackathon and we're speaking to our end users right now.” Live customer discovery.",
    dated: "2026-06-06",
    status: "verified",
  },
  {
    platform: "X · @Deepnsec",
    href: "https://x.com/Deepnsec",
    summary:
      "Team build-in-public thread amplifying the Pop the Bubble field sprint. #popthebubble",
    dated: "2026-06-07",
    status: "verified",
  },
  // TEAMMATES: add more dated Pop the Bubble posts here. Prefer permalinks over profile roots.
  // { platform: "X · @handle", href: "https://x.com/handle/status/...", summary: "...", dated: "2026-06-07", status: "verified" },
];
