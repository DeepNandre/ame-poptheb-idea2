"""Request/response models for the blueprint pipeline API.

Status payloads (discover/ingest progress, graph, routes) are assembled as plain dicts
in the router because they're read live off disk and vary in shape; the pydantic models
here cover the typed request bodies and the stable summary responses.
"""

from pydantic import BaseModel


class AddBuildingRequest(BaseModel):
    address: str


class OccupantsRequest(BaseModel):
    """Override the address used for the reverse-address lookup (defaults to the one the
    building was added with), and whether to drop dissolved companies."""

    address: str | None = None
    active_only: bool = True


class PeopleRequest(BaseModel):
    """The named humans behind the building's occupant companies: Companies House officers,
    optionally enriched with LinkedIn + email via Apollo. Demo defaults are generous."""

    max_companies: int = 25
    enrich: bool = True


class EnrichRequest(BaseModel):
    """Single-person enrichment: a name and where they work → LinkedIn + work email."""

    name: str
    workplace: str = ""
    domain: str = ""


class BuildingSummary(BaseModel):
    id: str
    enriched: bool
    doc_count: int
    overall_status: str


class AddBuildingResponse(BaseModel):
    id: str
    created: bool
    matched_existing: bool
    match_score: float
    enriched: bool
    doc_count: int


class JobAccepted(BaseModel):
    job_id: str
    building: str
    phase: str
    status: str
