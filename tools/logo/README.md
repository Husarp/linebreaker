# Block-built logo

V3 uses native 8×8, 1-bit glyph masks from the bundled Press Start 2P font. The generator trims only empty side bearings and the shared blank bottom row, then leaves one block between glyphs. The font license is in `assets/fonts/OFL.txt`.

From the repository root, regenerate the masks with Python 3 and Pillow, then generate the SVG and 3840px transparent PNG with Node and FFmpeg (librsvg decoder):

```sh
python3 tools/logo/rasterize-glyphs.py > tools/logo/press-start-2p.json
node tools/logo/blocks-logo.js
```

To also render a self-contained comparison demo, pass `--demo OUTPUT.html V1.svg V2.svg` to the Node command. The original V1 is `design/logo/logo-v1.svg` in the main checkout; V2 is `assets/ui/logo-blocks.svg` at `e4055f9`.
