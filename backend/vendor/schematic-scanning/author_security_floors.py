"""
author_security_floors.py — Seed the hand-editable security floors.

Manual-first (eng-review decision #4): we do NOT auto-detect doors from vector
geometry yet. Instead we derive a STARTING POINT for the per-floor portal files
from the already-extracted room JSON in floors/, then a human eyeballs each file
against the GA drawing and corrects portal endpoints. This script is the seed
generator, not the source of truth — security_floors/<stem>.json is meant to be
edited by hand afterwards.

Derivation rules (deterministic):
  - external-type rooms are NOT spaces; each (external room, interior neighbour)
    pair becomes an EXTERNAL portal OUTSIDE--interior (an entrance/exit).
  - every other room becomes a space, carrying its bounds for rendering.
  - each interior neighbour pair becomes a `door` portal (intra), deduped.
  - each stair/lift core element becomes a vertical portal joined to its nearest
    interior space, tagged with core_id (its source id) so the builder can link
    it across floors WITHOUT the broken 0.08 auto-matcher. Corridors are dropped.

    python author_security_floors.py        # writes security_floors/*.json
"""

import json
from pathlib import Path

import portal_schema as ps

HERE = Path(__file__).parent
FLOORS_DIR = HERE / "floors"
OUT_DIR = HERE / "security_floors"

# Ground + level 1: the floors the demo needs (entrance criterion lives on L0b).
SEED_SHEETS = [
    "PA1999_GROUND_FLOOR_LOWER",
    "PA2000_GROUND_FLOOR_UPPER",
    "PA2001_LEVEL_1_GA",
]

# Hand-corrections the vision pass missed (eye-balled against the GA PNG).
# The o3 extraction never tagged the upper-ground office/retail frontage as
# `external`, so no entrance was derived there — but the GA sheet labels an
# "Office Entrance". Encode the fix here (keyed by floor_level) so it survives
# re-running this seed generator. pos is the opening on the building frontage.
MANUAL_ENTRANCES = {
    "L0b": [
        {"to": "LL0b-03", "via": "Office Entrance", "pos": [0.5, 0.21]},
        {"to": "LL0b-04", "via": "Retail Entrance", "pos": [0.64, 0.21]},
    ],
}


def centroid(b):
    return (b["x"] + b["w"] / 2, b["y"] + b["h"] / 2)


def midpoint(p, q):
    return [round((p[0] + q[0]) / 2, 4), round((p[1] + q[1]) / 2, 4)]


def author(sheet):
    src = json.loads((FLOORS_DIR / f"{sheet}.json").read_text())
    level = src["floor_level"]
    slug = str(level)

    rooms = {r["room_id"]: r for r in src["rooms"]}
    external_ids = {rid for rid, r in rooms.items() if r.get("type") == "external"}
    interior_ids = [rid for rid in rooms if rid not in external_ids]

    # spaces = interior rooms, carrying bounds
    spaces = []
    cset = set()
    for rid in interior_ids:
        r = rooms[rid]
        b = r.get("approximate_bounds", {"x": 0.5, "y": 0.5, "w": 0.05, "h": 0.05})
        spaces.append(
            {
                "id": rid,
                "label": r.get("label", ""),
                "type": r.get("type", "unknown"),
                "bounds": {k: round(b.get(k, 0.05), 4) for k in ("x", "y", "w", "h")},
            }
        )
        cset.add(rid)

    centroids = {
        rid: centroid(rooms[rid]["approximate_bounds"])
        for rid in rooms
        if "approximate_bounds" in rooms[rid]
    }

    portals = []
    n = 0

    def pid():
        nonlocal n
        n += 1
        return f"P{slug}-{n:02d}"

    # external portals: interior room adjacent to an external-type room = entrance
    for ext in external_ids:
        for nb in rooms[ext].get("neighbours", []):
            if nb in cset:
                pos = (
                    midpoint(centroids[ext], centroids[nb])
                    if ext in centroids
                    else list(centroids[nb])
                )
                portals.append(
                    {
                        "id": pid(),
                        "a": ps.OUTSIDE,
                        "b": nb,
                        "kind": "door",
                        "is_external": True,
                        "pos": pos,
                        "via": rooms[ext].get("label", ""),
                    }
                )

    # intra doors: dedupe interior neighbour pairs
    seen = set()
    for rid in interior_ids:
        for nb in rooms[rid].get("neighbours", []):
            if nb not in cset:
                continue
            key = tuple(sorted((rid, nb)))
            if key in seen:
                continue
            seen.add(key)
            portals.append(
                {
                    "id": pid(),
                    "a": rid,
                    "b": nb,
                    "kind": "door",
                    "is_external": False,
                    "pos": midpoint(centroids[rid], centroids[nb]),
                }
            )

    # vertical portals: stairs/lifts -> nearest interior space, keyed by core_id
    for core in src.get("core_elements", []):
        kind = core.get("type")
        if kind not in ps.VERTICAL_KINDS:
            continue  # corridors etc. are not portals
        cp = (core["position"]["x"], core["position"]["y"])
        nearest = min(
            interior_ids,
            key=lambda rid: (
                (centroids[rid][0] - cp[0]) ** 2 + (centroids[rid][1] - cp[1]) ** 2
            ),
            default=None,
        )
        if nearest is None:
            continue
        # a = the space you step from; b = UNKNOWN (the shaft itself, no room).
        # cross-floor linking is by core_id, not by a room endpoint.
        portals.append(
            {
                "id": pid(),
                "a": nearest,
                "b": ps.UNKNOWN,
                "kind": kind,
                "is_external": False,
                "pos": [round(cp[0], 4), round(cp[1], 4)],
                "core_id": core["id"],
            }
        )

    # hand-corrected entrances the vision pass missed
    for ent in MANUAL_ENTRANCES.get(slug, []):
        if ent["to"] in cset:
            portals.append(
                {
                    "id": pid(),
                    "a": ps.OUTSIDE,
                    "b": ent["to"],
                    "kind": "door",
                    "is_external": True,
                    "pos": ent["pos"],
                    "via": ent["via"],
                }
            )

    floor = {"floor": level, "perimeter": [], "spaces": spaces, "portals": portals}
    ps.validate_floor(floor)
    return slug, floor


def main():
    OUT_DIR.mkdir(exist_ok=True)
    for sheet in SEED_SHEETS:
        slug, floor = author(sheet)
        out = OUT_DIR / f"{sheet}.json"
        out.write_text(json.dumps(floor, indent=2))
        ext = sum(1 for p in floor["portals"] if p["is_external"])
        vert = sum(1 for p in floor["portals"] if p["kind"] in ps.VERTICAL_KINDS)
        print(
            f"{sheet} (floor {floor['floor']}): {len(floor['spaces'])} spaces, "
            f"{len(floor['portals'])} portals ({ext} external, {vert} vertical)"
        )
    print(
        f"\nWrote seeds to {OUT_DIR}/ — hand-correct against the GA PNGs before trusting."
    )


if __name__ == "__main__":
    main()
