#!/usr/bin/env python3
"""
Generate OG (Open Graph) social media thumbnail for GeopoliticsAI.com.
Renders the complete world map projected in Natural Earth (matching D3.js)
with all countries colored according to their live geopolitical AI governance alliance.
Produces og-thumbnail.png (1200x630) with bold, high-contrast, easily readable typography,
a single-line header with 'Interactive Map' inline, and a split dual-legend layout
(Pacific Ocean on far left with extra-large fonts, and bottom-right aligned on right).

Usage: python3 scripts/generate_thumbnail.py
Dependencies: Pillow (pip install Pillow)
"""

import json
import math
import os
from PIL import Image, ImageDraw, ImageFont

# Path configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
WORLD_TOPO_PATH = os.path.join(PROJECT_ROOT, "data", "world-110m.json")
COUNTRIES_DATA_PATH = os.path.join(PROJECT_ROOT, "data", "countries.json")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "og-thumbnail.png")

# Output dimensions (Standard Open Graph 1.91:1)
TARGET_W, TARGET_H = 1200, 630

# 2x supersampling factor for silky-smooth antialiasing
SCALE = 2
W, H = TARGET_W * SCALE, TARGET_H * SCALE

# Project Palette (Dark Mode colors matching js/map.js)
BG_COLOR = (11, 15, 25, 255)         # #0b0f19
BORDER_NEUTRAL = (40, 52, 72, 220)   # subtle border for unaligned
BORDER_ALIGNED = (11, 15, 25, 200)   # clean border between aligned states

COLOR_MAP = {
    'tripartite': (168, 85, 247, 255),      # #a855f7 (Purple)
    'waico_pax': (192, 132, 252, 255),      # #c084fc
    'pax_frontier': (20, 184, 166, 255),    # #14b8a6 (Teal)
    'waico_frontier': (249, 115, 22, 255),  # #f97316 (Orange)
    'waico_only': (239, 68, 68, 255),       # #ef4444 (Red)
    'pax_only': (59, 130, 246, 255),        # #3b82f6 (Blue)
    'frontier_only': (245, 158, 11, 255),   # #f59e0b (Amber/Gold)
    'none': (30, 41, 59, 255),              # #1e293b (Slate unaligned)
}


def load_fonts():
    """Load bold and regular system fonts with cross-platform fallbacks."""
    bold_candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Verdana Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    regular_candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Verdana.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]

    def find_font(paths, size, bold=False):
        for p in paths:
            if os.path.exists(p):
                try:
                    if p.endswith(".ttc"):
                        return ImageFont.truetype(p, size, index=1 if bold else 0)
                    return ImageFont.truetype(p, size)
                except Exception:
                    continue
        return ImageFont.load_default()

    return {
        "title": find_font(bold_candidates, 52 * SCALE, bold=True),
        "inter": find_font(regular_candidates, 30 * SCALE, bold=False),
        # Left legend has extra-large font size
        "left_item": find_font(bold_candidates, 28 * SCALE, bold=True),
        "left_count": find_font(regular_candidates, 23 * SCALE, bold=False),
        # Right legend has enlarged font size
        "right_item": find_font(bold_candidates, 24 * SCALE, bold=True),
        "right_count": find_font(regular_candidates, 20 * SCALE, bold=False),
    }


def natural_earth_projection(lon_deg, lat_deg):
    """
    Natural Earth 1 projection formula matching d3.geoNaturalEarth1().
    Returns Cartesian (x, y) coordinates on plane.
    """
    lam = math.radians(lon_deg)
    phi = math.radians(lat_deg)
    phi2 = phi * phi
    phi4 = phi2 * phi2

    x = lam * (
        0.8707
        - 0.131979 * phi2
        + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))
    )
    y = phi * (
        1.007226
        + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))
    )
    return x, y


