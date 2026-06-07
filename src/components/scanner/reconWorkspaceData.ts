// Frontend-only mock intel for the post-recon workspace. Everything here is
// DERIVED DETERMINISTICALLY from the target building name (seeded PRNG) so the
// people roster, contact enrichment, and OSINT findings stay stable across
// re-renders, searches, and tab switches — no backend, no network. This mirrors
// the simulated recon pipeline (useReconPipeline) rather than the real
// public-data engine.

export interface Person {
  id: string;
  name: string;
  role: string;
  dept: string;
  seniority: "exec" | "senior" | "staff" | "contractor";
  // Revealed by "Enrich" — withheld until then so the action feels real.
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  tenure: string;
}

export interface OsintFinding {
  label: string;
  value: string;
  tag: "domain" | "service" | "access" | "social" | "device";
}

// ---- seeded PRNG (mulberry32) — stable list from a string seed -------------

function seedFrom(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- name pools ------------------------------------------------------------

const FIRST = [
  "James", "Sarah", "Michael", "Priya", "David", "Emma", "Daniel", "Olivia",
  "Tom", "Aisha", "Mark", "Sofia", "Chris", "Hannah", "Raj", "Laura",
  "Ben", "Grace", "Nathan", "Yara", "Adam", "Chloe", "Leo", "Maya",
];
const LAST = [
  "Carter", "Okafor", "Bennett", "Sharma", "Reid", "Thompson", "Lowe", "Nguyen",
  "Walsh", "Patel", "Fisher", "Romano", "Hughes", "Clarke", "Mehta", "Doyle",
  "Foster", "Adeyemi", "Brooks", "Haddad", "Wright", "Lin", "Novak", "Ellis",
];

// Roles that matter to a *building*-centric recon: who holds the doors, the
// badges, the network, and the org chart.
const ROLES: { role: string; dept: string; seniority: Person["seniority"] }[] = [
  { role: "Chief Executive Officer", dept: "Executive", seniority: "exec" },
  { role: "Chief Operating Officer", dept: "Executive", seniority: "exec" },
  { role: "Facilities Manager", dept: "Facilities", seniority: "senior" },
  { role: "Head of Physical Security", dept: "Security", seniority: "senior" },
  { role: "IT Systems Administrator", dept: "IT", seniority: "staff" },
  { role: "Office Manager", dept: "Operations", seniority: "senior" },
  { role: "Front-of-House Receptionist", dept: "Facilities", seniority: "staff" },
  { role: "Building Services Engineer", dept: "Facilities", seniority: "staff" },
  { role: "HR Director", dept: "People", seniority: "senior" },
  { role: "Network Engineer", dept: "IT", seniority: "staff" },
  { role: "Cleaning Supervisor", dept: "Facilities", seniority: "contractor" },
  { role: "Security Officer (night)", dept: "Security", seniority: "contractor" },
];

const CITIES = ["London", "Manchester", "Reading", "Bristol", "Leeds", "Cambridge"];

function domainFor(building: string): string {
  const slug = building
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18) || "target";
  return `${slug}.co.uk`;
}

export function rosterFor(building: string): Person[] {
  const rand = mulberry32(seedFrom(building));
  const domain = domainFor(building);
  const count = 8 + Math.floor(rand() * 4); // 8–11 people
  const used = new Set<string>();

  const people: Person[] = [];
  for (let i = 0; i < count; i++) {
    const slot = ROLES[i % ROLES.length];
    let first = FIRST[Math.floor(rand() * FIRST.length)];
    let last = LAST[Math.floor(rand() * LAST.length)];
    let key = `${first} ${last}`;
    let guard = 0;
    while (used.has(key) && guard++ < 12) {
      first = FIRST[Math.floor(rand() * FIRST.length)];
      last = LAST[Math.floor(rand() * LAST.length)];
      key = `${first} ${last}`;
    }
    used.add(key);

    const handle = `${first.toLowerCase()}.${last.toLowerCase()}`;
    people.push({
      id: `p${i}`,
      name: key,
      role: slot.role,
      dept: slot.dept,
      seniority: slot.seniority,
      email: `${handle}@${domain}`,
      phone: `+44 7${Math.floor(100 + rand() * 899)} ${Math.floor(100000 + rand() * 899999)}`,
      linkedin: `linkedin.com/in/${handle}`,
      location: CITIES[Math.floor(rand() * CITIES.length)],
      tenure: `${1 + Math.floor(rand() * 9)} yr`,
    });
  }
  return people;
}

