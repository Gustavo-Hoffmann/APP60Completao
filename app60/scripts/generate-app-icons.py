#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE = Path(
    "/Users/Rodacki/.cursor/projects/Users-Rodacki-Desktop-Hoffmann-Work-APP60/assets/"
    "LOGO_MOBILE_SS_2-dbe31234-0cc4-41a7-b395-8d06b1f35289.png"
)

ICON_TOP = 212
ICON_BOTTOM = 729
ICON_LEFT = 263
ICON_RIGHT = 810
ANDROID_BACKGROUND = "#E6F4FE"
MONOCHROME_COLOR = "#003366"


def crop_icon(source: Image.Image) -> Image.Image:
    return source.crop((ICON_LEFT, ICON_TOP, ICON_RIGHT, ICON_BOTTOM))


def fit_square(image: Image.Image, size: int, background: str | tuple[int, int, int, int]) -> Image.Image:
    width, height = image.size
    scale = min(size / width, size / height)
    resized = image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), background)
    offset = ((size - resized.width) // 2, (size - resized.height) // 2)
    canvas.paste(resized, offset, resized if resized.mode == "RGBA" else None)
    return canvas


def build_monochrome(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    mono = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    mono_pixels = mono.load()
    color = Image.new("RGB", (1, 1), MONOCHROME_COLOR).getpixel((0, 0))

    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 16:
                continue
            if red > 245 and green > 245 and blue > 245:
                continue
            mono_pixels[x, y] = (*color, alpha)

    return mono


def build_favicon(image: Image.Image) -> Image.Image:
    square = fit_square(image, 48, (255, 255, 255, 255))
    return square.convert("RGB")


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    icon_crop = crop_icon(source)

    app_icon = fit_square(icon_crop, 1024, (255, 255, 255, 255)).convert("RGB")
    app_icon.save(ASSETS / "icon.png", format="PNG", optimize=True)

    foreground = fit_square(icon_crop, 1024, (0, 0, 0, 0))
    foreground.save(ASSETS / "android-icon-foreground.png", format="PNG", optimize=True)

    background = Image.new("RGB", (1024, 1024), ANDROID_BACKGROUND)
    background.save(ASSETS / "android-icon-background.png", format="PNG", optimize=True)

    monochrome = build_monochrome(foreground)
    monochrome.save(ASSETS / "android-icon-monochrome.png", format="PNG", optimize=True)

    splash = fit_square(icon_crop, 1024, (255, 255, 255, 255)).convert("RGB")
    splash.save(ASSETS / "splash-icon.png", format="PNG", optimize=True)

    favicon = build_favicon(icon_crop)
    favicon.save(ASSETS / "favicon.png", format="PNG", optimize=True)


if __name__ == "__main__":
    main()
