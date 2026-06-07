# Occupancy & People API

Part of the **Blueprint Pipeline API** (`pipeline_app.py`). Given a building, these
endpoints answer three questions:

1. **Who is registered in this building?** — the companies whose registered office sits
   at the building's postcode (Companies House), plus the likely building manager/owner.
2. **Who are the people behind those companies, and where do they work?** — each
   company's current directors (Companies House officers), enriched with a LinkedIn
   profile and work email (Apollo).
3. **Enrich one person** — a name and where they work in, their LinkedIn + email out.

The occupancy and people lookups run **asynchronously as pollable background jobs**
(same `POST` → `202` → poll-`GET` pattern as discovery/ingestion). Enrichment of a single
person is **synchronous**.

---

## Setup

Needs two keys in `backend/.env` (or the project-root `.env`, both gitignored):

```
COMPANIES_HOUSE_API_KEY=your_companies_house_key   # free, no incorporation needed
APOLLO_API_KEY=your_apollo_key
```

Get a free Companies House key at
[developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk)
— no company required.

Serve the pipeline app:

```bash
uv run uvicorn pipeline_app:app --port 8001        # serve
uv run uvicorn pipeline_app:app --reload           # dev (state is on disk, safe to reload)
```

Interactive docs (Swagger UI): `http://localhost:8001/docs`.

---

## The flow

```
POST /buildings                       add a building by address     -> {id}
POST /buildings/{id}/occupants        start occupancy scrape        -> 202
GET  /buildings/{id}/occupants        poll until status=complete    -> companies + prime_target
POST /buildings/{id}/people           start people lookup           -> 202
GET  /buildings/{id}/people           poll until status=complete    -> people + where they work
POST /buildings/enrich                one person, name + workplace  -> LinkedIn + email
```

A background job moves through `running` → `complete` | `failed`. Poll the matching `GET`
until `status` is no longer `running`; the result payload is attached once it lands.

---

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/buildings/{id}/occupants` | `{address?, active_only?}` | `202` job accepted (`{job_id, phase, postcode, status}`) |
| `GET` | `/buildings/{id}/occupants` | — | job status; once complete: `companies`, `fhrs`, `prime_target`, `owner_note` |
| `POST` | `/buildings/{id}/people` | `{max_companies?, enrich?}` | `202` job accepted |
| `GET` | `/buildings/{id}/people` | — | job status; once complete: `people`, `by_company` |
| `POST` | `/buildings/enrich` | `{name, workplace?, domain?}` | enriched person, or `404` if no match |

### `POST /buildings/{id}/occupants`

Reverse-address lookup of the companies registered at the building's postcode. The
postcode is taken from the address the building was added with — override with
`address` in the body. `active_only` (default `true`) drops dissolved companies.

Data sources, joined on the postcode:

- **Companies House** `advanced-search` — every company whose **registered office** is at
  the postcode. A legal address, not always the trading desk: a spinout can register at
  the landlord's address while sitting elsewhere. Treat as a strong lead, not proof.
- **FHRS** (Food Standards Agency) — food businesses **physically** at the postcode, a
  cross-check on the registered-office list.

The response also infers a **`prime_target`** — the likely building manager/owner — from
the occupancy fingerprint: the dominant `C/O <agent>` registered against many tenants, plus
any active on-site company whose name reads like a landlord (management / estates /
ventures / innovation tokens). Freeholder/ownership needs HM Land Registry CCOD/OCOD
(no keyless API) — flagged in `owner_note`, not resolved.

**Status codes:** `202` accepted · `409` already running · `422` no address on record / no
UK postcode in the address · `503` `COMPANIES_HOUSE_API_KEY` missing or placeholder.

### `POST /buildings/{id}/people`

The named humans behind the building's occupant companies. For each **active** company
(capped at `max_companies`, default `25`), it pulls the company's **current officers /
directors from Companies House** — real people legally tied to the company. When
`enrich` is `true` (default), each person is matched through Apollo's `people/match` for a
LinkedIn URL + work email. Every person is tagged with the company they work at.

Requires `/occupants` to have run first (`422` otherwise).

> **Why Companies House officers and not an Apollo roster?** The Apollo REST key has
> org/company **search gated** (`mixed_companies/search` → "Api key required"), so a
> roster-per-company isn't available on it — only single-person `people/match` works.
> The building's micro-tenant spinouts aren't in Apollo's index anyway, but their
> directors are public record at Companies House. So Companies House is the roster source
> and Apollo is the enricher.

**Status codes:** `202` accepted · `409` already running · `422` no occupants yet (run
`/occupants` first).

### `POST /buildings/enrich`

Single-person enrichment via Apollo `people/match`. Synchronous — one person, one call.
`workplace` (company name) and/or `domain` sharpen the match.

**Status codes:** `200` matched · `404` Apollo could not match the person · `422` no name ·
`502` Apollo request failed.

---

## Examples

```bash
# 1. Add a building (returns its id/slug)
curl -X POST localhost:8001/buildings -H 'content-type: application/json' \
     -d '{"address": "46 Grafton Street, Manchester M13 9NT"}'
