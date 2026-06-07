"""
door_graph_builder.py — Derive the BUILDING-WIDE directions graph (building.json)
from graph.json, so the routing graph has a node at EVERY doorway, on every floor.

The hand-authored security_floors/*.json only cover three floors. The 3D viewer,
though, now draws a door at every room-to-room adjacency across the whole building
(graph_builder's `neighbours` → a wall with a door gap). For directions to match what
you can see, the navigation graph needs the same coverage: a portal NODE wherever there
is a doorway.

Node kinds (unchanged contract — pathfind.ts / route_graph_builder.py read these):
  space  : a room (carries x/y/w/h/z so it stays renderable + selectable).
  portal : a doorway / opening / stair / lift. A door is `space_A -- portal -- space_B`.

Doorways are derived exactly the way the renderer's <Doors> layer derives them:
  - partition length ≥ 2.0  → a real door   (portal_kind="door")     [matches a drawn leaf]
  - shorter shared wall      → a narrow gap  (portal_kind="opening")  [keeps the floor navigable]
Both are real nodes, so "there is a node wherever there is a doorway" holds; the opening
kind keeps rooms joined only by a short wall reachable (pathfind already scores it as a door).

Vertical cores (stairs / lifts) are clustered by position into shafts (one core_id per
shaft); each shaft gets one portal per floor it serves, joined to the nearest room on that
floor, with explicit inter-floor edges between adjacent served floors.

The four external entrances are carried over from the curated building.json (now
building.curated.json) and re-attached to the nearest derived ground-floor room, since the
curated L0b room ids (LL0b-*) differ from the vision ids (L0b-*).

    python door_graph_builder.py        # graph.json (+ building.curated.json) -> building.json
"""

import json
import math
from collections import deque
from pathlib import Path

import networkx as nx

HERE = Path(__file__).parent
GRAPH_IN = HERE / "graph.json"
CURATED_IN = HERE / "building.curated.json"  # entrances source (curated, backed up)
OUT = HERE / "building.json"

# Must match arbor-viewer/lib/scene/{constants,geometry}.ts so the directions doorways
# line up 1:1 with the rendered <Doors>.
SCALE_XY = 20
MIN_FOOT = 0.6
DOOR_MIN_LEN = 2.0  # doorGap(): wall this long or longer gets a real door leaf
VERTICAL_KEYS = ("stair", "lift")
SHAFT_BUCKET = 30  # normalized-pos rounding that merges a shaft's per-floor cores


def level_sort_key(level) -> float:
    """Bottom-to-top; split ground L0a below L0b; everything else numeric."""
    s = str(level)
    if s == "L0a":
        return 0.0
    if s == "L0b":
        return 0.5
    return float(s)


def partition_len(a: dict, b: dict) -> float:
    """Length of the shared wall between two rooms — a port of partitionPlacement()
    in geometry.ts (world units). Drives the door vs. opening split."""
    ax, az = a["x"] * SCALE_XY, a["y"] * SCALE_XY
    bx, bz = b["x"] * SCALE_XY, b["y"] * SCALE_XY
    aw = max((a.get("w") or 0) * SCALE_XY, MIN_FOOT)
    ad = max((a.get("h") or 0) * SCALE_XY, MIN_FOOT)
    bw = max((b.get("w") or 0) * SCALE_XY, MIN_FOOT)
    bd = max((b.get("h") or 0) * SCALE_XY, MIN_FOOT)
    dx, dz = bx - ax, bz - az
    if abs(dx) >= abs(dz):
        lo, hi = max(az - ad / 2, bz - bd / 2), min(az + ad / 2, bz + bd / 2)
        length = hi - lo
        if length < MIN_FOOT:
            length = min(ad, bd) * 0.8
    else:
        lo, hi = max(ax - aw / 2, bx - bw / 2), min(ax + aw / 2, bx + bw / 2)
        length = hi - lo
        if length < MIN_FOOT:
            length = min(aw, bw) * 0.8
    return length


def is_vertical(node: dict) -> str | None:
    if node.get("type") != "core":
        return None
    label = (node.get("label") or "").lower()
    for k in VERTICAL_KEYS:
        if k in label:
            return k
    return None


