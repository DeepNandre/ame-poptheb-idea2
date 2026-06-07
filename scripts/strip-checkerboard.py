#!/usr/bin/env python3
"""Remove baked-in PNG checkerboard backgrounds via corner flood-fill."""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image


def is_background(r: int, g: int, b: int) -> bool:
    if abs(r - g) > 12 or abs(g - b) > 12:
        return False
    # checkerboard grays / whites, or studio black backdrops from image gen
    return r >= 115 or r <= 24


def flood_transparent(path: Path, out: Path) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_background(*px[x, y][:3]):
                q.append((x, y))
                visited[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y][x] and is_background(*px[x, y][:3]):
                q.append((x, y))
                visited[y][x] = True

    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if is_background(*px[nx, ny][:3]):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    im.save(out, optimize=True)


if __name__ == "__main__":
    for src in sys.argv[1:]:
        p = Path(src)
        flood_transparent(p, p)