# {"id": "m13-9nt", ...}

# 2. Start the occupancy scrape
curl -X POST localhost:8001/buildings/m13-9nt/occupants \
     -H 'content-type: application/json' -d '{"active_only": true}'
# {"job_id": "m13-9nt:occupants", "phase": "occupants", "postcode": "M13 9NT", "status": "running"}

# 3. Poll until complete
curl localhost:8001/buildings/m13-9nt/occupants
# {"status": "complete", "company_count": 30, "postcode": "M13 9NT",
#  "companies": [{"number": "05177409",
#                 "name": "UNIVERSITY OF MANCHESTER INNOVATION FACTORY LIMITED",
#                 "status": "active", "address": "Core Technology Facility, Manchester, M13 9NT"}, ...],
#  "prime_target": {"care_of_agents": [{"agent": "Umif", "tenants": 11}, ...],
#                   "manager_named_companies": [{"number": "05177409", "name": "...INNOVATION FACTORY..."}]},
#  "owner_note": "Freeholder/owner not resolved — HM Land Registry ..."}

# 4. Start the people lookup (CH officers + Apollo enrich)
curl -X POST localhost:8001/buildings/m13-9nt/people \
     -H 'content-type: application/json' -d '{"max_companies": 25, "enrich": true}'

# 5. Poll until complete
curl localhost:8001/buildings/m13-9nt/people
# {"status": "complete", "people_count": 13, "companies_processed": 6, "enriched": 3,
#  "people": [{"name": "Maria Iliut", "role": "director", "company": "GRAFINE LIMITED",
#              "company_number": "10815567", "email": null, "email_verified": false,
#              "linkedin_url": "http://www.linkedin.com/in/maria-iliut-7296b0172",
#              "sources": ["companies_house", "apollo"]}, ...],
#  "by_company": [{"company": "GRAFINE LIMITED", "number": "10815567",
#                  "people": 3, "enriched": 1}, ...]}

# Enrich one person directly
curl -X POST localhost:8001/buildings/enrich -H 'content-type: application/json' \
     -d '{"name": "Brian Chesky", "workplace": "Airbnb"}'
# {"name": "Brian Chesky", "title": "Co-founder, CEO", "email": "brian@airbnb.com",
#  "email_verified": true, "linkedin_url": "http://www.linkedin.com/in/brianchesky",
#  "organization": "Airbnb", "organization_domain": "airbnb.com", "sources": ["apollo"]}
```

---

## Files

```
routers/buildings.py        the endpoints (occupants / people / enrich)
workers/occupants.py        occupancy job: building.py search -> occupants.json
workers/occupant_people.py  people job: CH officers + Apollo enrich -> people.json
building.py                 Companies House + FHRS reverse-address engine (+ officers_at)
apollo_people.py            Apollo client (match_person for enrichment)
models.py                   OccupantsRequest / PeopleRequest / EnrichRequest
```

Artifacts (`occupants.json`, `people.json`) are written into `buildings/<id>/`; the `GET`
endpoints serve them back. Job lifecycle persists to `jobs.json`, so a poll survives a
server reload.

---

## Security & scope

- **Registered-office ≠ trading desk.** Companies House gives a legal address; a company
  can register at one address and trade at another. The occupancy list is a lead, not proof
  of physical presence — `prime_target` and FHRS cross-checks exist to triangulate.
- Companies House and FHRS are open public-record data. Apollo enrichment surfaces
  business contact data and spends Apollo credits per reveal.
- Intended for authorised security research and testing only.
```
