"""Builds the site icons in static/ from assets/logo.png.
Run from the project root: python3 scripts/make-icons.py  (needs Pillow)"""
from PIL import Image

logo = Image.open("assets/logo.png").convert("RGBA")
logo = logo.crop(logo.getbbox())  # trim empty edges


def square(size, pad, background):
    """Fit the logo, centered, into a size x size square with `pad` fraction of margin."""
    canvas = Image.new("RGBA", (size, size), background)
    room = round(size * (1 - 2 * pad))
    art = logo.copy()
    art.thumbnail((room, room), Image.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


# iOS home screen: solid white (iOS turns transparency black) and rounds the corners itself.
square(180, 0.05, (255, 255, 255, 255)).convert("RGB").save("static/apple-touch-icon.png")
# Browser tabs and bookmarks: transparent, minimal margin so it's as big as possible.
square(32, 0.0, (0, 0, 0, 0)).save("static/favicon-32.png")
square(64, 0.0, (0, 0, 0, 0)).save("static/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("Wrote static/apple-touch-icon.png, static/favicon-32.png, static/favicon.ico")
