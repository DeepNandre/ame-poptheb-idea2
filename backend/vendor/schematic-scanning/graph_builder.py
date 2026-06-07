"""
graph_builder.py — Merge per-floor JSON into a NetworkX graph, export graph.json.

Usage:
    python graph_builder.py
"""

import json
import re
from pathlib import Path
from statistics import median
import networkx as nx

FLOORS_DIR = Path(__file__).parent / "floors"
OUT = Path(__file__).parent / "graph.json"
STOREY_HEIGHT = 3.5  # metres per floor


# Floor level → z height mapping
def level_to_z(level) -> float:
    if isinstance(level, str):  # L0a, L0b
        return 0.0 if level == "L0a" else 0.15
    return float(level) * STOREY_HEIGHT


def load_floors(floors_dir: Path = FLOORS_DIR) -> list[dict]:
    floors = []
    for f in sorted(floors_dir.glob("*.json")):
        if "_raw" in f.name or "_labels" in f.name:
            continue
        try:
            data = json.loads(f.read_text())
            if "rooms" in data:
                floors.append(data)
        except json.JSONDecodeError as e:
            print(f"WARN: skipping {f.name}: {e}")
    return floors


def build_graph(floors: list[dict]) -> nx.Graph:
    G = nx.Graph()

    # Pass 1: add all nodes
    for floor in floors:
        lvl = floor["floor_level"]
        z = level_to_z(lvl)
        for room in floor["rooms"]:
            bounds = room.get("approximate_bounds", {})
            w = bounds.get("w", 0.1)
            h = bounds.get("h", 0.1)
            cx = bounds.get("x", 0.5) + w / 2
            cy = bounds.get("y", 0.5) + h / 2
            # Carry the richer semantics from extract.py through to the viewer.
            # type stays in the existing enum (TYPE_COLORS already covers it); the
            # extra fields are additive — the viewer ignores keys it doesn't read,
            # and `environment` is here for the later indoor/outdoor layer work.
            extra = {
                k: room[k]
                for k in (
                    "function",
                    "environment",
                    "fixtures",
                    "confidence",
                    "label_source",
                )
                if k in room
            }
            G.add_node(
                room["room_id"],
                label=room.get("label", ""),
                type=room.get("type", "unknown"),
                floor=lvl,
                x=round(cx, 4),
                y=round(cy, 4),
                z=round(z, 4),
                w=round(w, 4),
                h=round(h, 4),
                **extra,
            )

        # Add core elements as nodes too (no bounds in source → small default footprint)
        for core in floor.get("core_elements", []):
            pos = core.get("position", {})
            G.add_node(
                core["id"],
                label=core["type"].title(),
                type="core",
                floor=lvl,
                x=round(pos.get("x", 0.5), 4),
                y=round(pos.get("y", 0.5), 4),
                z=round(z, 4),
                w=0.04,
                h=0.04,
            )

    # Pass 1b: snap each stair core to ONE canonical plan footprint across floors.
    # Recognition places the same logical stair (e.g. STAIR-01 / STAIR-01-L2 / …)
    # at slightly — sometimes wildly — different normalised (x, y) on each storey,
    # so the rendered run wanders sideways between floors and the inter-floor
    # proximity match below can miss. A real stair core has a fixed footprint on
    # every floor, so collapse each core's per-floor positions to their median.
    stair_groups: dict[str, list[str]] = {}
    for nid, data in G.nodes(data=True):
        if data.get("type") == "core" and "stair" in str(data.get("label", "")).lower():
            base = re.sub(r"-L[^-]*$", "", nid)  # STAIR-01-L2 → STAIR-01
            stair_groups.setdefault(base, []).append(nid)

    snapped = 0
    for base, nids in stair_groups.items():
        if len(nids) < 2:
            continue
        cx = round(median(G.nodes[n]["x"] for n in nids), 4)
        cy = round(median(G.nodes[n]["y"] for n in nids), 4)
        for n in nids:
            if G.nodes[n]["x"] != cx or G.nodes[n]["y"] != cy:
                snapped += 1
            G.nodes[n]["x"] = cx
            G.nodes[n]["y"] = cy

    if snapped:
        print(
            f"Snapped {snapped} stair node(s) across {len(stair_groups)} core(s) to a canonical footprint"
        )

    # Pass 2: intra-floor edges from neighbours[]
    for floor in floors:
        for room in floor["rooms"]:
            rid = room["room_id"]
            for neighbour in room.get("neighbours", []):
                if G.has_node(neighbour) and not G.has_edge(rid, neighbour):
                    G.add_edge(rid, neighbour, type="intra")

    # Pass 3: inter-floor edges by matching core element positions
    # Group core elements by floor
    cores_by_floor: dict[str, list] = {}
    for floor in floors:
        lvl = str(floor["floor_level"])
        cores_by_floor[lvl] = []
        for core in floor.get("core_elements", []):
            nid = core["id"]
            if G.has_node(nid):
                data = G.nodes[nid]
                cores_by_floor[lvl].append(
                    {"id": nid, "x": data["x"], "y": data["y"], "type": core["type"]}
                )

    floor_levels = sorted(
        cores_by_floor.keys(),
        key=lambda x: float(x.replace("L0a", "-0.1").replace("L0b", "-0.05")),
    )

    inter_edge_count = 0
    for i in range(len(floor_levels) - 1):
        lower_lvl = floor_levels[i]
        upper_lvl = floor_levels[i + 1]
        lower_cores = cores_by_floor.get(lower_lvl, [])
        upper_cores = cores_by_floor.get(upper_lvl, [])

        for lc in lower_cores:
            for uc in upper_cores:
                if lc["type"] == uc["type"]:
                    dist = ((lc["x"] - uc["x"]) ** 2 + (lc["y"] - uc["y"]) ** 2) ** 0.5
                    if dist < 0.08:  # proximity threshold
                        if not G.has_edge(lc["id"], uc["id"]):
                            G.add_edge(lc["id"], uc["id"], type="inter")
                            inter_edge_count += 1

    print(
        f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges ({inter_edge_count} inter-floor)"
    )

    # Sanity checks
    node_ids = list(G.nodes())
    assert len(node_ids) == len(set(node_ids)), "Duplicate node IDs!"
    if inter_edge_count == 0:
        print(
            "WARN: 0 inter-floor edges — check core_element positions match across floors"
        )

    return G


