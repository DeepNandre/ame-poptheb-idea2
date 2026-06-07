"""
vector_extract.py — Extract wall geometry directly from Arbor GA vector PDFs.

M1 (this file): walls only. Reads each floor PDF's native vector line segments
(PyMuPDF get_drawings), region-crops to the main plan block, filters to wall-weight
strokes, normalises to render-ready 0..1 coords against a SHARED frame, and writes
walls.json for the Three.js viewer.

No OpenAI / vision model. No API key. Pure local PDF parsing.

    pip install pymupdf
    python vector_extract.py            # all floors -> walls.json
    python vector_extract.py PA2001_LEVEL_1_GA   # single sheet, prints stats

Pipeline note: M2 will feed room polygons into graph_builder.py. M1 is standalone
(separate walls.json) so the wall render can be overlay-checked against the source
PNG before investing in polygonize.

Coordinate contract (decision 3A): ALL geometry math lives here. The viewer stays a
thin renderer doing `x * SCALE_XY`. Output coords are normalised 0..1 with aspect
preserved (uniform scale) and the plan centred, so the viewer needs no bbox math.
"""

import json
import sys
from collections import deque
from pathlib import Path

import fitz  # pymupdf
from shapely import concave_hull
from shapely.geometry import MultiPoint, Point

HERE = Path(__file__).resolve().parent
# CLI default only — the API passes an explicit pdf_dir to run(). Points at the
# backend's buildings/ store (../../buildings from vendor/schematic-scanning).
PDF_DIR = HERE.parent.parent / "buildings" / "Arbor-22-AP-2295"
OUT = HERE / "walls.json"

# One sheet can map to several identical levels (typical-floor GA drawings).
FLOOR_MAP = {
    "PA1997_BASEMENT": [-2],
    "PA1998_BASEMENT_B1": [-1],
    "PA1999_GROUND_FLOOR_LOWER": ["L0a"],
    "PA2000_GROUND_FLOOR_UPPER": ["L0b"],
    "PA2001_LEVEL_1_GA": [1],
    "PA2002_LEVEL_2-5_GA": [2, 3, 4, 5],
    "PA2006_LEVEL_6-9_GA": [6, 7, 8, 9],
    "PA2010_LEVEL_10-13_GA": [10, 11, 12, 13],
    "PA2014_LEVEL_14-17_GA": [14, 15, 16, 17],
    "PA2018_ROOF_GA": [18],
}

TITLE_BLOCK_FRAC = 0.85  # drop right ~15% (title block), matches extract.py clip
WALL_MIN_WIDTH = 0.5  # stroke width gap: thin clutter ~0.24, walls 1.92+
GRID = 48  # occupancy-grid resolution for region detection
MIN_CELL_SEGS = 2  # a grid cell counts as "occupied" at >= this many segs


def wall_segments(page):
    """All wall-weight line segments in the drawing area as (x1,y1,x2,y2) in PDF pts."""
    clipx = page.rect.width * TITLE_BLOCK_FRAC
    segs = []
    for path in page.get_drawings():
        if (path.get("width") or 0) < WALL_MIN_WIDTH:
            continue
        for it in path["items"]:
            if it[0] != "l":
                continue
            a, b = it[1], it[2]
            if a.x < clipx and b.x < clipx:
                segs.append((a.x, a.y, b.x, b.y))
    return segs


