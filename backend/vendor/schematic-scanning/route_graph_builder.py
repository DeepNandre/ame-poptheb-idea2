"""
route_graph_builder.py — Collapse the render-oriented portal graph (building.json)
into a navigation skeleton an agent can traverse: routes.json.

building.json is built for the 3D viewer — 1 portal node per floor per core, doors
interleaved with geometry. That's noisy for "how do I get from floor X to floor Y".
This derives a thin traversal graph:

  floor       : one node per level.
  connector   : one node per stairwell / lift SHAFT (collapses the per-floor portal
                chain into a single node), carrying the floors it serves.
  room        : a space, tagged with its floor.
  entrance    : external portal -> the floor it opens onto.

Edges (each carries `rel`):
  serves      : connector -- floor        (this shaft has a landing on this floor)
  transfer    : floor -- floor (via=core) (precomputed vertical hop: "take core-A")
  reaches     : connector -- room         (per floor, `hops` = doors from the landing)
  enters      : entrance -- floor

So an agent reads "L0a -> 14: transfer via core-A" in one lookup, then "from core-A
landing on 14, room X is `hops` doors away" — no geometry, ~3x fewer nodes.

    python route_graph_builder.py        # building.json -> routes.json
"""

import json
from collections import deque
from pathlib import Path

import networkx as nx

HERE = Path(__file__).parent
IN = HERE / "building.json"
OUT = HERE / "routes.json"
VERTICAL = {"stair", "lift"}


def level_sort_key(level) -> float:
    """Bottom-to-top; split ground L0a below L0b."""
    if isinstance(level, str):
        return 0.0 if level == "L0a" else 0.5
    return float(level)


def build_routes(b: dict) -> dict:
    """Collapse a building.json portal graph into the thin traversal skeleton."""
    nodes = {n["id"]: n for n in b["nodes"]}

    G = nx.Graph()
    for n in b["nodes"]:
        G.add_node(n["id"])
    for e in b["edges"]:
        G.add_edge(e["source"], e["target"])

    # Group vertical portals into one connector per core_id (the shaft).
    connectors: dict[str, dict] = {}
    for n in b["nodes"]:
        if (
            n.get("kind") == "portal"
            and n.get("portal_kind") in VERTICAL
            and n.get("core_id")
        ):
            c = connectors.setdefault(
                n["core_id"], {"kind": n["portal_kind"], "portals": {}}
            )
            c["portals"][n["floor"]] = n["id"]

    edges: list[dict] = []

    for cid, c in connectors.items():
        for floor, pid in c["portals"].items():
            edges.append({"source": cid, "target": f"floor:{floor}", "rel": "serves"})

            # Within-floor BFS from the shaft's landing. Stay on this floor and never
            # ride another shaft, so depth counts doors crossed, not floors.
            depth = {pid: 0}
            q = deque([pid])
            while q:
                cur = q.popleft()
                for nb in G.neighbors(cur):
                    if nb in depth:
                        continue
                    nd = nodes[nb]
                    if nd.get("floor") != floor:
                        continue
                    if (
                        nb != pid
                        and nd.get("kind") == "portal"
                        and nd.get("portal_kind") in VERTICAL
                    ):
                        continue
                    depth[nb] = depth[cur] + 1
                    q.append(nb)

            for nb, d in depth.items():
                if nodes[nb].get("kind") == "space":
                    # spaces sit at odd depth (portal=even); doors-from-landing = d // 2
                    edges.append(
                        {
                            "source": cid,
                            "target": nb,
                            "rel": "reaches",
                            "floor": floor,
                            "hops": d // 2,
                        }
                    )

    # Vertical transfers: adjacent served floors of each shaft.
    for cid, c in connectors.items():
        served = sorted(c["portals"], key=level_sort_key)
        for lo, hi in zip(served, served[1:]):
            edges.append(
                {
                    "source": f"floor:{lo}",
                    "target": f"floor:{hi}",
                    "rel": "transfer",
                    "via": cid,
                }
            )

    entrances = []
    for n in b["nodes"]:
        if n.get("kind") == "portal" and n.get("is_external"):
            entrances.append({"id": n["id"], "via": n.get("via"), "floor": n["floor"]})
            edges.append(
                {"source": n["id"], "target": f"floor:{n['floor']}", "rel": "enters"}
            )

    routes = {
        "floors": [
            {
                "id": f"floor:{f['level']}",
                "level": f["level"],
                "label": f["label"],
                "z": f["z"],
            }
            for f in b["floors"]
        ],
        "connectors": [
            {
                "id": cid,
                "kind": c["kind"],
                "serves": sorted(c["portals"], key=level_sort_key),
            }
            for cid, c in connectors.items()
        ],
        "rooms": [
            {
                "id": r["id"],
                "label": r.get("label"),
                "type": r.get("type"),
                "floor": r["floor"],
            }
            for r in b["nodes"]
            if r.get("kind") == "space"
        ],
        "entrances": entrances,
        "edges": edges,
    }
    return routes


def run(building_path, out_path) -> dict:
    """building.json → routes.json. Returns the routes dict."""
    building_path, out_path = Path(building_path), Path(out_path)
    routes = build_routes(json.loads(building_path.read_text()))
    out_path.write_text(json.dumps(routes, indent=2))
    edges = routes["edges"]
    reaches = sum(1 for e in edges if e["rel"] == "reaches")
    transfers = sum(1 for e in edges if e["rel"] == "transfer")
    print(
        f"Wrote {out_path}: {len(routes['floors'])} floors, "
        f"{len(routes['connectors'])} connectors, {len(routes['rooms'])} rooms, "
        f"{len(routes['entrances'])} entrances, "
        f"{len(edges)} edges ({reaches} reaches, {transfers} transfers)"
    )
    return routes


def main():
    run(IN, OUT)


if __name__ == "__main__":
    main()
