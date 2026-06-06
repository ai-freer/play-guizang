from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references" / "02-5x5-meme-matrix.png"
OUT_DIR = ROOT / "public" / "assets" / "tiles"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    src = Image.open(SOURCE).convert("RGBA")
    sw, sh = src.size
    index = 1
    for row in range(5):
        for col in range(5):
            x0 = int(col * sw / 5) + 8
            y0 = int(row * sh / 5) + 8
            x1 = int((col + 1) * sw / 5) - 8
            y1 = int((row + 1) * sh / 5) - 8
            tile = src.crop((x0, y0, x1, y1)).resize((256, 256), Image.Resampling.LANCZOS)
            tile.save(OUT_DIR / f"tile-{index:02d}.png")
            index += 1
    print(f"Wrote 25 tiles to {OUT_DIR}")


if __name__ == "__main__":
    main()