def main_plan_region(segs):
    """
    Region-crop: GA sheets can hold several content blocks (Level 2-5 has a plan +
    a second block). Find the largest connected cluster of wall segments on a coarse
    occupancy grid and return its bbox. Single-plan sheets return ~the whole drawing.

        occupancy grid (segment midpoints)        connected components -> pick biggest
        . . X X . . . X .                         keep the dense plan blob, drop the
        . X X X . . . . .            ====>         side panel / legend / section
        . X X X . . X X .
    """
    if not segs:
        return None
    xs = [(s[0] + s[2]) / 2 for s in segs]
    ys = [(s[1] + s[3]) / 2 for s in segs]
    xmin, xmax, ymin, ymax = min(xs), max(xs), min(ys), max(ys)
    spanx = (xmax - xmin) or 1.0
    spany = (ymax - ymin) or 1.0

    # bucket segment midpoints into grid cells
    cells = {}
    for mx, my in zip(xs, ys):
        cx = min(GRID - 1, int((mx - xmin) / spanx * GRID))
        cy = min(GRID - 1, int((my - ymin) / spany * GRID))
        cells[(cx, cy)] = cells.get((cx, cy), 0) + 1
    occupied = {c for c, n in cells.items() if n >= MIN_CELL_SEGS}
    if not occupied:
        occupied = set(cells)  # fallback: nothing dense, take all

    # connected components (8-neighbour BFS), weighted by segment count
    seen = set()
    best_cells, best_weight = set(), -1
    for start in occupied:
        if start in seen:
            continue
        comp, weight, q = set(), 0, deque([start])
        seen.add(start)
        while q:
            c = q.popleft()
            comp.add(c)
            weight += cells.get(c, 0)
            cx, cy = c
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nb = (cx + dx, cy + dy)
                    if nb in occupied and nb not in seen:
                        seen.add(nb)
                        q.append(nb)
        if weight > best_weight:
            best_weight, best_cells = weight, comp

    # bbox of the winning component, back in PDF pts (+1 cell margin)
    cxs = [c[0] for c in best_cells]
    cys = [c[1] for c in best_cells]
    rx0 = xmin + (min(cxs)) / GRID * spanx
    rx1 = xmin + (max(cxs) + 1) / GRID * spanx
    ry0 = ymin + (min(cys)) / GRID * spany
    ry1 = ymin + (max(cys) + 1) / GRID * spany
    return (rx0, ry0, rx1, ry1)


def clip_to_region(segs, region):
    """Keep segments whose midpoint falls inside the plan region."""
    rx0, ry0, rx1, ry1 = region
    out = []
    for x1, y1, x2, y2 in segs:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if rx0 <= mx <= rx1 and ry0 <= my <= ry1:
            out.append((x1, y1, x2, y2))
    return out


def normalise(segs, region):
    """
    Aspect-preserving uniform scale + centre into 0..1, PDF y flipped to model space.
    Uniform scale (decision 3A + Codex shared-frame fix): scale by 1/max(w,h) so the
    plan never shears, and centre the shorter axis. Same recipe for every floor, so
    floors of the same footprint land on top of each other.
    """
    rx0, ry0, rx1, ry1 = region
    w = (rx1 - rx0) or 1.0
    h = (ry1 - ry0) or 1.0
    s = 1.0 / max(w, h)
    ox = (1.0 - w * s) / 2.0  # centre the shorter axis
    oy = (1.0 - h * s) / 2.0
    out = []
    for x1, y1, x2, y2 in segs:
        nx1 = (x1 - rx0) * s + ox
        nx2 = (x2 - rx0) * s + ox
        # flip y: PDF origin top-left -> model origin bottom-left
        ny1 = 1.0 - ((y1 - ry0) * s + oy)
        ny2 = 1.0 - ((y2 - ry0) * s + oy)
        out.append([round(nx1, 4), round(ny1, 4), round(nx2, 4), round(ny2, 4)])
    return out


BOUNDARY_MARGIN = 0.02  # normalised distance: midpoint nearer than this = perimeter
SIMPLIFY_TOL = 0.012  # Douglas-Peucker tolerance for the smoothed outer outline
HULL_RATIO = (
    0.4  # concave_hull tightness (0=concave, 1=convex); 0.4 traces footprint smoothly
)


def split_outer_inner(norm):
    """
    Separate the building envelope (outer walls) from interior partitions, and
    REPLACE the jagged perimeter with a simplified, smoother outline (fewer polys).

        all segment endpoints                concave hull -> footprint polygon
          .  . . . .                         exterior simplified (Douglas-Peucker)
        . [perimeter] .          ====>       => few long OUTER segments (smooth)
        .  . inner  . .                       interior segments (midpoint far from
          . . . . . .                         the boundary) => INNER partitions

    Returns (outer_segs, inner_segs). On any failure, everything falls back to inner.
    """
    pts = []
    for x1, y1, x2, y2 in norm:
        pts.append((x1, y1))
        pts.append((x2, y2))
    if len(pts) < 4:
        return [], norm
    try:
        hull = concave_hull(MultiPoint(pts), ratio=HULL_RATIO)
    except Exception:
        return [], norm
    if hull.geom_type != "Polygon" or hull.is_empty:
        return [], norm

    ext = hull.exterior
    simpl = ext.simplify(SIMPLIFY_TOL, preserve_topology=True)
    coords = list(simpl.coords)
    outer = [
        [
            round(coords[i][0], 4),
            round(coords[i][1], 4),
            round(coords[i + 1][0], 4),
            round(coords[i + 1][1], 4),
        ]
        for i in range(len(coords) - 1)
    ]
    # inner = original segments whose midpoint sits well inside the footprint
    inner = []
    for x1, y1, x2, y2 in norm:
        mid = Point((x1 + x2) / 2, (y1 + y2) / 2)
        if ext.distance(mid) > BOUNDARY_MARGIN:
            inner.append([x1, y1, x2, y2])
    return outer, inner


