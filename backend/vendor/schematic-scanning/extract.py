"""
extract.py — Rasterise Arbor GA PDFs and extract room graph data via OpenAI vision,
grounded on the PDF's own embedded text.

Two data sources are fused per sheet:
  1. The rasterised image (what o3 "sees").
  2. The PDF's embedded text lines (the architect's actual labels), pulled with
     PyMuPDF and normalised into the SAME 0..1 clip frame the image uses.

The text is authoritative: it is injected into the prompt as the real label set, and
a deterministic point-in-box pass overrides each room's label with the printed string
that sits inside it (label_source="text"). Vision only fills spaces that carry no text.

Usage:
    pip install openai pymupdf
    export OPENAI_API_KEY=...
    python dev/schematic-scanning/extract.py                    # all floors
    python dev/schematic-scanning/extract.py PA2001_LEVEL_1_GA  # single floor by stem
"""

import base64
import json
import re
import sys
from pathlib import Path

import fitz  # pymupdf
import openai

# CLI default only — the API (workers/ingest.py) passes an explicit pdf_dir to run().
# Points at the backend's buildings/ store (../../buildings from vendor/schematic-scanning).
PDF_DIR = (
    Path(__file__).resolve().parent.parent.parent / "buildings" / "Arbor-22-AP-2295"
)
FLOORS_DIR = Path(__file__).parent / "floors"
FLOORS_DIR.mkdir(exist_ok=True)

TITLE_FRAC = (
    0.85  # drop right ~15% (title block); matches the image clip + vector_extract
)
# Arbor GA sheets also carry a keyplan / general-notes / title strip across the TOP
# (place names, "FOR PLANNING", project/client codes cluster at y_norm < ~0.13). The
# plan area sits below it, so drop that band. Template-specific to this drawing set.
TOP_NOTE_BAND = 0.13

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

# ── Floor inference (any building, no hand-authored FLOOR_MAP) ─────────────────
#
# A GA sheet names its level in the filename and/or title block ("LEVEL 1",
# "BASEMENT", "ROOF", "GROUND FLOOR LOWER", "LEVEL 2-5"). We parse that instead of
# relying on a per-building FLOOR_MAP, and return a confidence so the caller can
# flag sheets it guessed weakly — a wrong level silently renders a wrong 3D model.
ROOF_MARKER = "__ROOF__"
_LEVEL_RANGE_RE = re.compile(r"(?:LEVEL|FLOOR|LVL)\s*0*(\d+)\s*[-–]\s*0*(\d+)")
_LEVEL_ONE_RE = re.compile(r"(?:LEVEL|FLOOR|LVL)\s*0*(\d+)")
_ORDINAL_RE = re.compile(r"\b0*(\d+)(?:ST|ND|RD|TH)\s+FLOOR")
_BASEMENT_N_RE = re.compile(r"(?:BASEMENT|LOWER\s+GROUND)\s*(?:LEVEL\s*)?B?\s*0*(\d+)")


def _parse_levels(text: str) -> tuple[list | None, float, str]:
    """Parse floor level(s) from a sheet title string.

    Returns (levels, confidence, reason). levels is None when the string carries no
    floor signal at all (a non-floor sheet: site plan, section, DAS, register).
    """
    s = text.upper()

    # Ground variants first — "GROUND FLOOR LOWER/UPPER" splits into L0a / L0b.
    if "GROUND" in s and "LOWER" in s:
        return ["L0a"], 0.85, "ground floor lower"
    if "GROUND" in s and "UPPER" in s:
        return ["L0b"], 0.85, "ground floor upper"

    if "ROOF" in s:
        return [ROOF_MARKER], 0.85, "roof"

    m = _BASEMENT_N_RE.search(s)
    if m:
        return [-int(m.group(1))], 0.8, f"basement B{m.group(1)}"
    if "BASEMENT" in s or "LOWER GROUND" in s:
        return [-1], 0.6, "basement (no number — assumed -1)"

    m = _LEVEL_RANGE_RE.search(s)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        if 0 <= hi - lo <= 60:
            return list(range(lo, hi + 1)), 0.9, f"level range {lo}-{hi}"

    m = _LEVEL_ONE_RE.search(s) or _ORDINAL_RE.search(s)
    if m:
        return [int(m.group(1))], 0.9, f"level {m.group(1)}"

    if "GROUND" in s or "MEZZANINE" in s:
        return [0], 0.75, "ground / mezzanine"

    return None, 0.0, "no floor keyword"