def split_ring_at_antimeridian(ring):
    """
    Splits polygon rings that cross the 180° antimeridian (e.g. Russia/Chukotka,
    Wrangel Island, Fiji) to prevent horizontal streaks across the map canvas.
    """
    n = len(ring)
    if n < 3:
        return [ring]

    jumps = []
    for i in range(n):
        p1 = ring[i]
        p2 = ring[(i + 1) % n]
        if abs(p2[0] - p1[0]) > 180:
            jumps.append(i)

    if not jumps:
        return [ring]

    # Two jumps: ring enters the opposite hemisphere and comes back
    if len(jumps) == 2:
        i1, i2 = jumps[0], jumps[1]
        p_i1 = ring[i1]
        sign1 = 1 if p_i1[0] > 0 else -1

        # Segment in hemisphere sign1
        seg1 = []
        curr = (i2 + 1) % n
        while True:
            seg1.append(ring[curr])
            if curr == i1:
                break
            curr = (curr + 1) % n
        lat_end1 = ring[i1][1]
        lat_start1 = ring[(i2 + 1) % n][1]
        ring1 = [(sign1 * 180.0, lat_start1)] + seg1 + [(sign1 * 180.0, lat_end1)]

        # Segment in hemisphere -sign1
        seg2 = []
        curr = (i1 + 1) % n
        while True:
            seg2.append(ring[curr])
            if curr == i2:
                break
            curr = (curr + 1) % n
        lat_end2 = ring[i2][1]
        lat_start2 = ring[(i1 + 1) % n][1]
        ring2 = [(-sign1 * 180.0, lat_start2)] + seg2 + [(-sign1 * 180.0, lat_end2)]

        return [ring1, ring2]

    # Single jump / boundary touch fixup
    fixed = []
    for i, p in enumerate(ring):
        lon, lat = p
        if i > 0:
            prev_lon = fixed[-1][0]
            if abs(lon - prev_lon) > 180:
                if abs(lon + 180.0) < 0.1 and prev_lon > 0:
                    lon = 180.0
                elif abs(lon - 180.0) < 0.1 and prev_lon < 0:
                    lon = -180.0
        fixed.append((lon, lat))
    return [fixed]


def decode_topojson(topo_path):
    """Decode TopoJSON geometry collections into rings of (lon, lat)."""
    with open(topo_path, "r", encoding="utf-8") as f:
        topo = json.load(f)

    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]

    # Decode all delta-encoded arcs
    decoded_arcs = []
    for arc in topo["arcs"]:
        coords = []
        x, y = 0, 0
        for dx, dy in arc:
            x += dx
            y += dy
            lon = x * scale[0] + translate[0]
            lat = y * scale[1] + translate[1]
            coords.append((lon, lat))
        decoded_arcs.append(coords)

    def get_arc(i):
        return decoded_arcs[i] if i >= 0 else list(reversed(decoded_arcs[~i]))

    def decode_ring(arc_indices):
        ring = []
        for idx in arc_indices:
            arc = get_arc(idx)
            ring.extend(arc if not ring else arc[1:])
        return ring

    countries = []
    for geom in topo["objects"]["countries"]["geometries"]:
        a3 = geom["properties"].get("a3", "")
        num = str(geom.get("id", "")).zfill(3)
        name = geom["properties"].get("name", "")

        raw_rings = []
        if geom["type"] == "Polygon":
            for r in geom["arcs"]:
                raw_rings.append(decode_ring(r))
        elif geom["type"] == "MultiPolygon":
            for poly in geom["arcs"]:
                for r in poly:
                    raw_rings.append(decode_ring(r))

        clean_rings = []
        for r in raw_rings:
            for split_r in split_ring_at_antimeridian(r):
                if len(split_r) >= 3:
                    clean_rings.append(split_r)

        countries.append({
            "a3": a3,
            "numeric": num,
            "name": name,
            "rings": clean_rings
        })

    return countries


