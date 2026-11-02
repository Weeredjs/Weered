"""Weered app icons (2026-11-01): the brand W + crown (purple, as everywhere on
the site), centred inside Android's safe zone so the launcher's mask never
crops it, on a deep violet glow. Writes the web app's maskable and Apple icons
and the phone app's icon and adaptive foreground."""
from PIL import Image, ImageFilter

WEB = "E:/Weered-harden/apps/web/public/brand/logo"
MOB = "E:/Weered-harden/apps/mobile/assets"
SRC = Image.open(f"{WEB}/weered-logo-512.png").convert("RGBA")
LOGO = SRC.crop(SRC.getbbox())

CENTRE = (24, 11, 48)  # a hint of violet behind the W
EDGE = (7, 6, 12)  # near-black at the rim
GLOW = (139, 92, 246)  # the site accent, as the logo glows on the site


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
    # A soft glow in the accent colour lifts the purple W off the dark.
    halo = Image.new("RGBA", canvas.size, GLOW + (0,))
    a = Image.new("L", canvas.size, 0)
    a.paste(logo.split()[3], at)
    a = a.filter(ImageFilter.GaussianBlur(n * 0.045)).point(lambda v: int(v * 0.75))
    halo.putalpha(a)
    canvas.alpha_composite(halo)
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