def collect_doors(floors: list[dict]) -> list[dict]:
    """Flatten the per-floor recognised `doors` into one list, stamped with the floor
    level. door_graph_builder uses these as real portal positions; floors with no
    `doors` key (extracted before door recognition) simply contribute nothing and fall
    back to the adjacency heuristic."""
    out = []
    for floor in floors:
        lvl = floor["floor_level"]
        for d in floor.get("doors", []):
            out.append(
                {
                    "door_id": d.get("door_id"),
                    "floor": lvl,
                    "x": d.get("x"),
                    "y": d.get("y"),
                    "connects": d.get("connects", []),
                    "kind": d.get("kind", "door"),
                    "state": d.get("state", "open"),
                }
            )
    return out


def export(G: nx.Graph, floors: list[dict]) -> dict:
    nodes = [{"id": nid, **G.nodes[nid]} for nid in G.nodes()]
    edges = [{"source": u, "target": v, **G.edges[u, v]} for u, v in G.edges()]
    doors = collect_doors(floors)
    floor_meta = []
    for floor in floors:
        lvl = floor["floor_level"]
        floor_meta.append(
            {
                "level": lvl,
                "z": level_to_z(lvl),
                "label": f"Level {lvl}",
            }
        )

    return {"nodes": nodes, "edges": edges, "doors": doors, "floors": floor_meta}


def run(floors_dir, out_path) -> dict:
    """Merge per-floor JSON in floors_dir into a graph and write out_path (graph.json).

    Returns the graph dict. Raises ValueError if no floor JSON was found, so the
    caller can fail the ingest job rather than write an empty graph.
    """
    floors_dir, out_path = Path(floors_dir), Path(out_path)
    floors = load_floors(floors_dir)
    if not floors:
        raise ValueError(
            f"no floor JSON in {floors_dir} — extract step produced nothing"
        )
    G = build_graph(floors)
    data = export(G, floors)
    out_path.write_text(json.dumps(data, indent=2))
    print(f"Wrote {out_path} ({len(data['nodes'])} nodes, {len(data['edges'])} edges)")
    return data


def main():
    floors = load_floors()
    if not floors:
        print("No floor JSON files found in floors/. Run extract.py first.")
        print("Or use the sample graph.json for the Three.js demo.")
        return

    G = build_graph(floors)
    data = export(G, floors)
    OUT.write_text(json.dumps(data, indent=2))
    print(f"Wrote {OUT} ({len(data['nodes'])} nodes, {len(data['edges'])} edges)")


if __name__ == "__main__":
    main()