def sheet_title_text(page) -> str:
    """First ~40 text lines of the page — cheap source for the sheet's level label."""
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            t = "".join(span["text"] for span in line["spans"]).strip()
            if t:
                lines.append(t)
    return " ".join(lines[:40])


def infer_floors(stem: str, page=None) -> tuple[list | None, float, str]:
    """Infer a sheet's floor level(s) from its filename, cross-checked with title text.

    Filename is primary (planning sets name sheets by level). If the filename gives
    nothing we fall back to the embedded title text at lower confidence. When both
    agree, confidence is bumped; when they disagree, it is cut and the conflict noted.
    """
    name = stem.replace("_", " ")
    f_levels, f_conf, f_reason = _parse_levels(name)

    t_levels = t_reason = None
    if page is not None:
        t_levels, _t_conf, t_reason = _parse_levels(sheet_title_text(page))

    if f_levels is not None:
        if t_levels is not None and t_levels != f_levels:
            return (
                f_levels,
                min(f_conf, 0.55),
                f"filename={f_reason}; title disagrees ({t_reason})",
            )
        if t_levels == f_levels:
            return (
                f_levels,
                min(0.97, f_conf + 0.05),
                f"filename+title agree ({f_reason})",
            )
        return f_levels, f_conf, f"filename: {f_reason}"

    if t_levels is not None:
        return t_levels, 0.6, f"title only: {t_reason}"

    return None, 0.0, "no floor signal (skipped — not a floor plan)"


# ── Embedded-text extraction (#1: text as a second data source) ───────────────
#
#   PDF text lines           normalise to clip 0..1        filter boilerplate
#   "Office"  (pts)   ──►     "Office" (0.42, 0.30)   ──►   keep room labels,
#   "N.B. All ..."           "N.B. ..."  (0.05, 0.92)       drop notes + codes
#   "PA2200"                 "PA2200"   (0.71, 0.55)
#
# Room words we always keep even if the generic heuristic would drop them.
ROOM_VOCAB = {
    "office",
    "plant",
    "planting",
    "terrace",
    "balcony",
    "roof",
    "wc",
    "toilet",
    "lift",
    "stair",
    "stairs",
    "reception",
    "lobby",
    "foyer",
    "core",
    "riser",
    "store",
    "storage",
    "comms",
    "cycle",
    "bin",
    "substation",
    "switchroom",
    "tank",
    "lounge",
    "kitchen",
    "meeting",
    "boardroom",
    "void",
    "atrium",
    "entrance",
    "corridor",
    "circulation",
    "retail",
    "residential",
    "apartment",
    "plantroom",
    "amenity",
    "gym",
    "studio",
    "pool",
    "void over",
    "loading",
}
# Drawing-register / dimension / revision codes, e.g. PA2200, R.15, B1, A1.
_CODE_RE = re.compile(r"^[A-Z]{1,3}[.\-]?\d")
# Words that mark title-block notes rather than room labels.
_NOTE_WORDS = (
    "n.b.",
    "refer",
    "drawing",
    "scale",
    "drawn",
    "checked",
    "approved",
    "pursuant",
    "condition",
    "boundary",
    "indicative",
    "rev ",
    "issue",
)


def _looks_like_label(text: str) -> bool:
    """True if a text line reads like a room label, not a note or a code."""
    low = text.lower()
    if low in ROOM_VOCAB or any(w in low.split() for w in ROOM_VOCAB):
        return True
    words = text.split()
    if len(words) > 4 or len(text) > 28:
        return False
    if _CODE_RE.match(text):
        return False
    if any(nw in low for nw in _NOTE_WORDS):
        return False
    stripped = text.replace(" ", "")
    if not stripped:
        return False
    if sum(c.isdigit() for c in stripped) > 0.3 * len(stripped):
        return False
    if not text[0].isupper():
        return False
    if sum(c.isalpha() for c in stripped) < 0.6 * len(stripped):
        return False
    return True