def extract_sheet(stem, pdf_dir=PDF_DIR):
    pdf = Path(pdf_dir) / f"{stem}.pdf"
    if not pdf.exists():
        print(f"  WARN: {pdf} not found, skipping")
        return None
    page = fitz.open(pdf)[0]
    segs = wall_segments(page)
    region = main_plan_region(segs)
    if region is None:
        print(f"  WARN: {stem} no wall segments")
        return None
    cropped = clip_to_region(segs, region)
    norm = normalise(cropped, region)
    outer, inner = split_outer_inner(norm)
    dropped = len(segs) - len(cropped)
    print(
        f"  {stem}: {len(segs)} segs -> cropped {len(cropped)} "
        f"(dropped {dropped}) -> outer {len(outer)} (smoothed) + inner {len(inner)}"
    )
    return {"outer": outer, "inner": inner}


def run(pdf_dir, out_path, progress_cb=None) -> dict:
    """Extract wall geometry for every floor-plan PDF in pdf_dir → walls.json.

    Floors are inferred per sheet (shares extract.infer_floors), so this works for any
    building. Best-effort: a sheet that yields no walls is skipped, not fatal. Returns
    the walls dict {scale, schema, floors}.
    """
    from extract import ROOF_MARKER, infer_floors  # same package, avoids a FLOOR_MAP

    pdf_dir, out_path = Path(pdf_dir), Path(out_path)
    pdfs = sorted(pdf_dir.glob("*.pdf"))

    # Resolve levels per sheet (skip non-floor sheets, resolve ROOF to top+1).
    planned = []
    for pdf in pdfs:
        try:
            levels, _conf, _reason = infer_floors(pdf.stem, fitz.open(pdf)[0])
        except Exception:
            continue
        if levels is not None:
            planned.append((pdf.stem, levels))
    numeric = [lvl for _s, lv in planned for lvl in lv if isinstance(lvl, int)]
    roof_level = (max(numeric) + 1) if numeric else 1

    floors = {}
    total = len(planned)
    for i, (stem, levels) in enumerate(planned, 1):
        print(f"--- {stem} ---")
        sheet = extract_sheet(stem, pdf_dir)
        if sheet is not None:
            for lvl in levels:
                lvl = roof_level if lvl == ROOF_MARKER else lvl
                floors[str(lvl)] = sheet
        if progress_cb:
            progress_cb(i, total, stem)

    data = {
        "scale": "normalised 0..1, aspect-preserved, y-up",
        "schema": "floors[level] = {outer:[segs], inner:[segs]}",
        "floors": floors,
    }
    out_path.write_text(json.dumps(data))
    print(f"\nWrote {out_path}: {len(floors)} floors")
    return data


def main():
    targets = sys.argv[1:] or list(FLOOR_MAP.keys())
    floors = {}
    for stem in targets:
        if stem not in FLOOR_MAP:
            print(f"Unknown stem: {stem}")
            continue
        print(f"--- {stem} ---")
        sheet = extract_sheet(stem)
        if sheet is None:
            continue
        for lvl in FLOOR_MAP[stem]:
            floors[str(lvl)] = sheet  # identical plan replicated per mapped level

    data = {
        "scale": "normalised 0..1, aspect-preserved, y-up",
        "schema": "floors[level] = {outer:[segs], inner:[segs]}",
        "floors": floors,
    }
    OUT.write_text(json.dumps(data))
    outer_total = sum(len(v["outer"]) for v in floors.values())
    inner_total = sum(len(v["inner"]) for v in floors.values())
    print(
        f"\nWrote {OUT}: {len(floors)} floors, "
        f"{outer_total} outer + {inner_total} inner segments"
    )


if __name__ == "__main__":
    main()
