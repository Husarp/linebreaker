import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


CRATES = {
    'common': ((39, 110, 184, 244), [(45, 139), (53, 132), (103, 116), (165, 129), (177, 135), (177, 159), (173, 164), (172, 216), (128, 240), (49, 223), (49, 170), (45, 168)]),
    'rare': ((203, 98, 350, 245), [(210, 140), (222, 132), (270, 116), (333, 127), (343, 134), (343, 159), (338, 166), (337, 220), (293, 241), (216, 225), (215, 172), (211, 170)]),
    'epic': ((359, 88, 521, 246), [(375, 137), (384, 131), (435, 116), (495, 127), (507, 134), (507, 158), (503, 166), (502, 216), (458, 241), (380, 223), (380, 170), (376, 168)]),
    'legendary': ((520, 71, 691, 248), [(541, 137), (553, 129), (601, 113), (666, 126), (678, 133), (678, 161), (673, 168), (672, 217), (626, 243), (546, 225), (546, 170), (542, 168)]),
    'mythic': ((695, 53, 882, 252), [(716, 136), (724, 128), (775, 111), (849, 121), (861, 129), (860, 161), (854, 170), (853, 222), (803, 249), (720, 229), (720, 174), (716, 169)]),
}


def smooth(low, high, value):
    fraction = max(0, min(1, (value - low) / (high - low)))
    return fraction * fraction * (3 - 2 * fraction)


def extract(source, bounds, outline):
    scale = source.width / 900
    left, top, right, bottom = (round(value * scale) for value in bounds)
    crop = source.crop((left, top, right, bottom))
    silhouette = Image.new('L', crop.size)
    ImageDraw.Draw(silhouette).polygon(
        [(round(point_x * scale) - left, round(point_y * scale) - top) for point_x, point_y in outline], fill=255,
    )
    silhouette = silhouette.filter(ImageFilter.GaussianBlur(1.25))
    pixels = []
    for index, ((red, green, blue), mask) in enumerate(zip(crop.getdata(), silhouette.getdata())):
        pixel_x, pixel_y = index % crop.width, index // crop.width
        value = max(red, green, blue)
        solid = mask / 255 * smooth(19, 45, value)
        feather = smooth(0, 10 * scale, min(pixel_x, crop.width - 1 - pixel_x, pixel_y))
        floor = 1 - smooth(196 * scale, 213 * scale, top + pixel_y)
        glow = 0.9 * smooth(48, 227, value) * feather * floor
        alpha = round(255 * max(solid, glow))
        pixels.append((red, green, blue, alpha) if alpha else (0, 0, 0, 0))
    result = Image.new('RGBA', crop.size)
    result.putdata(pixels)
    return result


def crimson(rainbow):
    hsv = rainbow.convert('RGB').convert('HSV')
    colors = []
    for hue, saturation, value in hsv.getdata():
        gold = smooth(16, 27, hue) * (1 - smooth(39, 51, hue)) * smooth(148, 215, value)
        if gold >= 0.8:
            colors.append((hue, saturation, value))
        else:
            crimson_hue = (248 + round(13 * hue / 255)) % 256
            crimson_value = round(value * (0.68 + 0.32 * smooth(124, 255, value)))
            colors.append((crimson_hue, min(215, round(saturation * 0.95)), crimson_value))
    hsv.putdata(colors)
    result = hsv.convert('RGB')
    result.putalpha(rainbow.getchannel('A'))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path, nargs='?', default=Path('assets/ui/crates'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    source = Image.open(args.source).convert('RGB')
    for rarity, (bounds, outline) in CRATES.items():
        image = extract(source, bounds, outline)
        if rarity == 'mythic':
            image.save(args.output / 'mythic-rainbow.png', optimize=True)
            image = crimson(image)
        image.save(args.output / f'{rarity}.png', optimize=True)


if __name__ == '__main__':
    main()
