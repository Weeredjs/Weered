"""Weered app icons (2026-11-01): the brand W + crown (purple, as everywhere on
the site), centred inside Android's safe zone so the launcher's mask never
crops it, crisp on a dark violet ground. Writes the web app's maskable and
Apple icons and the phone app's icon and adaptive foreground.

2026-11-02: no glow. A soft accent halo round the W read as a blur on the
phone (James: "the app icon updated to this blurr?"); the ground is a shade
lighter instead, so the purple W stands off it with clean edges."""
from PIL import Image

WEB = "E:/Weered-harden/apps/web/public/brand/logo"
MOB = "E:/Weered-harden/apps/mobile/assets"
SRC = Image.open(f"{WEB}/weered-logo-512.png").convert("RGBA")
LOGO = SRC.crop(SRC.getbbox())

CENTRE = (38, 24, 74)  # violet behind the W, light enough to set it off
EDGE = (14, 10, 28)  # deep violet at the rim


def backdrop(n):
    # Image.radial_gradient: 0 at the centre to 255 at the rim (256 x 256).
    mask = Image.radial_gradient("L").resize((n, n), Image.LANCZOS)
    inner = Image.new("RGBA", (n, n), CENTRE + (255,))
    outer = Image.new("RGBA", (n, n), EDGE + (255,))
    return Image.composite(outer, inner, mask)


def place(canvas, frac):
    n = canvas.size[0]
    w, h = LOGO.size
    s = frac * n / max(w, h)
    logo = LOGO.resize((round(w * s), round(h * s)), Image.LANCZOS)
    at = ((n - logo.size[0]) // 2, (n - logo.size[1]) // 2)
    canvas.alpha_composite(logo, at)
    return canvas


def icon(n, frac):
    return place(backdrop(n), frac)


# Web app (manifest "maskable"): Android masks to a circle or squircle; the
# safe zone is the centre circle of 80%. 60% keeps every point of the W inside.
for n in (192, 512):
    icon(n, 0.60).save(f"{WEB}/weered-icon-maskable-{n}.png", optimize=True)
# iPhone home screen: no transparency, rounded corners only.
icon(180, 0.64).convert("RGB").save(f"{WEB}/weered-apple-touch-180.png", optimize=True)

# Phone app: the plain icon (iOS, older Android) and the adaptive foreground,
# which Android lays over app.json's adaptiveIcon.backgroundColor and masks to
# its 66/108 safe circle; the launcher shows only the middle 72/108, so 42%
# here is about 63% of what's seen, the same as the web icon.
icon(1024, 0.62).convert("RGB").save(f"{MOB}/icon.png", optimize=True)
fg = place(Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)), 0.42)
fg.save(f"{MOB}/adaptive-icon.png", optimize=True)
print("ok")
