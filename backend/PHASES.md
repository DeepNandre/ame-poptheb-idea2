# Pipeline Phases

## Phase A0 — Schematic Discovery
Agent searches public sources (planning portals, venue hire packs, FOI) to locate floor plans and architectural documents for the building.

## Phase A1 — Ingestion & 3D Mapping
Ingests discovered documents, extracts spatial features (stairs, lifts, entry points, restricted zones), and builds a floor-by-floor model. Runs after A0.

## Phase B — People Research *(parallel with A1)* (Done API search enrichment with public house (get head people))
Scouts the organisation's website, searches LinkedIn, then enriches each person found via API. Surfaces roles like head of security, facilities manager, reception.

## Phase C — OSINT *(parallel with A1 + B)*
Passive scan for cameras (Shodan, public feeds), access control systems (RFID/NFC via job postings/contracts), and internet-exposed services.

## Phase D — Simulation
AI agents simulate employees and model how an ethical approach would play out — approach vectors, social engineering scenarios, challenge/response protocols — using data from all prior phases.