def nearest_space(spaces: list[dict], floor: str, x: float, y: float) -> dict | None:
    best, bestd = None, math.inf
    for s in spaces:
        if str(s["floor"]) != floor:
            continue
        d = (s["x"] - x) ** 2 + (s["y"] - y) ** 2
        if d < bestd:
            best, bestd = s, d
    return best


def build(graph: dict, curated: dict | None) -> dict:
    nodes = {n["id"]: n for n in graph["nodes"]}
    floor_z = {str(f["level"]): f["z"] for f in graph["floors"]}

    G = nx.Graph()

    # ── Spaces: every non-core room, all floors. Keep graph.json z so the route line
    #    sits on the same slab the room is drawn on. ──────────────────────────────
    spaces: list[dict] = []
    for n in graph["nodes"]:
        if n["type"] == "core":
            continue
        sp = {
            "id": n["id"],
            "kind": "space",
            "label": n.get("label", ""),
            "type": n.get("type", "unknown"),
            "floor": str(n["floor"]),
            "x": n["x"],
            "y": n["y"],
            "z": n["z"],
            "w": n.get("w", 0.05),
            "h": n.get("h", 0.05),
        }
        spaces.append(sp)
        G.add_node(sp["id"], **sp)

    space_ids = {s["id"] for s in spaces}

    # ── Recognised doors: real portals from the vision step (graph["doors"]). Each
    #    carries its own position + open/closed state, so we place the leaf exactly
    #    where the drawing shows it. A door listing two rooms also marks that adjacency
    #    as covered, so the fallback heuristic below won't double-place a portal on it.
    doors = openings = recognised = 0
    covered: set[frozenset] = set()
    for j, d in enumerate(graph.get("doors", [])):
        connects = [c for c in (d.get("connects") or []) if c in space_ids]
        if not connects:
            continue  # door references no room we kept — nothing to hang it on
        raw_kind = (d.get("kind") or "door").lower()
        kind = "opening" if raw_kind == "opening" else "door"
        state = "closed" if (d.get("state") or "open").lower() == "closed" else "open"
        floor = str(d.get("floor"))
        # Position: vision gives the gap centre in the same 0..1 frame as rooms. Fall
        # back to the midpoint of the rooms it joins if it's missing or out of range.
        x, y = d.get("x"), d.get("y")
        if not isinstance(x, (int, float)) or not 0.0 <= x <= 1.0:
            x = sum(nodes[c]["x"] for c in connects) / len(connects)
        if not isinstance(y, (int, float)) or not 0.0 <= y <= 1.0:
            y = sum(nodes[c]["y"] for c in connects) / len(connects)
        pid = d.get("door_id") or f"RD{j:04d}"
        if pid in G:  # id collision across replicated floors → disambiguate
            pid = f"{pid}#{j}"
        G.add_node(
            pid,
            kind="portal",
            portal_kind=kind,
            state=state,
            recognised=True,
            is_external=False,
            floor=floor,
            x=round(x, 4),
            y=round(y, 4),
            z=floor_z.get(floor, nodes[connects[0]]["z"]),
            core_id=None,
            via=None,
        )
        for c in connects:
            G.add_edge(pid, c, type="intra")
        if len(connects) >= 2:
            covered.add(frozenset(connects[:2]))
        doors += kind == "door"
        openings += kind == "opening"
        recognised += 1

    # ── Fallback doorways: synthesise a portal on every room-to-room adjacency the
    #    vision step did NOT recognise a door for, so the floor stays fully navigable.
    #    door vs. opening here is the shared-wall-length heuristic; state defaults open.
    for i, e in enumerate(graph["edges"]):
        if e.get("type") != "intra":
            continue
        a, b = nodes.get(e["source"]), nodes.get(e["target"])
        if not a or not b or a["type"] == "core" or b["type"] == "core":
            continue
        if str(a["floor"]) != str(b["floor"]):
            continue
        if frozenset((a["id"], b["id"])) in covered:
            continue  # a recognised door already serves this adjacency
        length = partition_len(a, b)
        kind = "door" if length >= DOOR_MIN_LEN else "opening"
        pid = f"D{i:04d}"
        floor = str(a["floor"])
        G.add_node(
            pid,
            kind="portal",
            portal_kind=kind,
            state="open",
            recognised=False,
            is_external=False,
            floor=floor,
            x=round((a["x"] + b["x"]) / 2, 4),
            y=round((a["y"] + b["y"]) / 2, 4),
            z=floor_z.get(floor, a["z"]),
            core_id=None,
            via=None,
        )
        G.add_edge(pid, a["id"], type="intra")
        G.add_edge(pid, b["id"], type="intra")
        doors += kind == "door"
        openings += kind == "opening"

    # ── Vertical portals: cluster stair/lift cores into shafts. ───────────────────
    shafts: dict[str, dict[str, list[dict]]] = {}  # core_id -> floor -> [cores]
    for n in graph["nodes"]:
        kind = is_vertical(n)
        if not kind:
            continue
        key = f"{kind.upper()}-{round(n['x'] * SHAFT_BUCKET)}-{round(n['y'] * SHAFT_BUCKET)}"
        shafts.setdefault(key, {}).setdefault(str(n["floor"]), []).append(n)

    inter = 0
    core_portal: dict[
        str, str
    ] = {}  # graph core node id -> its floor's shaft portal id
    for core_id, by_floor in shafts.items():
        kind = "stair" if core_id.startswith("STAIR") else "lift"
        floor_portal: dict[str, str] = {}
        for floor, cores in by_floor.items():
            cx = sum(c["x"] for c in cores) / len(cores)
            cy = sum(c["y"] for c in cores) / len(cores)
            pid = f"{core_id}@{floor}"
            G.add_node(
                pid,
                kind="portal",
                portal_kind=kind,
                is_external=False,
                floor=floor,
                x=round(cx, 4),
                y=round(cy, 4),
                z=floor_z.get(floor, 0.0),
                core_id=core_id,
                via=None,
            )
            floor_portal[floor] = pid
            for c in cores:
                core_portal[c["id"]] = pid
            # Join the shaft to the nearest room on this floor so a route can board it.
            room = nearest_space(spaces, floor, cx, cy)
            if room:
                G.add_edge(pid, room["id"], type="intra")
        # Explicit inter-floor edges between adjacent served floors.
        served = sorted(floor_portal, key=level_sort_key)
        for lo, hi in zip(served, served[1:]):
            G.add_edge(
                floor_portal[lo], floor_portal[hi], type="inter", core_id=core_id
            )
            inter += 1

    # Graft graph.json's own cross-floor core matches as extra inter-floor edges. The
    # position buckets above fragment where the podium and tower cores shift sideways;
    # these matches reconnect a shaft across that shift so the stack stays navigable.
    for e in graph["edges"]:
        if e.get("type") != "inter":
            continue
        pa, pb = core_portal.get(e["source"]), core_portal.get(e["target"])
        if not pa or not pb or pa == pb or G.has_edge(pa, pb):
            continue
        if str(G.nodes[pa]["floor"]) == str(G.nodes[pb]["floor"]):
            continue
        G.add_edge(pa, pb, type="inter", core_id=G.nodes[pa].get("core_id"))
        inter += 1

    # ── Spine repair: guarantee every consecutive floor pair is connected, so an
    #    entrance can reach the whole stack even where the podium cores are too sparse
    #    to cluster/match. Adds the FEWEST synthetic inter-floor links needed: for each
    #    gap, the nearest vertical-core pair across it (falling back to rooms if a floor
    #    has no detected core). ────────────────────────────────────────────────────
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        parent[find(a)] = find(b)

    for u, v in G.edges():
        union(u, v)

    def anchors(floor: str) -> list[tuple[str, dict]]:
        verts = [
            (nid, d)
            for nid, d in G.nodes(data=True)
            if str(d.get("floor")) == floor
            and d.get("portal_kind") in ("stair", "lift")
        ]
        if verts:
            return verts
        return [
            (nid, d)
            for nid, d in G.nodes(data=True)
            if str(d.get("floor")) == floor and d.get("kind") == "space"
        ]

    floors_sorted = sorted(
        {str(f["level"]) for f in graph["floors"]}, key=level_sort_key
    )
    bridges = 0
    for lo, hi in zip(floors_sorted, floors_sorted[1:]):
        la, ha = anchors(lo), anchors(hi)
        if not la or not ha:
            continue
        if any(find(a) == find(b) for a, _ in la for b, _ in ha):
            continue  # already connected through the existing structure
        best, bestd = None, math.inf
        for a, da in la:
            for b, db in ha:
                d = (da["x"] - db["x"]) ** 2 + (da["y"] - db["y"]) ** 2
                if d < bestd:
                    best, bestd = (a, b), d
        if best:
            G.add_edge(
                best[0], best[1], type="inter", core_id=G.nodes[best[0]].get("core_id")
            )
            union(best[0], best[1])
            inter += 1
            bridges += 1
    if bridges:
        print(f"  spine repair: added {bridges} synthetic inter-floor link(s)")

    # ── Entrances: carry the curated externals over, re-attached to a real room. ──
    entrances = 0
    if curated:
        for n in curated["nodes"]:
            if not n.get("is_external"):
                continue
            floor = str(n["floor"])
            room = nearest_space(spaces, floor, n["x"], n["y"])
            if (
                room is None
            ):  # floor not in the vision graph → attach to nearest ground room
                room = min(
                    (s for s in spaces if level_sort_key(s["floor"]) <= 1.0),
                    key=lambda s: (s["x"] - n["x"]) ** 2 + (s["y"] - n["y"]) ** 2,
                    default=None,
                )
            if room is None:
                continue
            G.add_node(
                n["id"],
                kind="portal",
                portal_kind=n.get("portal_kind", "door"),
                is_external=True,
                floor=str(room["floor"]),
                x=n["x"],
                y=n["y"],
                z=floor_z.get(str(room["floor"]), 0.0),
                core_id=None,
                via=n.get("via"),
            )
            G.add_edge(n["id"], room["id"], type="intra")
            entrances += 1

    # ── entrance_depth = BFS hop count from the nearest external portal. ──────────
    sources = [nid for nid, d in G.nodes(data=True) if d.get("is_external")]
    depth = {s: 0 for s in sources}
    q = deque(sources)
    while q:
        cur = q.popleft()
        for nb in G.neighbors(cur):
            if nb not in depth:
                depth[nb] = depth[cur] + 1
                q.append(nb)
    for nid in G.nodes():
        G.nodes[nid]["entrance_depth"] = depth.get(nid)

    out_nodes = [{"id": nid, **G.nodes[nid]} for nid in G.nodes()]
    out_edges = [{"source": u, "target": v, **G.edges[u, v]} for u, v in G.edges()]
    floor_meta = [
        {
            "level": f["level"],
            "z": f["z"],
            "label": f.get("label", f"Level {f['level']}"),
        }
        for f in sorted(graph["floors"], key=lambda f: level_sort_key(f["level"]))
    ]

    print(
        f"Directions graph: {len(out_nodes)} nodes, {len(out_edges)} edges "
        f"({doors} doors, {openings} openings, {recognised} recognised, "
        f"{len(shafts)} shafts, {inter} inter-floor, {entrances} entrances)"
    )
    return {"nodes": out_nodes, "edges": out_edges, "floors": floor_meta}


def run(graph_path, out_path, curated_path=None) -> dict:
    """Build the building-wide doorway graph (building.json) from graph.json.

    curated_path is optional — when present it overlays external entrances; when absent
    the building is still fully navigable, just without curated entrance nodes.
    Returns the building dict.
    """
    graph_path, out_path = Path(graph_path), Path(out_path)
    graph = json.loads(graph_path.read_text())
    curated = None
    if curated_path is not None and Path(curated_path).exists():
        curated = json.loads(Path(curated_path).read_text())
    else:
        print("INFO: no curated entrances — building.json will have no external doors.")
    data = build(graph, curated)
    out_path.write_text(json.dumps(data, indent=2))
    print(f"Wrote {out_path}")
    return data


def main():
    graph = json.loads(GRAPH_IN.read_text())
    curated = json.loads(CURATED_IN.read_text()) if CURATED_IN.exists() else None
    if curated is None:
        print(
            "WARN: building.curated.json not found — no external entrances carried over."
        )
    data = build(graph, curated)
    OUT.write_text(json.dumps(data, indent=2))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