def embedded_labels(page) -> list[dict]:
    """
    Text lines inside the drawing area, normalised to the clip's 0..1 frame.
    Returns [{"text", "x", "y"}] in the same coordinate space the model sees.
    """
    # These sheets are rotated 90°. get_text() returns bbox in the UNROTATED mediabox
    # space, but the image o3 sees comes from get_pixmap() in the ROTATED display space
    # (page.rect). Transform text points through rotation_matrix so labels live in the
    # same 0..1 frame as the image and as o3's room bounds.
    mat = page.rotation_matrix
    clipx = page.rect.width * TITLE_FRAC
    clipy = page.rect.height
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if not text:
                continue
            x0, y0, x1, y1 = line["bbox"]
            p0 = fitz.Point(x0, y0) * mat
            p1 = fitz.Point(x1, y1) * mat
            cx, cy = (p0.x + p1.x) / 2, (p0.y + p1.y) / 2
            if cx >= clipx:  # right-hand title block → drop
                continue
            if cy / clipy < TOP_NOTE_BAND:  # top keyplan/notes strip → drop
                continue
            if len(text.replace(" ", "")) < 2:  # stray grid refs like "A" → drop
                continue
            if not _looks_like_label(text):
                continue
            out.append(
                {"text": text, "x": round(cx / clipx, 4), "y": round(cy / clipy, 4)}
            )
    return out


def assign_text_labels(rooms: list[dict], labels: list[dict]) -> None:
    """
    Deterministic override: a printed label whose centroid falls inside a room's
    bounds becomes that room's label (text is ground truth). Spaces with no
    printed label keep the model's inference and are tagged label_source="vision".
    """
    for room in rooms:
        b = room.get("approximate_bounds", {})
        x, y = b.get("x", 0.0), b.get("y", 0.0)
        w, h = b.get("w", 0.0), b.get("h", 0.0)
        inside = [
            lab for lab in labels if x <= lab["x"] <= x + w and y <= lab["y"] <= y + h
        ]
        if inside:
            cx, cy = x + w / 2, y + h / 2
            best = min(
                inside, key=lambda lab: (lab["x"] - cx) ** 2 + (lab["y"] - cy) ** 2
            )
            room["label"] = best["text"]
            room["label_source"] = "text"
        else:
            room.setdefault("label_source", "vision")


# ── Prompt (#2: text injection + visual-cue classification) ───────────────────
PROMPT = """This is an architectural floor plan (General Arrangement drawing) for Bankside Yards Building 1 (Arbor), floor level {level}.

Extract every enclosed space as JSON. Return ONLY valid JSON, no commentary.

You are given the EXACT text labels printed on this drawing, with their normalised
(x, y) positions in the drawing area (0.0–1.0, origin top-left). These are authoritative:
use these strings verbatim for the `label` of the space each one sits in, and set
"label_source": "text". Do NOT invent or reword a printed label. If a space carries no
printed label, infer it from the visual cues below and set "label_source": "vision".

EMBEDDED TEXT LABELS:
{labels}

DOORS — find every door. A door is drawn as a GAP in a wall, usually with a thin
straight LEAF line across the gap and a quarter-circle SWING ARC showing which way it
opens. Sliding doors show two offset leaves; openings are just a gap with no leaf/arc.
Report ONE entry per door in the `doors` array below:
- `x`, `y`: the centre of the doorway gap, normalised 0.0–1.0 in the drawing area.
- `connects`: the room_id(s) on each side of the door. Two ids for an interior door
  between two spaces; ONE id if it opens to a corridor/lobby/outside you did not
  enclose as a room. Use the same room_ids you assigned above.
- `kind`: "door" (single leaf) | "double" (two leaves) | "sliding" | "opening" (gap,
  no leaf).
- `state`: "open" if the swing arc / leaf is drawn ajar or the gap is empty, "closed"
  if the leaf is drawn flat across the opening. When unsure, use "open".
Be thorough: small WC cubicle doors, office doors, core/stair doors, and entrance
doors all count. Missing doors is the main failure mode — err toward reporting one.

Visual cues — use these to set `type`, `function`, `environment`, `fixtures`:
- Toilet / urinal / basin glyphs in small cubicles with door swings -> WC (type: amenity, fixtures: ["wc","basin"], environment: indoor)
- A larger WC cubicle with a wheelchair / DDA symbol, a corner pan and grab rails -> Accessible WC (type: amenity, function: "Accessible WC", fixtures: ["wc","basin","grab-rail"], environment: indoor)
- A room sectioned off with a large table ringed by chairs          -> meeting room / boardroom (type: office)
- Regular tile / brick HATCH fill, usually labelled "Terrace"        -> terrace (type: external, environment: outdoor, fixtures: ["tile-hatch"])
- Dashed circles (tree canopies), usually labelled "Planting"        -> landscaping (type: external, environment: outdoor, fixtures: ["tree"])
- "Plant" (NOT "Planting")                                           -> mechanical plant room (type: plant, environment: indoor)
- A rectangle crossed by a dashed diagonal X                         -> void / shaft / open-below (type: core)
- Stair treads / lift car squares                                    -> type: core (also list under core_elements)

{{
  "floor_level": {level},
  "rooms": [
    {{
      "room_id": "string (e.g. L{level}-01)",
      "label": "the printed text label if one sits in this space, else inferred",
      "label_source": "text | vision",
      "type": "one of: office|residential|plant|circulation|core|amenity|external|unknown",
      "function": "short human description (e.g. 'Male WC', 'Boardroom', 'Terrace', 'Plant Room')",
      "environment": "indoor | outdoor | covered",
      "fixtures": ["visual items you used to classify, e.g. wc, basin, desk, tree, tile-hatch"],
      "confidence": 0.0,
      "approximate_bounds": {{"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}},
      "neighbours": ["room_ids sharing a wall or door opening on this floor"]
    }}
  ],
  "core_elements": [
    {{
      "id": "string (e.g. LIFT-01)",
      "type": "lift|stair|corridor",
      "position": {{"x": 0.0, "y": 0.0}}
    }}
  ],
  "doors": [
    {{
      "door_id": "string (e.g. L{level}-D01)",
      "x": 0.0,
      "y": 0.0,
      "connects": ["room_id", "room_id"],
      "kind": "door|double|sliding|opening",
      "state": "open|closed"
    }}
  ]
}}

Bounds are normalised 0.0–1.0 relative to the drawing area (not the full page).
Identify lifts, staircases, and corridors as core_elements — these connect floors vertically."""


