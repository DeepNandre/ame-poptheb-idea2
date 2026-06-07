// Building Scanner — investigation dataset.
//
// Everything here is sourced from the PUBLIC planning record: Southwark's Idox
// register and the submitted drawing set for 22/AP/2295. Scope is deliberately
// the planning-permission documents only — not any contractor fire / security /
// MEP construction-issue set, which is not public and is not used here.
// Background: building-scanner/CONTEXT.md and Arbor-22-AP-2295/WORKFLOW.md.

export type DocType =
  | "Register"
  | "DAS"
  | "Site plan"
  | "GA plan"
  | "Basement"
  | "Section"
  // live results from the proxy can carry other labels (Elevation, Roof plan, …)
  | (string & {});

export type Resolution = "analogue" | "unresolved" | "anchor";

export type TraceStatus = "done" | "active" | "open";

export interface ClassifiedDoc {
  id: string;
  file: string;
  docType: DocType;
  level?: string;
  reveals: string[];
  /** Why the classifier assigned this type — the signal it keyed on. */
  basis: string;
  confidence: number;
  /** Direct link to the document on the council portal (live results). */
  url?: string;
}

export interface LogicItem {
  label: string;
  detail: string;
  /** Drawing the read was taken from. */
  source: string;
}

export interface InsideLogic {
  entrances: LogicItem[];
  cores: LogicItem[];
  publicRoutes: LogicItem[];
  serviceRoutes: LogicItem[];
  plant: LogicItem[];
}

export interface TraceStep {
  title: string;
  detail: string;
  status: TraceStatus;
  ref?: string;
}

export interface Register {
  authority: string;
  system: string;
  ref: string;
  /** Public documents-tab URL, when resolved. */
  url?: string;
  docCount?: number;
}

export interface Target {
  id: string;
  name: string;
  address: string;
  planning: string;
  status: string;
  resolution: Resolution;
  coords: [number, number];
  confidence: number;
  summary: string;
  register: Register;
  documents: ClassifiedDoc[];
  insideLogic: InsideLogic;
  trace: TraceStep[];
}

export const DOC_TYPES: { type: DocType; blurb: string }[] = [
  { type: "Register", blurb: "Index of the full submitted drawing set" },
  { type: "DAS", blurb: "Design & Access Statement — the narrative" },
  { type: "Site plan", blurb: "Building in context, approach routes" },
  { type: "GA plan", blurb: "General Arrangement — a floor-plate layout" },
  { type: "Basement", blurb: "Plant, parking, back-of-house" },
  { type: "Section", blurb: "Vertical relationships, floor heights" },
];

const SOUTHWARK_DOCS_URL =
  "https://planning.southwark.gov.uk/online-applications/applicationDetails.do?activeTab=documents&keyVal=RE6N54KB00300";

