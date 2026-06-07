"""
security_graph_builder.py — Merge per-floor portal files into building.json.

Fork of graph_builder.py for the portal graph (eng-review decision #5: portals
are NODES, not edges). Two node kinds:

  - space  : a room. Carries x/y/w/h/z so the Three.js viewer renders it.
  - portal : a door/opening/stair/lift. Carries x/y/z, portal_kind, is_external.

A door is `space_A -- portal -- space_B` (two edges). An entrance is a portal node
with is_external=true and a single edge to its space — no OUTSIDE node, so
entrances are both countable and renderable. Multiple doors between the same rooms
stay distinct (each is its own portal node).

Inter-floor links are EXPLICIT (decision #4): stair/lift portals sharing a
`core_id` on adjacent floors get a `type:inter` edge. The broken 0.08 auto-matcher
from graph_builder.py is deliberately NOT used.

entrance_depth = BFS hop count from the nearest external portal; null = unreachable.
Note (Codex): hop count != geometric distance — fine for the demo.

    python security_graph_builder.py        # security_floors/*.json -> building.json
"""

import json
from collections import deque
from pathlib import Path

import networkx as nx

import portal_schema as ps

HERE = Path(__file__).parent
FLOORS_DIR = HERE / "security_floors"
OUT = HERE / "building.json"
STOREY_HEIGHT = 3.5  # metres per floor


def level_to_z(level) -> float:
    if isinstance(level, str):  # split ground: L0a lower, L0b upper
        return 0.0 if level == "L0a" else 1.75
    return float(level) * STOREY_HEIGHT


def level_sort_key(level) -> float:
    """Order floors bottom-to-top; keep L0a below L0b."""
    if isinstance(level, str):
        return 0.0 if level == "L0a" else 0.5
    return float(level)


def load_floors() -> list[dict]:
    floors = []
    for f in sorted(FLOORS_DIR.glob("*.json")):
        try:
            floors.append(ps.validate_floor(json.loads(f.read_text())))
        except (json.JSONDecodeError, ValueError) as e:
            raise SystemExit(f"ERROR in {f.name}: {e}")
    if not floors:
        raise SystemExit(
            f"No floor files in {FLOORS_DIR}/. Run author_security_floors.py first."
        )
    return floors


def build_graph(floors: list[dict]) -> nx.Graph:
    G = nx.Graph()

    # Pass 1: nodes (spaces + portals)
    for floor in floors:
        lvl = floor["floor"]
        z = round(level_to_z(lvl), 4)
        for s in floor["spaces"]:
            b = s.get("bounds", {"x": 0.5, "y": 0.5, "w": 0.05, "h": 0.05})
            G.add_node(
                s["id"],
                kind="space",
                label=s.get("label", ""),
                type=s.get("type", "unknown"),
                floor=lvl,
                x=round(b["x"] + b["w"] / 2, 4),
                y=round(b["y"] + b["h"] / 2, 4),
                z=z,
                w=round(b["w"], 4),
                h=round(b["h"], 4),
            )
        for p in floor["portals"]:
            G.add_node(
                p["id"],
                kind="portal",
                portal_kind=p["kind"],
                is_external=bool(p.get("is_external")),
                floor=lvl,
                x=round(p["pos"][0], 4),
                y=round(p["pos"][1], 4),
                z=z,
                core_id=p.get("core_id"),
                via=p.get("via"),  # entrance label ("Office Entrance"), if any
            )

    # Pass 2: intra-floor edges — wire each portal to its space endpoint(s)
    for floor in floors:
        for p in floor["portals"]:
            for end in (p["a"], p["b"]):
                if end in (ps.OUTSIDE, ps.UNKNOWN):
                    continue
                if G.has_node(end):
                    G.add_edge(p["id"], end, type="intra")

    # Pass 3: inter-floor edges — explicit, by shared core_id on adjacent floors
    levels = sorted({f["floor"] for f in floors}, key=level_sort_key)
    cores = {}  # core_id -> {level: portal_id}
    for floor in floors:
        for p in floor["portals"]:
            if p["kind"] in ps.VERTICAL_KINDS and p.get("core_id"):
                cores.setdefault(p["core_id"], {})[floor["floor"]] = p["id"]

    inter = 0
    for core_id, by_level in cores.items():
        present = sorted(by_level, key=level_sort_key)
        for lo, hi in zip(present, present[1:]):
            G.add_edge(by_level[lo], by_level[hi], type="inter", core_id=core_id)
            inter += 1

    # Pass 4: entrance_depth = BFS hop count from nearest external portal node
    sources = [
        n for n, d in G.nodes(data=True) if d["kind"] == "portal" and d["is_external"]
    ]
    depth = {s: 0 for s in sources}
    q = deque(sources)
    while q:
        cur = q.popleft()
        for nb in G.neighbors(cur):
            if nb not in depth:
                depth[nb] = depth[cur] + 1
                q.append(nb)
    for n in G.nodes():
        G.nodes[n]["entrance_depth"] = depth.get(n)  # None = unreachable

    unreachable = sum(
        1
        for n, d in G.nodes(data=True)
        if d["kind"] == "space" and d["entrance_depth"] is None
    )
    print(
        f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges "
        f"({inter} inter-floor, {len(sources)} entrances, {unreachable} unreachable spaces)"
    )
    return G


def export(G: nx.Graph, floors: list[dict]) -> dict:
    nodes = [{"id": n, **G.nodes[n]} for n in G.nodes()]
    edges = [{"source": u, "target": v, **G.edges[u, v]} for u, v in G.edges()]
    floor_meta = [
        {
            "level": f["floor"],
            "z": round(level_to_z(f["floor"]), 4),
            "label": f"Level {f['floor']}",
        }
        for f in sorted(floors, key=lambda f: level_sort_key(f["floor"]))
    ]
    return {"nodes": nodes, "edges": edges, "floors": floor_meta}


def main():
    floors = load_floors()
    G = build_graph(floors)
    data = export(G, floors)
    OUT.write_text(json.dumps(data, indent=2))
    entrances = [
        n["id"] for n in data["nodes"] if n["kind"] == "portal" and n["is_external"]
    ]
    print(f"Wrote {OUT} ({len(data['nodes'])} nodes, {len(data['edges'])} edges)")
    print(f"Entrances: {', '.join(entrances)}")


if __name__ == "__main__":
    main()
