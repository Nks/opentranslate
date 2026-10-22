"""OpenTranslate Desktop icon asset generator.

Reads ``.claude-flow/data/opentranslate.png`` (1254x1254 RGB, no alpha) and
produces the full electron-builder icon set under ``build/``:

- ``build/icon.png``                                1024x1024 RGBA
- ``build/icon.ico``                                multi-res 16-256
- ``build/icons/{512,256,128,64,32}x{...}.png``     color RGBA
- ``build/icons/tray/trayTemplate.png``             22x22 macOS template (black + alpha)
- ``build/icons/tray/trayTemplate@2x.png``          44x44 retina template
- ``build/icons/tray/tray.ico``                     Windows tray multi-res 16/24/32
- ``build/icons/tray/tray.png``                     22x22 RGBA color (Linux StatusNotifier)
- ``build/background.png``                          540x380 DMG canvas
- ``build/background@2x.png``                       1080x760 retina DMG canvas
- ``build/background-preview.png``                  preview of DMG layout with placeholders

Idempotent. Network-free. Strips PNG metadata for deterministic bytes.

CLI flags:
- ``--background-only``  regenerate only the DMG background trio; leave icons.

Background-key procedure:
- Samples 4 corner pixels; if all within ``EPSILON`` of each other treats as flat bg.
- Builds binary alpha mask then feathers with a Gaussian radius=1 to soften edges.
- If corners disagree, skips tray template generation and writes a README under
  ``build/icons/tray/`` documenting the need for a hand-drawn 22x22 template.

DMG note: ``DMG_LOGO_SIZE = 0`` ships the background as plain canvas, leaving
the decorative logo absent so electron-builder's runtime app icon + Applications
link sit on flat color. Restore the decorative logo by setting a positive size
and a logo position.
"""

from __future__ import annotations

import argparse
import io
import math
import struct
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / ".claude-flow" / "data" / "opentranslate.png"
BUILD_DIR = REPO_ROOT / "build"
ICONS_DIR = BUILD_DIR / "icons"
TRAY_DIR = ICONS_DIR / "tray"

EPSILON = 8
FEATHER_RADIUS = 1.0

COLOR_SIZES = [32, 64, 128, 256, 512]
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
TRAY_ICO_SIZES = [16, 24, 32]
TRAY_SIZE = 22
TRAY_RETINA_SIZE = 44
MASTER_SIZE = 1024

DMG_SIZE = (540, 380)
DMG_RETINA_SIZE = (1080, 760)
DMG_BG_COLOR = (245, 245, 245, 255)
DMG_LOGO_SIZE = 0
DMG_LOGO_POS = (135, 190)


def ensure_dirs() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    TRAY_DIR.mkdir(parents=True, exist_ok=True)


def load_source() -> Image.Image:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"source missing: {SOURCE_PATH}")
    return Image.open(SOURCE_PATH).convert("RGB")


def detect_background(source: Image.Image) -> tuple[tuple[int, int, int] | None, bool]:
    width, height = source.size
    corners = [
        source.getpixel((0, 0)),
        source.getpixel((width - 1, 0)),
        source.getpixel((0, height - 1)),
        source.getpixel((width - 1, height - 1)),
    ]
    base = corners[0]
    uniform = all(
        max(abs(component - base[index]) for index, component in enumerate(corner))
        <= EPSILON
        for corner in corners
    )
    if not uniform:
        return None, False
    average = tuple(
        sum(corner[channel] for corner in corners) // len(corners)
        for channel in range(3)
    )
    return average, True


def key_background(source: Image.Image, bg_color: tuple[int, int, int]) -> Image.Image:
    rgba = source.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    mask = Image.new("L", (width, height), 0)
    mask_pixels = mask.load()
    bg_r, bg_g, bg_b = bg_color
    for row in range(height):
        for col in range(width):
            pixel_r, pixel_g, pixel_b, _ = pixels[col, row]
            distance = max(
                abs(pixel_r - bg_r),
                abs(pixel_g - bg_g),
                abs(pixel_b - bg_b),
            )
            mask_pixels[col, row] = 0 if distance <= EPSILON else 255
    feathered = mask.filter(ImageFilter.GaussianBlur(radius=FEATHER_RADIUS))
    rgba.putalpha(feathered)
    return rgba


def fit_to_square(image: Image.Image, target: int) -> Image.Image:
    width, height = image.size
    longest = max(width, height)
    if longest == target:
        if width == height:
            return image
    scale = target / longest
    new_width = max(1, round(width * scale))
    new_height = max(1, round(height * scale))
    scaled = image.resize((new_width, new_height), Image.LANCZOS)
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    offset_x = (target - new_width) // 2
    offset_y = (target - new_height) // 2
    canvas.alpha_composite(scaled, (offset_x, offset_y))
    return canvas


def save_png_deterministic(image: Image.Image, destination: Path) -> None:
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    cleaned = strip_png_metadata(buffer.getvalue())
    destination.write_bytes(cleaned)