const building1Docs: ClassifiedDoc[] = [
  {
    id: "register",
    file: "00_DRAWING_REGISTER.pdf",
    docType: "Register",
    reveals: ["Full sheet list", "Naming scheme", "What else exists to pull"],
    basis: "Filename + tabular sheet index, no drawing frame.",
    confidence: 99,
  },
  {
    id: "das",
    file: "DAS_PART_01.pdf",
    docType: "DAS",
    reveals: ["Entrance strategy", "Circulation logic", "Front-of-house vs servicing", "Accessibility"],
    basis: "Title contains 'Design & Access Statement'; prose document, not a sheet.",
    confidence: 98,
  },
  {
    id: "pa0202",
    file: "PA0202_PROPOSED_SITE_PLAN.pdf",
    docType: "Site plan",
    level: "Site",
    reveals: ["Footprint in context", "Approach routes", "Street frontage"],
    basis: "Title block reads 'PROPOSED SITE PLAN'; site-scale, no internal partitions.",
    confidence: 96,
  },
  {
    id: "pa1997",
    file: "PA1997_BASEMENT.pdf",
    docType: "Basement",
    level: "Basement",
    reveals: ["Plant rooms", "Parking", "Back-of-house"],
    basis: "Title block reads 'BASEMENT'; negative level, plant/parking hatching.",
    confidence: 95,
  },
  {
    id: "pa1998",
    file: "PA1998_BASEMENT_B1.pdf",
    docType: "Basement",
    level: "Basement B1",
    reveals: ["Lower plant", "Tanks / stores", "Servicing"],
    basis: "Title block 'BASEMENT B1'; second negative level.",
    confidence: 95,
  },
  {
    id: "pa1999",
    file: "PA1999_GROUND_FLOOR_LOWER.pdf",
    docType: "GA plan",
    level: "Lower ground",
    reveals: ["Secondary access", "Cycle entry", "Servicing arrival"],
    basis: "'GROUND FLOOR LOWER' + GA frame; entrance + cycle annotations.",
    confidence: 94,
  },
  {
    id: "pa2000",
    file: "PA2000_GROUND_FLOOR_UPPER.pdf",
    docType: "GA plan",
    level: "Upper ground",
    reveals: ["Office entrance", "Reception", "Lift core", "Retail frontage"],
    basis: "Legend labels 'Office Entrance' / 'Office Reception'; ground-level GA.",
    confidence: 97,
  },
  {
    id: "pa2001",
    file: "PA2001_LEVEL_1_GA.pdf",
    docType: "GA plan",
    level: "Level 1",
    reveals: ["First office / amenity floor", "Core position"],
    basis: "'LEVEL 1 GA' in title block.",
    confidence: 96,
  },
  {
    id: "pa2002",
    file: "PA2002_LEVEL_2-5_GA.pdf",
    docType: "GA plan",
    level: "Levels 2–5",
    reveals: ["Typical low-rise plate", "Core footprint"],
    basis: "'LEVEL 2-5 GA'; repeated typical-floor layout.",
    confidence: 96,
  },
  {
    id: "pa2006",
    file: "PA2006_LEVEL_6-9_GA.pdf",
    docType: "GA plan",
    level: "Levels 6–9",
    reveals: ["Typical plate", "Core continuity"],
    basis: "'LEVEL 6-9 GA'; identical core position.",
    confidence: 96,
  },
  {
    id: "pa2010",
    file: "PA2010_LEVEL_10-13_GA.pdf",
    docType: "GA plan",
    level: "Levels 10–13",
    reveals: ["Mid-rise plate", "Core continuity"],
    basis: "'LEVEL 10-13 GA'.",
    confidence: 96,
  },
  {
    id: "pa2014",
    file: "PA2014_LEVEL_14-17_GA.pdf",
    docType: "GA plan",
    level: "Levels 14–17",
    reveals: ["High-rise plate", "Core continuity"],
    basis: "'LEVEL 14-17 GA'.",
    confidence: 96,
  },
  {
    id: "pa2018",
    file: "PA2018_ROOF_GA.pdf",
    docType: "GA plan",
    level: "Roof",
    reveals: ["Roof plant", "Terraces", "Top of core"],
    basis: "'ROOF GA'; plant enclosures + terrace zones.",
    confidence: 95,
  },
  {
    id: "pa2250",
    file: "PA2250_SECTION_AA.pdf",
    docType: "Section",
    reveals: ["Floor-to-floor heights", "Vertical stacking", "Basement depth"],
    basis: "'SECTION AA'; vertical cut, level datums.",
    confidence: 97,
  },
  {
    id: "pa2251",
    file: "PA2251_SECTION_BB.pdf",
    docType: "Section",
    reveals: ["Cross relationships", "Core in section"],
    basis: "'SECTION BB'; orthogonal vertical cut.",
    confidence: 97,
  },
];

const building1Logic: InsideLogic = {
  entrances: [
    {
      label: "Main office entrance — upper ground",
      detail: "Public-facing front door into the reception hall, set off the street frontage.",
      source: "PA2000",
    },
    {
      label: "Lower-ground secondary access + cycle entry",
      detail: "Separate cycle route and back entrance keep arrival flows apart from the main lobby.",
      source: "PA1999",
    },
  ],
  cores: [
    {
      label: "Central lift + stair core",
      detail: "Same footprint repeats on every typical plate L2–L17 — the spine that organises each floor.",
      source: "PA2002 · PA2006 · PA2010 · PA2014",
    },
  ],
  publicRoutes: [
    {
      label: "Reception → lobby → lift core",
      detail: "Front-of-house sequence a visitor walks; lifts gate access to the floors above.",
      source: "PA2000",
    },
    {
      label: "Retail frontage at ground",
      detail: "Use Class E retail addresses the street, separate from the office lobby.",
      source: "PA0202 · PA2000",
    },
  ],
  serviceRoutes: [
    {
      label: "Servicing / loading at lower ground",
      detail: "Goods and refuse arrive below the public entrance, out of sight of the lobby.",
      source: "PA1999",
    },
    {
      label: "Refuse + cycle stores",
      detail: "Back-of-house stores feed the service core, not the public route.",
      source: "PA1997 · PA1999",
    },
  ],
  plant: [
    {
      label: "Basement plant + parking",
      detail: "Two negative levels carry the heavy plant, tanks and parking.",
      source: "PA1997 · PA1998",
    },
    {
      label: "Roof plant + terraces",
      detail: "Top-of-building plant enclosure with amenity terraces alongside.",
      source: "PA2018",
    },
  ],
};