export function osintFor(building: string): OsintFinding[] {
  const rand = mulberry32(seedFrom(building) ^ 0x9e3779b9);
  const domain = domainFor(building);
  const ports = [80, 443, 8080, 22, 3389, 554];
  const services = ["nginx", "OpenSSH", "RDP", "RTSP camera", "VPN gateway", "Exchange OWA"];
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  return [
    { label: "Primary domain", value: domain, tag: "domain" },
    { label: "Subdomain", value: `mail.${domain}`, tag: "domain" },
    { label: "Subdomain", value: `vpn.${domain}`, tag: "domain" },
    { label: "Exposed service", value: `${pick(services)} :${pick(ports)}`, tag: "service" },
    { label: "Exposed service", value: `${pick(services)} :${pick(ports)}`, tag: "service" },
    { label: "Access control", value: `${pick(["HID iCLASS", "Paxton Net2", "Salto"])} badge readers — main lobby`, tag: "access" },
    { label: "Access control", value: `Visitor sign-in via ${pick(["Proxyclick", "SwipedOn", "Envoy"])}`, tag: "access" },
    { label: "Social", value: `${4 + Math.floor(rand() * 30)} staff geotagged on-site (LinkedIn)`, tag: "social" },
    { label: "Cameras", value: `${2 + Math.floor(rand() * 8)} IP cameras on adjacent subnet`, tag: "device" },
  ];
}

// ---- simulated building-aware chat assistant -------------------------------

// Keyword-routed responder. No LLM — just plausible, building-specific answers
// composed from the same seeded intel the other tabs show.
export function answerReconQuestion(building: string, question: string, people: Person[]): string {
  const q = question.toLowerCase();
  const exec = people.find((p) => p.seniority === "exec");
  const security = people.find((p) => p.dept === "Security");
  const facilities = people.find((p) => p.role.includes("Facilities"));
  const domain = domainFor(building);

  if (/entrance|door|access|badge|lobby|reception|enter|get in/.test(q)) {
    return `${building} uses badge-controlled entry at the main lobby (HID-class readers), with a staffed reception desk and a visitor sign-in kiosk. The schematic phase mapped a primary entrance, a service/loading entrance at the rear, and a fire-escape core. ${facilities ? `${facilities.name} (${facilities.role}) owns physical access here.` : ""} Tailgating risk is highest at shift-change and around the loading bay.`;
  }
  if (/people|staff|employee|who works|roster|team|contact/.test(q)) {
    return `The people phase surfaced ${people.length} individuals tied to ${building}. Highest-value for a physical engagement: ${security ? `${security.name} (${security.role})` : "the security lead"}${facilities ? ` and ${facilities.name} (${facilities.role})` : ""}. Open the People tab to enrich any of them for direct contact details.`;
  }
  if (/floor|layout|plan|3d|schematic|inside|structure/.test(q)) {
    return `The schematic phase reconstructed a floor-by-floor 3D model from planning-portal drawings and FOI documents. Reception and access control sit on the ground floor; plant and comms rooms are at roof level. Hit the 3D View button to walk the model.`;
  }
  if (/camera|cctv|surveillance|monitor/.test(q)) {
    return `OSINT flagged several IP cameras on an adjacent subnet covering the lobby and perimeter. Coverage is densest at the main entrance; the loading bay and the east stairwell read as blind spots. See the OSINT tab for the device list.`;
  }
  if (/network|wifi|it|domain|exposed|infra|server/.test(q)) {
    return `The org runs on ${domain}. OSINT picked up mail and VPN subdomains plus a couple of internet-exposed services. ${people.find((p) => p.dept === "IT") ? `${people.find((p) => p.dept === "IT")!.name} administers IT.` : ""} Details are in the OSINT tab.`;
  }
  if (/ceo|boss|exec|director|in charge|leadership/.test(q)) {
    return exec
      ? `${exec.name} is listed as ${exec.role} at ${building}, based in ${exec.location}. Enrich them in the People tab for direct contact details.`
      : `No clear executive surfaced for ${building} — try enriching the senior staff in the People tab.`;
  }
  if (/weak|vulnerab|risk|attack|exploit|social/.test(q)) {
    return `Top exposure themes for ${building}: (1) tailgating at the staffed-but-busy lobby, (2) a loading entrance with thinner camera coverage, (3) staff geotagged on-site making pretexting easy, and (4) a couple of internet-exposed services worth a closer look. Cross-reference the People and OSINT tabs to build a chain.`;
  }
  return `I've ingested the schematic, people, and OSINT findings for ${building}. Ask about entrances and access control, the people roster, the 3D layout, camera coverage, network exposure, or where the weak points are — and I'll pull from the recon.`;
}