def render_thumbnail():
    """Generate high-resolution Open Graph thumbnail image."""
    # Check data files
    if not os.path.exists(WORLD_TOPO_PATH):
        raise FileNotFoundError(f"Missing {WORLD_TOPO_PATH}")
    if not os.path.exists(COUNTRIES_DATA_PATH):
        raise FileNotFoundError(f"Missing {COUNTRIES_DATA_PATH}")

    # Load country database
    with open(COUNTRIES_DATA_PATH, "r", encoding="utf-8") as f:
        country_db = json.load(f).get("countries", {})

    # Load country polygons
    countries = decode_topojson(WORLD_TOPO_PATH)

    # Initialize fonts
    fonts = load_fonts()

    # Create canvas
    img = Image.new("RGBA", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img, "RGBA")

    # Map projection scale and center:
    # Translated 35px to the left to give Australia/NZ plenty of room from right card
    shift_x = -35 * SCALE
    map_scale = 176 * SCALE
    map_cx = (W / 2) + shift_x
    px_c, py_c = natural_earth_projection(0, 9.5)
    map_cy = (88 * SCALE) + (530 * SCALE - 88 * SCALE) / 2 + py_c * map_scale

    def to_screen(lon, lat):
        px, py = natural_earth_projection(lon, lat)
        return (map_cx + px * map_scale, map_cy - py * map_scale)

    # Subtle radial illumination behind the globe center
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    center_x = map_cx
    center_y = H * 0.48
    max_r = int(W * 0.55)
    for r in range(max_r, 0, -20):
        alpha = int(22 * (1.0 - r / max_r))
        gdraw.ellipse(
            [center_x - r, center_y - r * 0.6, center_x + r, center_y + r * 0.6],
            fill=(30, 58, 110, alpha)
        )
    img.paste(glow, (0, 0), glow)
    draw = ImageDraw.Draw(img, "RGBA")

    # Graticules (Parallels and Meridians)
    for lat in range(-60, 81, 30):
        line_pts = [to_screen(lon, lat) for lon in range(-180, 181, 4)]
        draw.line(line_pts, fill=(30, 41, 59, 110), width=int(1.2 * SCALE))

    for lon in range(-180, 181, 30):
        line_pts = [to_screen(lon, lat) for lat in range(-70, 85, 3)]
        draw.line(line_pts, fill=(30, 41, 59, 110), width=int(1.2 * SCALE))

    # Match country alignments
    neutral_countries = []
    aligned_countries = []

    for c in countries:
        a3 = c["a3"]
        num = c["numeric"]
        match = country_db.get(a3) or next(
            (v for v in country_db.values() if v.get("numeric") == num), None
        )
        cat = match.get("alignment_category", "none") if match else "none"

        # Project polygons to screen pixels
        screen_polys = []
        for ring in c["rings"]:
            screen_ring = [to_screen(p[0], p[1]) for p in ring]
            if len(screen_ring) >= 3:
                screen_polys.append(screen_ring)

        item = (a3, c["name"], cat, screen_polys)
        if cat == "none":
            neutral_countries.append(item)
        else:
            aligned_countries.append(item)

    # 1. Render neutral countries first
    for a3, name, cat, polys in neutral_countries:
        fill = (18, 24, 38, 255) if a3 == "ATA" else COLOR_MAP["none"]
        for pts in polys:
            draw.polygon(pts, fill=fill, outline=BORDER_NEUTRAL)

    # 2. Render aligned countries with bright alliance colors
    for a3, name, cat, polys in aligned_countries:
        fill = COLOR_MAP.get(cat, COLOR_MAP["none"])
        for pts in polys:
            draw.polygon(pts, fill=fill, outline=BORDER_ALIGNED)

    # HEADER SECTION (Single-line sleek banner)
    header_box = [18 * SCALE, 14 * SCALE, (TARGET_W - 18) * SCALE, 80 * SCALE]
    draw.rounded_rectangle(
        header_box,
        radius=12 * SCALE,
        fill=(15, 23, 42, 235),
        outline=(51, 65, 85, 220),
        width=int(1.5 * SCALE)
    )

    tx = 36 * SCALE
    head_cy = (header_box[1] + header_box[3]) / 2

    # Title: GeopoliticsAI.com (52px bold)
    title_str = "GeopoliticsAI.com"
    draw.text((tx, head_cy - 30 * SCALE), title_str, fill=(255, 255, 255), font=fonts["title"])
    title_w = draw.textlength(title_str, font=fonts["title"])

    # Glowing blue separator dot
    dot_cx = tx + title_w + 20 * SCALE
    dot_cy = head_cy
    draw.ellipse(
        [dot_cx - 8 * SCALE, dot_cy - 8 * SCALE, dot_cx + 8 * SCALE, dot_cy + 8 * SCALE],
        fill=(59, 130, 246, 80)
    )
    draw.ellipse(
        [dot_cx - 5 * SCALE, dot_cy - 5 * SCALE, dot_cx + 5 * SCALE, dot_cy + 5 * SCALE],
        fill=(59, 130, 246, 255)
    )

    # 'Interactive Map' written to the right of the title (30px)
    inter_x = dot_cx + 20 * SCALE
    draw.text((inter_x, head_cy - 18 * SCALE), "Interactive Map", fill=(203, 213, 225), font=fonts["inter"])

    # SPLIT DUAL-LEGEND CARDS
    # Left Card: 3 primary initiatives positioned in open Pacific Ocean (extra large font)
    left_items = [
        (COLOR_MAP["waico_only"], "WAICO", "(37)"),
        (COLOR_MAP["pax_only"], "Pax Silica", "(inc. EU)"),
        (COLOR_MAP["frontier_only"], "Frontier Control", "(20+EU)"),
    ]

    # Right Card: 3 overlap combinations, bottom-right aligned
    right_items = [
        (COLOR_MAP["tripartite"], "All 3", "(Kazakhstan)"),
        (COLOR_MAP["pax_frontier"], "Pax + Frontier", "(13)"),
        (COLOR_MAP["waico_frontier"], "WAICO + Frontier", "(2)"),
    ]

    # 1. Render Left Card (Pacific Ocean - Extra Large Font)
    dot_r_l = 11 * SCALE
    gap_dot_txt_l = 11 * SCALE
    row_h_l = 44 * SCALE
    pad_x_l = 20 * SCALE
    pad_y_l = 18 * SCALE

    left_max_w = max(
        dot_r_l * 2 + gap_dot_txt_l + draw.textlength(lbl, font=fonts["left_item"]) + draw.textlength(f" {cnt}", font=fonts["left_count"])
        for _, lbl, cnt in left_items
    )
    card_w_left = left_max_w + pad_x_l * 2
    card_h_left = len(left_items) * row_h_l + pad_y_l * 2 - 4 * SCALE

    lbox_x1 = 20 * SCALE
    lbox_y2 = (TARGET_H - 18) * SCALE
    lbox_y1 = lbox_y2 - card_h_left
    lbox_x2 = lbox_x1 + card_w_left

    draw.rounded_rectangle(
        [lbox_x1, lbox_y1, lbox_x2, lbox_y2],
        radius=14 * SCALE,
        fill=(15, 23, 42, 240),
        outline=(51, 65, 85, 220),
        width=int(1.5 * SCALE)
    )

    for i, (col, lbl, cnt) in enumerate(left_items):
        cy = lbox_y1 + pad_y_l + i * row_h_l + row_h_l / 2 - 2 * SCALE
        cx_dot = lbox_x1 + pad_x_l + dot_r_l
        draw.ellipse(
            [cx_dot - dot_r_l - 2 * SCALE, cy - dot_r_l - 2 * SCALE, cx_dot + dot_r_l + 2 * SCALE, cy + dot_r_l + 2 * SCALE],
            fill=(col[0], col[1], col[2], 70)
        )
        draw.ellipse([cx_dot - dot_r_l, cy - dot_r_l, cx_dot + dot_r_l, cy + dot_r_l], fill=col)
        txt_x = cx_dot + dot_r_l + gap_dot_txt_l
        lbl_w = draw.textlength(lbl, font=fonts["left_item"])
        draw.text((txt_x, cy - 16 * SCALE), lbl, fill=(248, 250, 252), font=fonts["left_item"])
        draw.text((txt_x + lbl_w, cy - 14 * SCALE), f" {cnt}", fill=(148, 163, 184), font=fonts["left_count"])

    # 2. Render Right Card (Bottom-Right Aligned - Enlarged Font)
    dot_r_r = 9.5 * SCALE
    gap_dot_txt_r = 10 * SCALE
    row_h_r = 38 * SCALE
    pad_x_r = 18 * SCALE
    pad_y_r = 16 * SCALE

    right_max_w = max(
        dot_r_r * 2 + gap_dot_txt_r + draw.textlength(lbl, font=fonts["right_item"]) + draw.textlength(f" {cnt}", font=fonts["right_count"])
        for _, lbl, cnt in right_items
    )
    card_w_right = right_max_w + pad_x_r * 2
    card_h_right = len(right_items) * row_h_r + pad_y_r * 2 - 4 * SCALE

    rbox_x2 = (TARGET_W - 20) * SCALE
    rbox_y2 = (TARGET_H - 18) * SCALE
    rbox_y1 = rbox_y2 - card_h_right
    rbox_x1 = rbox_x2 - card_w_right

    draw.rounded_rectangle(
        [rbox_x1, rbox_y1, rbox_x2, rbox_y2],
        radius=14 * SCALE,
        fill=(15, 23, 42, 240),
        outline=(51, 65, 85, 220),
        width=int(1.5 * SCALE)
    )

    for i, (col, lbl, cnt) in enumerate(right_items):
        cy = rbox_y1 + pad_y_r + i * row_h_r + row_h_r / 2 - 2 * SCALE
        cx_dot = rbox_x1 + pad_x_r + dot_r_r
        draw.ellipse(
            [cx_dot - dot_r_r - 2 * SCALE, cy - dot_r_r - 2 * SCALE, cx_dot + dot_r_r + 2 * SCALE, cy + dot_r_r + 2 * SCALE],
            fill=(col[0], col[1], col[2], 70)
        )
        draw.ellipse([cx_dot - dot_r_r, cy - dot_r_r, cx_dot + dot_r_r, cy + dot_r_r], fill=col)
        txt_x = cx_dot + dot_r_r + gap_dot_txt_r
        lbl_w = draw.textlength(lbl, font=fonts["right_item"])
        draw.text((txt_x, cy - 14 * SCALE), lbl, fill=(248, 250, 252), font=fonts["right_item"])
        draw.text((txt_x + lbl_w, cy - 13 * SCALE), f" {cnt}", fill=(148, 163, 184), font=fonts["right_count"])

    # High-quality downsampling from 2400x1260 to 1200x630
    final_img = img.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)

    # Save RGB PNG
    final_rgb = Image.new("RGB", (TARGET_W, TARGET_H), (11, 15, 25))
    final_rgb.paste(final_img, mask=final_img.split()[3])
    final_rgb.save(OUTPUT_PATH, "PNG", optimize=True)

    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"[generate_thumbnail] Successfully rendered world map thumbnail: {OUTPUT_PATH} ({file_size} bytes)")


if __name__ == "__main__":
    render_thumbnail()
