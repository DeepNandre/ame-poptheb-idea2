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
      "Over a 24-hour sprint we entered real buildings and events, interviewed security guards and reception staff about what they actually do, then converted that into outbound conversations and Letters of Intent.",
    source: { label: "Field validation log", href: "#field-log", dated: "2026-06-06" },
    verify: "See the timeline below. Method is reproducible: enter site → interview front-line staff → map needs → outbound → capture intent.",
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