def strip_png_metadata(data: bytes) -> bytes:
    signature = data[:8]
    if signature != b"\x89PNG\r\n\x1a\n":
        return data
    keep_types = {b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS", b"acTL", b"fcTL", b"fdAT"}
    output = bytearray(signature)
    cursor = 8
    while cursor < len(data):
        if cursor + 8 > len(data):
            break
        length = struct.unpack(">I", data[cursor : cursor + 4])[0]
        chunk_type = data[cursor + 4 : cursor + 8]
        chunk_end = cursor + 8 + length + 4
        if chunk_type in keep_types:
            output.extend(data[cursor:chunk_end])
        cursor = chunk_end
    return bytes(output)


def write_color_icon_set(master_rgba: Image.Image) -> list[tuple[str, int, int, int]]:
    results: list[tuple[str, int, int, int]] = []
    primary = ICONS_DIR.parent / "icon.png"
    save_png_deterministic(master_rgba, primary)
    results.append(file_record(primary))
    for size in COLOR_SIZES:
        scaled = master_rgba.resize((size, size), Image.LANCZOS)
        destination = ICONS_DIR / f"{size}x{size}.png"
        save_png_deterministic(scaled, destination)
        results.append(file_record(destination))
    return results


def write_main_ico(master_rgba: Image.Image) -> tuple[str, int, int, int]:
    destination = BUILD_DIR / "icon.ico"
    frames = [master_rgba.resize((size, size), Image.LANCZOS) for size in ICO_SIZES]
    largest = frames[-1]
    largest.save(
        destination,
        format="ICO",
        sizes=[(size, size) for size in ICO_SIZES],
        append_images=frames[:-1],
    )
    return file_record(destination)


def write_tray_ico(master_rgba: Image.Image) -> tuple[str, int, int, int]:
    destination = TRAY_DIR / "tray.ico"
    frames = [master_rgba.resize((size, size), Image.LANCZOS) for size in TRAY_ICO_SIZES]
    largest = frames[-1]
    largest.save(
        destination,
        format="ICO",
        sizes=[(size, size) for size in TRAY_ICO_SIZES],
        append_images=frames[:-1],
    )
    return file_record(destination)


def build_template_image(master_rgba: Image.Image, target: int) -> Image.Image:
    scaled = master_rgba.resize((target, target), Image.LANCZOS)
    grayscale = scaled.convert("L")
    alpha_source = scaled.split()[-1]
    width, height = scaled.size
    template = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gray_pixels = grayscale.load()
    alpha_pixels = alpha_source.load()
    template_pixels = template.load()
    for row in range(height):
        for col in range(width):
            subject_alpha = alpha_pixels[col, row]
            if subject_alpha == 0:
                template_pixels[col, row] = (0, 0, 0, 0)
                continue
            darkness = 255 - gray_pixels[col, row]
            combined = round(darkness * (subject_alpha / 255.0))
            template_pixels[col, row] = (0, 0, 0, max(0, min(255, combined)))
    return template


def write_tray_assets(master_rgba: Image.Image) -> list[tuple[str, int, int, int]]:
    records: list[tuple[str, int, int, int]] = []
    color_tray = master_rgba.resize((TRAY_SIZE, TRAY_SIZE), Image.LANCZOS)
    color_destination = TRAY_DIR / "tray.png"
    save_png_deterministic(color_tray, color_destination)
    records.append(file_record(color_destination))
    template_small = build_template_image(master_rgba, TRAY_SIZE)
    template_path = TRAY_DIR / "trayTemplate.png"
    save_png_deterministic(template_small, template_path)
    records.append(file_record(template_path))
    template_large = build_template_image(master_rgba, TRAY_RETINA_SIZE)
    template_retina_path = TRAY_DIR / "trayTemplate@2x.png"
    save_png_deterministic(template_large, template_retina_path)
    records.append(file_record(template_retina_path))
    records.append(write_tray_ico(master_rgba))
    return records


def build_dmg_background(
    master_rgba: Image.Image,
    canvas_size: tuple[int, int],
    logo_size: int,
    logo_position: tuple[int, int],
) -> Image.Image:
    canvas = Image.new("RGBA", canvas_size, DMG_BG_COLOR)
    if logo_size <= 0:
        return canvas
    logo = master_rgba.resize((logo_size, logo_size), Image.LANCZOS)
    canvas.alpha_composite(logo, logo_position)
    return canvas


def write_dmg_backgrounds(master_rgba: Image.Image) -> list[tuple[str, int, int, int]]:
    records: list[tuple[str, int, int, int]] = []
    standard = build_dmg_background(master_rgba, DMG_SIZE, DMG_LOGO_SIZE, DMG_LOGO_POS)
    standard_path = BUILD_DIR / "background.png"
    save_png_deterministic(standard, standard_path)
    records.append(file_record(standard_path))
    retina_logo = DMG_LOGO_SIZE * 2
    retina_position = (DMG_LOGO_POS[0] * 2, DMG_LOGO_POS[1] * 2)
    retina = build_dmg_background(master_rgba, DMG_RETINA_SIZE, retina_logo, retina_position)
    retina_path = BUILD_DIR / "background@2x.png"
    save_png_deterministic(retina, retina_path)
    records.append(file_record(retina_path))
    preview = build_dmg_preview(standard)
    preview_path = BUILD_DIR / "background-preview.png"
    save_png_deterministic(preview, preview_path)
    records.append(file_record(preview_path))
    return records


def build_dmg_preview(base: Image.Image) -> Image.Image:
    preview = base.copy()
    draw = ImageDraw.Draw(preview)
    app_slot = (130 - 32, 150 - 32, 130 + 32, 150 + 32)
    applications_slot = (410 - 32, 150 - 32, 410 + 32, 150 + 32)
    draw.rectangle(app_slot, outline=(120, 120, 120, 255), width=2)
    draw.rectangle(applications_slot, outline=(120, 120, 120, 255), width=2)
    draw.text((130 - 20, 150 + 36), "app", fill=(80, 80, 80, 255))
    draw.text((410 - 32, 150 + 36), "/Applications", fill=(80, 80, 80, 255))
    return preview


def file_record(path: Path) -> tuple[str, int, int, int]:
    with Image.open(path) as image:
        width, height = image.size
    return (str(path.relative_to(REPO_ROOT)), width, height, path.stat().st_size)


def write_tray_fallback_note(reason: str) -> None:
    TRAY_DIR.mkdir(parents=True, exist_ok=True)
    note_path = TRAY_DIR / "README.md"
    body = (
        "# Tray template asset required\n\n"
        f"Automated generation skipped. Reason: {reason}\n\n"
        "A hand-drawn 22x22 (and 44x44) macOS template image is required:\n"
        "- Black-only (R=G=B=0) with alpha-only shape.\n"
        "- File name must end in `Template.png` (and `Template@2x.png`).\n"
        "- macOS auto-retints for menubar light/dark mode.\n"
    )
    note_path.write_text(body, encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build OpenTranslate Desktop icon + DMG assets.")
    parser.add_argument(
        "--background-only",
        action="store_true",
        help="Regenerate only the DMG background trio; leave icons untouched.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    ensure_dirs()
    source = load_source()
    bg_color, uniform = detect_background(source)
    if not uniform or bg_color is None:
        print("WARNING: background corners disagree; cannot key transparency reliably.")
        opaque_master = source.convert("RGBA")
        master = fit_to_square(opaque_master, MASTER_SIZE)
        if args.background_only:
            records = write_dmg_backgrounds(master)
        else:
            records = write_color_icon_set(master)
            records.append(write_main_ico(master))
            records.extend(write_dmg_backgrounds(master))
            write_tray_fallback_note("source background not uniform within epsilon")
        for record in records:
            relative, width, height, size_bytes = record
            print(f"{relative}\t{width}x{height}\t{size_bytes} bytes")
        return 0
    print(f"keyed background color: rgb{bg_color} (epsilon={EPSILON})")
    keyed = key_background(source, bg_color)
    master = fit_to_square(keyed, MASTER_SIZE)
    if args.background_only:
        records = write_dmg_backgrounds(master)
    else:
        records = write_color_icon_set(master)
        records.append(write_main_ico(master))
        records.extend(write_tray_assets(master))
        records.extend(write_dmg_backgrounds(master))
        verify_outputs(records)
    for record in records:
        relative, width, height, size_bytes = record
        print(f"{relative}\t{width}x{height}\t{size_bytes} bytes")
    return 0


def verify_outputs(records: list[tuple[str, int, int, int]]) -> None:
    for relative, width, height, _ in records:
        path = REPO_ROOT / relative
        with Image.open(path) as image:
            if path.suffix == ".png":
                if image.mode != "RGBA":
                    raise AssertionError(f"{relative} not RGBA, mode={image.mode}")
            if path.name in {"trayTemplate.png", "trayTemplate@2x.png"}:
                verify_template_pixels(image, relative)
            if path.suffix == ".ico":
                frames = list(extract_ico_sizes(path))
                if not frames:
                    raise AssertionError(f"{relative} has no frames")


def verify_template_pixels(image: Image.Image, relative: str) -> None:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    samples = 0
    target_samples = 100
    visited = 0
    max_visits = width * height
    while samples < target_samples and visited < max_visits:
        col = (visited * 2654435761) % width
        row = ((visited * 40503) ^ (visited >> 3)) % height
        visited += 1
        red, green, blue, alpha = pixels[col, row]
        if alpha == 0:
            continue
        if (red, green, blue) != (0, 0, 0):
            raise AssertionError(
                f"{relative} template pixel non-black at ({col},{row}): "
                f"rgba=({red},{green},{blue},{alpha})"
            )
        samples += 1


def extract_ico_sizes(path: Path) -> list[tuple[int, int]]:
    data = path.read_bytes()
    if len(data) < 6:
        return []
    count = struct.unpack("<H", data[4:6])[0]
    sizes: list[tuple[int, int]] = []
    offset = 6
    for _ in range(count):
        if offset + 16 > len(data):
            break
        width_byte = data[offset]
        height_byte = data[offset + 1]
        width = width_byte if width_byte else 256
        height = height_byte if height_byte else 256
        sizes.append((width, height))
        offset += 16
    return sizes


if __name__ == "__main__":
    sys.exit(main())