const emptyLogic: InsideLogic = {
  entrances: [],
  cores: [],
  publicRoutes: [],
  serviceRoutes: [],
  plant: [],
};

export const TARGETS: Target[] = [
  {
    id: "building-1",
    name: "Building 1",
    address: "Bankside Yards, Blackfriars Road",
    planning: "22/AP/2295",
    status: "15 public drawings classified",
    resolution: "analogue",
    coords: [-0.1057, 51.5078],
    confidence: 96,
    summary:
      "Fully resolved. A separate 18-storey concept office — same developer, architect and site as Arbor, so a near-perfect study analogue. The complete submitted set is in hand.",
    register: {
      authority: "Southwark",
      system: "Idox Public Access",
      ref: "22/AP/2295 · Granted",
      url: SOUTHWARK_DOCS_URL,
      docCount: 206,
    },
    documents: building1Docs,
    insideLogic: building1Logic,
    trace: [
      {
        title: "Found via legacy-site search",
        detail: "Searching 'Ludgate House' in Southwark's Idox register surfaced the application where the brand name returned nothing.",
        status: "done",
        ref: "22/AP/2295",
      },
      {
        title: "Documents tab opened",
        detail: "206 documents on the application; pulled the register, DAS, GA plans and sections.",
        status: "done",
      },
      {
        title: "Set downloaded & verified",
        detail: "15 PDFs — each checked for %PDF header, sane page count and %%EOF. Zero failures.",
        status: "done",
      },
      {
        title: "Confirmed as analogue, not Arbor",
        detail: "Sheet PA2000's own legend labels 'Building 3, Arbor' while the title block reads 'Building 1'. This set is the neighbour, not the target.",
        status: "active",
      },
    ],
  },
  {
    id: "arbor",
    name: "Arbor / Building 3",
    address: "Bankside Yards, SE1 9AX",
    planning: "Trace from 12/AP/3940",
    status: "Identity resolved, drawing set pending",
    resolution: "unresolved",
    coords: [-0.1048, 51.5084],
    confidence: 72,
    summary:
      "The real target. Identity is now nailed down — Arbor is 'Building 3', a 19-storey office completed 2022/23 — but its own detailed drawing set still has to be pulled from the masterplan consent chain.",
    register: {
      authority: "Southwark",
      system: "Idox Public Access",
      ref: "12/AP/3940 (outline) · 18/AP/3696 (site-wide)",
    },
    documents: [],
    insideLogic: emptyLogic,
    trace: [
      {
        title: "Brand-name search failed",
        detail: "'Arbor' in the register matched only 'Arboricultural'. The name on the door is rarely the name on the application.",
        status: "done",
      },
      {
        title: "Identity via press + practice pages",
        detail: "Developer Native Land, architect PLP, contractor Multiplex — the trail that connects the brand to a scheme.",
        status: "done",
      },
      {
        title: "Legacy site resolved",
        detail: "The plot was Ludgate House, 245 Blackfriars Road — demolished for the scheme, and the key the register actually indexes on.",
        status: "done",
        ref: "Ludgate House",
      },
      {
        title: "Masterplan located",
        detail: "Outline consent 12/AP/3940 with site-wide consent 18/AP/3696 anchor the whole Bankside Yards chain.",
        status: "done",
        ref: "12/AP/3940",
      },
      {
        title: "Arbor = Building 3",
        detail: "19-storey, ~223,000 sq ft office, first delivered, completed 2022/23. Planning won 2014, +3 storeys approved 2018.",
        status: "active",
      },
      {
        title: "Detailed ref not yet pinned",
        detail: "Next: follow the reserved-matters and amendment applications off 12/AP/3940 for 'Building 3' to reach Arbor's own GA set.",
        status: "open",
      },
    ],
  },
  {
    id: "ludgate",
    name: "Ludgate House (legacy)",
    address: "245 Blackfriars Road",
    planning: "Register search key",
    status: "Identity anchor",
    resolution: "anchor",
    coords: [-0.1042, 51.509],
    confidence: 89,
    summary:
      "Not a target to scan — the key that unlocks the register. The demolished tower's address is what the planning system files Bankside Yards under, so it is how the brand names get resolved to applications.",
    register: {
      authority: "Southwark",
      system: "Idox Public Access",
      ref: "Search term, not an application",
    },
    documents: [],
    insideLogic: emptyLogic,
    trace: [
      {
        title: "Old tower of the site",
        detail: "Ludgate House, 245 Blackfriars Road — demolished, with Sampson House, for the Bankside Yards redevelopment.",
        status: "done",
      },
      {
        title: "Used as the register search key",
        detail: "Where 'Arbor' and 'Bankside Yards' fail, 'Ludgate House' returns the scheme's applications.",
        status: "done",
      },
      {
        title: "Anchors brand → planning identity",
        detail: "Every resolved reference in this investigation passes through this address.",
        status: "active",
      },
    ],
  },
  {
    id: "shard",
    name: "The Shard",
    address: "32 London Bridge Street, SE1 9SG",
    planning: "Official published floor plans",
    status: "3D floor schematic",
    resolution: "analogue",
    coords: [-0.0865, 51.5045],
    confidence: 95,
    summary:
      "Google Maps shows the glass exterior. These are The Shard's own published leasing floor plans — Levels 9, 10, 11 and 26 — stacked in 3D over the real tower footprint at their true heights. Select it to raise the schematic.",
    register: {
      authority: "The Shard (official)",
      system: "Published leasing floor plans",
      ref: "Levels 9 · 10 · 11 · 26",
      url: "https://www.the-shard.com/offices/",
      docCount: 4,
    },
    documents: [
      {
        id: "shard-l9",
        file: "The Shard — Level 9 (South) floor plan",
        docType: "GA plan",
        level: "Level 9",
        reveals: ["Floor plate outline", "Central lift/stair core", "Winter garden", "Net lettable area"],
        basis: "Official published leasing floor plan (vector PDF).",
        confidence: 95,
        url: "https://www.the-shard.com/media/zxrpkssr/the-shard-level-9-floor-plan.pdf",
      },
      {
        id: "shard-l11",
        file: "The Shard — Level 11 (North) floor plan",
        docType: "GA plan",
        level: "Level 11",
        reveals: ["Open-plan office", "Meeting rooms", "Winter gardens", "Core position"],
        basis: "Official published leasing floor plan (vector PDF).",
        confidence: 95,
        url: "https://www.the-shard.com/media/5ttjvqjl/download-floorplan.pdf",
      },
      {
        id: "shard-l10",
        file: "The Shard — Level 10 plan & amenities",
        docType: "GA plan",
        level: "Level 10",
        reveals: ["Floor plate", "Winter gardens", "Amenity callouts"],
        basis: "Official leasing particulars (plan page).",
        confidence: 88,
        url: "https://www.the-shard.com/media/022f21fx/the-shard-particulars-l10.pdf",
      },
      {
        id: "shard-l26",
        file: "The Shard — Level 26 plan & amenities",
        docType: "GA plan",
        level: "Level 26",
        reveals: ["Upper office plate", "Core", "Amenity callouts"],
        basis: "Official leasing particulars (plan page).",
        confidence: 88,
        url: "https://www.the-shard.com/media/zttcaonh/the-shard-particulars-l26.pdf",
      },
    ],
    insideLogic: emptyLogic,
    trace: [
      {
        title: "Real published floor plans",
        detail: "Levels 9, 10, 11 and 26 from The Shard's official leasing material — actual architect plans, not estimates.",
        status: "done",
      },
      {
        title: "Stacked in 3D at true heights",
        detail: "Each plan is georeferenced over the tower footprint and lifted to its storey height.",
        status: "active",
      },
      {
        title: "Schematic raised on selection",
        detail: "Selecting The Shard flies the camera in and renders the floor stack out of the building.",
        status: "open",
      },
    ],
  },
];
