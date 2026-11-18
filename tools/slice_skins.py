#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops


CELL = 64
SKINS = {
    "aztec": 25,
    "brushed-metal": 15,
    "carved-stone": 20,
    "gem-gloss": 20,
    "golden-dragon": 50,
    "holo-foil": 25,
    "lava": 25,
    "jelly-candy": 15,
    "nebula": 30,
    "neon-tube": 20,
    "pixel-16bit": 10,
    "porcelain": 10,
    "soft-clay": 15,
    "wood-inlay": 30,
}


def connected_boxes(mask):
    width, height = mask.size
    pixels = mask.tobytes()
    parents, boxes, previous = [], [], []

    def root(label):
        while label != parents[label]:
            parents[label] = parents[parents[label]]
            label = parents[label]
        return label

    for row in range(height):
        offset = row * width
        runs, column, cursor = [], 0, 0
        while column < width:
            start = pixels.find(b"\xff", offset + column, offset + width)
            if start == -1:
                break
            end = pixels.find(b"\x00", start, offset + width)
            left, right = start - offset, width if end == -1 else end - offset
            label = len(parents)
            parents.append(label)
            boxes.append((left, row, right, row + 1))
            while cursor < len(previous) and previous[cursor][1] < left:
                cursor += 1
            overlap = cursor
            while overlap < len(previous) and previous[overlap][0] <= right:
                parents[root(previous[overlap][2])] = label
                overlap += 1
            runs.append((left, right, label))
            column = right
        previous = runs

    components = {}
    for label, (left, top, right, bottom) in enumerate(boxes):
        leader = root(label)
        if leader in components:
            old_left, old_top, old_right, old_bottom = components[leader]
            left, top = min(left, old_left), min(top, old_top)
            right, bottom = max(right, old_right), max(bottom, old_bottom)
        components[leader] = (left, top, right, bottom)
    return components.values()


def tile_boxes(image):
    width, height = image.size
    perimeter = [image.getpixel((column, edge)) for column in range(width) for edge in (0, height - 1)]
    perimeter += [image.getpixel((edge, row)) for row in range(height) for edge in (0, width - 1)]
    background = tuple(int(median(channel)) for channel in zip(*perimeter))
    red, green, blue = ImageChops.difference(image, Image.new("RGB", image.size, background)).split()
    distance = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    mask = distance.point(lambda value: 255 if value > 24 else 0)
    boxes = [box for box in connected_boxes(mask)
             if box[2] - box[0] >= width / 6 and box[3] - box[1] >= height / 6]
    if len(boxes) != 9:
        raise ValueError(f"expected 9 tile components, found {len(boxes)}")
    by_row = sorted(boxes, key=lambda box: box[1] + box[3])
    rows = [sorted(by_row[start:start + 3], key=lambda box: box[0]) for start in (0, 3, 6)]
    if (any(max(box[3] for box in upper) > min(box[1] for box in lower)
            for upper, lower in zip(rows, rows[1:]))
            or any(left[2] > right[0] for row in rows for left, right in zip(row, row[1:]))
            or any(not 0.8 <= (right - left) / (bottom - top) <= 1.25 for left, top, right, bottom in boxes)):
        raise ValueError("tile components do not form a separated 3×3 grid of squares")
    return [box for row in rows for box in row]


def slice_grid(source):
    with Image.open(source) as original:
        image = original.convert("RGB")
    atlas = Image.new("RGB", (CELL * 9, CELL))
    for index, (left, top, right, bottom) in enumerate(tile_boxes(image)):
        side = max(right - left, bottom - top)
        x, y = (left + right - side) // 2, (top + bottom - side) // 2
        tile = image.crop((x, y, x + side, y + side)).resize((CELL, CELL), Image.Resampling.LANCZOS)
        atlas.paste(tile, (index * CELL, 0))
    return atlas


def main():
    parser = argparse.ArgumentParser(description="Slice nine-color artwork grids into block skin atlases.")
    parser.add_argument("--source", type=Path, default=Path("/tmp/lb-skins/grid"))
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "assets" / "skins")
    args = parser.parse_args()
    atlases, failed = {}, []
    for key in SKINS:
        try:
            atlases[key] = slice_grid(args.source / f"{key}.png")
        except (OSError, ValueError) as error:
            print(f"{key}: {error}", file=sys.stderr)
            failed.append(key)
    if failed:
        parser.exit(1, f"Failed slicing: {', '.join(failed)}\n")

    args.output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for key, atlas in atlases.items():
        file = f"{key}.png"
        atlas.save(args.output / file, optimize=True)
        manifest.append(dict(key=key, name=key.replace("-", " ").title(), cost=SKINS[key], file=file, cell=CELL))
    catalog = json.dumps(manifest, indent=2)
    (args.output / "skins.json").write_text(catalog + "\n", encoding="utf-8")
    (args.output / "catalog.js").write_text(f"window.LBImageSkins = {catalog};\n", encoding="utf-8")
    print(f"Sliced {len(manifest)} skin atlases into {args.output}")


if __name__ == "__main__":
    main()