def _remap_level(s: str, base, lvl) -> str:
    """Rewrite the level token in an id when replicating a typical-floor plan.

    Ids look like "L02-01", "D-L02-03", "L2-01". Naive str.replace(str(base), str(lvl))
    corrupts these — "L02-02".replace("2","3") → "L03-03" (wrong room, and a collision).
    Replace the level TOKEN instead, covering the zero-padded ("L02") and bare ("L2-")
    forms the model emits.
    """
    if not isinstance(s, str):
        return s
    try:
        b, n = int(base), int(lvl)
    except (TypeError, ValueError):
        return s
    return s.replace(f"L{b:02d}", f"L{n:02d}").replace(f"L{b}-", f"L{n}-")


def rasterise(page, target_long_px: int = 4096) -> bytes:
    """Render the drawing area (title block cropped) to a PNG."""
    clip = fitz.Rect(0, 0, page.rect.width * TITLE_FRAC, page.rect.height)
    # Scale so the longest edge = target_long_px (OpenAI tiles after scaling to 2048,
    # so 4096 gives 2× coverage per tile → labels readable at ~10px)
    scale = target_long_px / max(clip.width, clip.height)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip)
    return pix.tobytes("png")


def _format_labels(labels: list[dict]) -> str:
    if not labels:
        return "(no embedded text found — classify from visual cues only)"
    return "\n".join(f'- "{lab["text"]}" at ({lab["x"]}, {lab["y"]})' for lab in labels)


def _call_o3(client, png_b64, prompt, stem, floors_dir=FLOORS_DIR, attempts=3):
    """
    Call o3 vision and parse its JSON, retrying on the empty / unparseable response
    o3 occasionally returns (reasoning ate the token budget, or a transient). Returns
    the parsed dict, or None if every attempt failed. The last raw body is saved for
    debugging.
    """
    for attempt in range(1, attempts + 1):
        try:
            response = client.chat.completions.create(
                model="o3",
                max_completion_tokens=8192,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{png_b64}",
                                    "detail": "high",
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
            )
            raw_text = response.choices[0].message.content or ""
            (floors_dir / f"{stem}_raw.txt").write_text(raw_text)  # debug

            text = raw_text.strip()
            if text.startswith("```"):
                text = "\n".join(text.split("\n")[1:])
            if text.endswith("```"):
                text = "\n".join(text.split("\n")[:-1])
            if not text:
                raise ValueError("empty response")
            return json.loads(text)
        except (json.JSONDecodeError, ValueError) as e:
            print(
                f"  WARN: parse failed for {stem} (attempt {attempt}/{attempts}): {e}"
            )
        except Exception as e:
            print(
                f"  WARN: API call failed for {stem} (attempt {attempt}/{attempts}): {e}"
            )
    print(
        f"  ERROR: giving up on {stem}; raw saved to {floors_dir / f'{stem}_raw.txt'}"
    )
    return None


