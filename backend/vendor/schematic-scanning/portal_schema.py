"""
portal_schema.py — Shared contract for the security portal graph.

ONE source of truth imported by both extractors (vector/vision) and the graph
builder, so they cannot drift. Holds: the per-floor schema shape, normalize()
(PDF/pixel point -> 0..1 against a drawing-area bbox), and validate_floor()
(enforces the 0..1 coordinate contract + required keys at the schema boundary).

Coordinate contract (eng-review decision #2): every coordinate written to a
per-floor file is normalized 0.0-1.0 relative to the same drawing-area bbox. The
cross-floor stair/lift matcher only works if all floors share that space, so the
assert here is the seam that keeps a vector floor and a vision floor mergeable.

Per-floor file shape (security_floors/<stem>.json):

    {
      "floor": 0,                       # int level, or "L0a"/"L0b" for split ground
      "perimeter": [[x, y], ...],       # optional building envelope, may be []
      "spaces": [
        { "id": "S0-01", "label": "Lobby", "type": "circulation",
          "bounds": {"x": .., "y": .., "w": .., "h": ..} }   # bounds 0..1, for render
      ],
      "portals": [
        { "id": "P0-01", "a": "OUTSIDE", "b": "S0-01",
          "kind": "door|opening|stair|lift", "is_external": true,
          "pos": [x, y],                # opening midpoint / symbol centroid, 0..1
          "core_id": "STAIR-01" }       # stair|lift only: shared id across floors
      ]
    }
"""

PORTAL_KINDS = {"door", "opening", "stair", "lift", "window"}
VERTICAL_KINDS = {"stair", "lift"}  # portals that link floors, not rooms
SPACE_TYPES = {
    "circulation",
    "office",
    "plant",
    "core",
    "amenity",
    "external",
    "unknown",
}
OUTSIDE = "OUTSIDE"  # sentinel endpoint = building exterior (an entrance/exit)
UNKNOWN = "UNKNOWN"  # sentinel endpoint = unresolved, flagged for manual pass


def normalize(pt, bbox):
    """Map a point to 0..1 within bbox=(x0, y0, x1, y1). Zero-span axis -> 0.0
    (no div-by-zero — a degenerate drawing area must not crash extraction)."""
    x, y = pt
    x0, y0, x1, y1 = bbox
    w = x1 - x0
    h = y1 - y0
    nx = (x - x0) / w if w else 0.0
    ny = (y - y0) / h if h else 0.0
    return [nx, ny]


def _in_unit(v):
    return isinstance(v, (int, float)) and -1e-9 <= v <= 1 + 1e-9


def validate_floor(data):
    """Raise ValueError if `data` violates the per-floor contract. Returns data
    on success so callers can `floor = validate_floor(json.load(...))`."""
    for key in ("floor", "spaces", "portals"):
        if key not in data:
            raise ValueError(f"floor missing required key: {key!r}")

    space_ids = set()
    for s in data["spaces"]:
        sid = s.get("id")
        if not sid:
            raise ValueError("space missing id")
        if sid in space_ids:
            raise ValueError(f"duplicate space id: {sid!r}")
        space_ids.add(sid)
        if s.get("type") and s["type"] not in SPACE_TYPES:
            raise ValueError(f"{sid}: bad space type {s['type']!r}")
        b = s.get("bounds")
        if b is not None:
            for k in ("x", "y", "w", "h"):
                if k not in b or not _in_unit(b[k]):
                    raise ValueError(f"{sid}: bounds.{k} missing or out of 0..1: {b}")

    valid_ends = space_ids | {OUTSIDE, UNKNOWN}
    portal_ids = set()
    for p in data["portals"]:
        pid = p.get("id")
        if not pid:
            raise ValueError("portal missing id")
        if pid in portal_ids:
            raise ValueError(f"duplicate portal id: {pid!r}")
        portal_ids.add(pid)
        if p.get("kind") not in PORTAL_KINDS:
            raise ValueError(f"{pid}: bad portal kind {p.get('kind')!r}")
        for end in ("a", "b"):
            if p.get(end) not in valid_ends:
                raise ValueError(
                    f"{pid}: endpoint {end}={p.get(end)!r} is not a space/OUTSIDE/UNKNOWN"
                )
        pos = p.get("pos")
        if not (
            isinstance(pos, (list, tuple))
            and len(pos) == 2
            and all(_in_unit(c) for c in pos)
        ):
            raise ValueError(f"{pid}: pos missing or out of 0..1: {pos}")
        is_ext = p.get("a") == OUTSIDE or p.get("b") == OUTSIDE
        if bool(p.get("is_external")) != is_ext:
            raise ValueError(
                f"{pid}: is_external={p.get('is_external')} disagrees with endpoints {p.get('a')}/{p.get('b')}"
            )
        if p["kind"] in VERTICAL_KINDS and not p.get("core_id"):
            raise ValueError(
                f"{pid}: {p['kind']} portal needs a core_id for cross-floor linking"
            )
    return data
