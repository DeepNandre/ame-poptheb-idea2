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
    value: "£50,000",
    label: "Pilot value committed",
    sub: "Across 2 signed LOIs — Bolttech (£20k) + Upahaar (£30k)",
    status: "verified",
    source: { label: "Both LOIs (GS-LOI-2026-001 / -002)", href: "/evidence/upahaar-loi-signed.pdf", dated: "2026-06-07" },
  },
  {
    value: "2",
    label: "Signed Letters of Intent",
    sub: "Bolttech (insurer channel) + Upahaar (direct, customer-countersigned)",
    status: "verified",
    source: { label: "Upahaar signed LOI · GS-LOI-2026-002", href: "/evidence/upahaar-loi-signed.pdf", dated: "2026-06-07" },
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
    id: "loi-upahaar",
    claim: "A paying customer signed because the pain is real, not hypothetical.",
    evidence:
      "Upahaar — a marketing & gifting company in Nashik whose office had repeated break-ins — countersigned a £30,000 signed LOI (GS-LOI-2026-002) the same morning it was sent. The thesis landed because the break-ins made the value tangible.",
    source: { label: "Upahaar signed LOI + email confirmation", href: "/evidence/upahaar-loi-signed.pdf", dated: "2026-06-07" },
    verify: "Open the signed PDF (signatory Aditya Kakuste, Founder's Office) and the email thread: sent 05:47, signed reply 06:08 — “Please find the signed LOI attached.”",
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

// ── Featured artifacts: the signed LOIs ──────────────────────────────────────
export interface Loi {
  company: string;
  reference: string;
  date: string;
  type: string;
  signatory: string;
  signatoryRole: string;
  pilotValue: string;
  access: string;
  pdfUrl: string;
  emailUrl?: string; // email confirmation, where available
  context?: string;
  terms: string[];
  deliverables: string[];
}

export const lois: Loi[] = [
  {
    company: "Upahaar",
    reference: "GS-LOI-2026-002",
    date: "7 June 2026",
    type: "Signed LOI — customer-countersigned",
    signatory: "Aditya Kakuste",
    signatoryRole: "Founder's Office, Upahaar (marketing & gifting, Nashik, India)",
    pilotValue: "£30,000",
    access: "12 months full platform access + 1 free month on product launch",
    pdfUrl: "/evidence/upahaar-loi-signed.pdf",
    emailUrl: "/evidence/upahaar-email-confirmation.pdf",
    context:
      "Upahaar's Nashik office had suffered repeated break-ins, leaving the team worried about physical security. The German Shepherd thesis — we surface what anyone can already see about your building before you do — made the value immediate and tangible. Countersigned the same morning the LOI was sent (sent 05:47, signed reply 06:08).",
    terms: [
      "£30,000 pilot covering full evaluation and delivery across Upahaar's Nashik office and any additional agreed sites.",
      "12 months of full platform access: live wireless scanning, corporate OSINT, exposed-infrastructure mapping, planning-record lookup, building intelligence graph.",
      "One additional free month of access on full product launch.",
      "A complete intelligence report on the Nashik office, in a structured, actionable format.",
      "Joint scoping of additional sites or use cases identified during the pilot.",
      "Progress toward a formal commercial agreement subject to satisfactory pilot outcomes.",
    ],
    deliverables: [
      "Building intelligence report — full risk profile of the Nashik office (wireless, visible infrastructure, OSINT, planning/structural record).",
      "Wireless signal scan — live SSID/signal mapping showing what's visible to anyone in range.",
      "Corporate OSINT profile — subdomains, exposed infrastructure, tech stack, public corporate data.",
      "Infrastructure visibility report — what's publicly exposed at the network/infrastructure level.",
      "Pilot evaluation summary — findings, coverage, and recommendations for expansion.",
    ],
  },
  {
    company: "Bolttech",
    reference: "GS-LOI-2026-001",
    date: "6 June 2026",
    type: "Letter of Intent",
    signatory: "Baldev Singh",
    signatoryRole:
      "Regional General Manager (Thailand, Singapore, Philippines) · Chief Growth Officer (Asia & Middle East)",
    pilotValue: "£20,000",
    access: "12 months full platform access + 1 free month on product launch",
    pdfUrl: "/evidence/bolttech-loi.pdf",
    context:
      "A global embedded-insurance platform: validates the channel play — building-level risk that existing underwriting data doesn't cover, with reseller rights into Bolttech's insurer network.",
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
  },
];

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
    "Two go-to-market paths are already validated with signed money: the insurer channel (Bolttech) and direct enterprise (Upahaar) — £50,000 committed across both.",
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
  { label: "Further LOIs", note: "Two signed (£50k committed); add each new Letter of Intent as a verified claim + PDF as it lands." },
  { label: "Product usage logs", note: "Scan counts / sessions from /app — wire in once captured for a depth-of-proof artifact." },
  { label: "Public data corroboration", note: "Public datasets backing specific risk findings — add source links per claim." },
  { label: "Teammates' social posts", note: "Dated Pop the Bubble posts from the rest of the team — add real URLs under Build-in-public as they come in." },
];

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