def extract_floor(
    pdf_stem: str,
    client: openai.OpenAI,
    pdf_dir: Path = PDF_DIR,
    floors_dir: Path = FLOORS_DIR,
    levels: list | None = None,
) -> list[dict]:
    """Extract one GA sheet into per-level floor JSON.

    levels: the floor level(s) this sheet maps to. When None, falls back to the
    hand-authored FLOOR_MAP (CLI / Arbor); the API passes inferred levels instead.
    """
    if levels is None:
        levels = FLOOR_MAP[pdf_stem]
    pdf_path = pdf_dir / f"{pdf_stem}.pdf"
    if not pdf_path.exists():
        print(f"  WARN: {pdf_path} not found, skipping")
        return []

    page = fitz.open(pdf_path)[0]

    print(f"  Rasterising {pdf_stem}...")
    png_bytes = rasterise(page)
    png_b64 = base64.standard_b64encode(png_bytes).decode()
    (floors_dir / f"{pdf_stem}.png").write_bytes(png_bytes)  # debug

    labels = embedded_labels(page)
    (floors_dir / f"{pdf_stem}_labels.json").write_text(json.dumps(labels, indent=2))
    print(
        f"  Embedded labels kept: {len(labels)} ({', '.join(l['text'] for l in labels[:8])}{'...' if len(labels) > 8 else ''})"
    )

    # Always describe ONE representative floor (levels[0]) — typical-floor GA sheets
    # show a single plan that repeats, and we replicate the result per level below.
    # Passing the level RANGE made the model scatter doors/rooms across 4 floor labels
    # in one response, so the prompt level is always a single number.
    level_str = str(levels[0])
    prompt = PROMPT.format(level=level_str, labels=_format_labels(labels))
    if len(levels) > 1:
        prompt += (
            f"\n\nNOTE: this GA sheet is the TYPICAL floor plan for levels "
            f"{levels[0]}–{levels[-1]} (an identical plan repeated). Describe it as a "
            f"SINGLE floor at level {level_str}: every room_id and door_id must use the "
            f"level-{level_str} prefix (e.g. L{int(level_str):02d}-01). Do NOT enumerate "
            f"the other levels — the plan is replicated for them automatically."
        )

    print(f"  Calling o3 vision for {pdf_stem}...")
    data = _call_o3(client, png_b64, prompt, pdf_stem, floors_dir=floors_dir)
    if data is None:
        return []

    # #1: deterministic text override — printed labels win where they sit in a room.
    assign_text_labels(data.get("rooms", []), labels)

    # If PDF covers multiple floors, replicate the room set for each
    results = []
    if len(levels) == 1:
        data["floor_level"] = levels[0]
        out = floors_dir / f"{pdf_stem}.json"
        out.write_text(json.dumps(data, indent=2))
        print(f"  Wrote {out}")
        results.append(data)
    else:
        base = levels[0]
        for lvl in levels:
            floor_data = json.loads(json.dumps(data))  # deep copy
            floor_data["floor_level"] = lvl
            for room in floor_data["rooms"]:
                room["room_id"] = _remap_level(room["room_id"], base, lvl)
                room["neighbours"] = [
                    _remap_level(n, base, lvl) for n in room.get("neighbours", [])
                ]
            for core in floor_data.get("core_elements", []):
                core["id"] = f"{core['id']}-L{lvl}"
            for door in floor_data.get("doors", []):
                door["door_id"] = _remap_level(door.get("door_id", ""), base, lvl)
                door["connects"] = [
                    _remap_level(c, base, lvl) for c in door.get("connects", [])
                ]
            out = floors_dir / f"{pdf_stem}_L{lvl}.json"
            out.write_text(json.dumps(floor_data, indent=2))
            print(f"  Wrote {out}")
            results.append(floor_data)

    return results


def run(pdf_dir, floors_dir, progress_cb=None) -> dict:
    """Ingest every floor-plan PDF in pdf_dir → per-level JSON in floors_dir.

    Floors are INFERRED per sheet (no FLOOR_MAP). Non-floor sheets (site plans,
    sections, DAS, registers) are skipped. ROOF markers resolve to one above the
    highest numeric level found. Returns a summary the API surfaces as A1 progress:

        {sheets_total, sheets_processed, floors_extracted, skipped[], low_confidence[]}

    progress_cb(done, total, stem) is called after each sheet so the caller can poll
    docs_processed / docs_total live. low_confidence flags any sheet whose level was a
    weak guess — a wrong level renders a wrong 3D model, so it must surface, not hide.
    """
    pdf_dir = Path(pdf_dir)
    floors_dir = Path(floors_dir)
    floors_dir.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(p for p in pdf_dir.glob("*.pdf"))

    # Pass 1: classify + infer levels for every sheet (cheap, local — no o3 yet) so we
    # know which are floor plans and can resolve ROOF against the real top level.
    plan: list[dict] = []
    skipped: list[dict] = []
    for pdf in pdfs:
        try:
            page = fitz.open(pdf)[0]
            levels, conf, reason = infer_floors(pdf.stem, page)
        except Exception as e:  # corrupt / unreadable PDF
            skipped.append({"sheet": pdf.stem, "reason": f"open failed: {e}"})
            continue
        if levels is None:
            skipped.append({"sheet": pdf.stem, "reason": reason})
            continue
        plan.append(
            {"stem": pdf.stem, "levels": levels, "conf": conf, "reason": reason}
        )

    # Resolve ROOF marker → highest numeric level + 1 (per building).
    numeric = [lvl for p in plan for lvl in p["levels"] if isinstance(lvl, int)]
    roof_level = (max(numeric) + 1) if numeric else 1
    for p in plan:
        p["levels"] = [roof_level if lvl == ROOF_MARKER else lvl for lvl in p["levels"]]

    # Collision flag: two sheets claiming the same level is a likely mis-inference.
    seen_levels: dict = {}
    for p in plan:
        for lvl in p["levels"]:
            seen_levels.setdefault(lvl, []).append(p["stem"])

    low_confidence: list[dict] = []
    for p in plan:
        collided = sorted(
            {
                s
                for lvl in p["levels"]
                for s in seen_levels.get(lvl, [])
                if s != p["stem"]
            }
        )
        if p["conf"] < 0.85 or collided:
            low_confidence.append(
                {
                    "sheet": p["stem"],
                    "levels": p["levels"],
                    "confidence": round(p["conf"], 2),
                    "reason": p["reason"],
                    "collides_with": collided,
                }
            )

    # Pass 2: the expensive o3 extraction, one sheet at a time, with progress.
    client = openai.OpenAI()
    total = len(plan)
    floors_extracted = 0
    for i, p in enumerate(plan, 1):
        print(f"\n--- {p['stem']} → levels {p['levels']} ({p['reason']}) ---")
        try:
            results = extract_floor(
                p["stem"],
                client,
                pdf_dir=pdf_dir,
                floors_dir=floors_dir,
                levels=p["levels"],
            )
            floors_extracted += len(results)
        except Exception as e:
            print(f"  ERROR extracting {p['stem']}: {e}")
            skipped.append({"sheet": p["stem"], "reason": f"extract failed: {e}"})
        if progress_cb:
            progress_cb(i, total, p["stem"])

    return {
        "sheets_total": total,
        "sheets_processed": total,
        "floors_extracted": floors_extracted,
        "skipped": skipped,
        "low_confidence": low_confidence,
    }


def main():
    client = openai.OpenAI()
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(FLOOR_MAP.keys())

    for stem in targets:
        if stem not in FLOOR_MAP:
            print(f"Unknown stem: {stem}. Valid: {list(FLOOR_MAP.keys())}")
            continue
        print(f"\n--- {stem} ---")
        extract_floor(stem, client)

    print("\nDone. Run graph_builder.py next.")


if __name__ == "__main__":
    main()
