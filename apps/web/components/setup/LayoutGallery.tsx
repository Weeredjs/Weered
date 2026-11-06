"use client";

// The first screen of a new account: pick a layout from pictures of them
// (James 2026-11-05: "the next screen is a full screen overlay. Pick a layout.
// Actually screen shots of piles of configurations. (Have a note that you can
// change it later)... The template selection takes them to home"). Six
// layouts (the presets with nothing to fill in, lib/shellLayout.ts) in three
// colourways each (lib/layoutGallery.ts); a tile saves both. The pictures are
// the real Home, shot by apps/api/scripts/layout-shots.ts into
// public/brand/layouts/. Replaced StartPrompt (2026-11-01).
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { presetLayout } from "../../lib/shellLayout";
import { saveUiPrefs } from "../../lib/uiPrefs";
import { GALLERY_LAYOUTS as LAYOUTS, GALLERY_LOOKS, shotSrc } from "../../lib/layoutGallery";

export default function LayoutGallery({ name, onDone }: { name?: string; onDone: () => void }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [picked, setPicked] = useState<string | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const box = useRef<HTMLDivElement>(null);

  // Someone who signed up for a lobby stays in it; everyone else lands on Home.
  const land = () => {
    if (!/^\/(lobby\/[^/]+|room\/)/.test(pathname) && pathname !== "/home") router.push("/home");
  };

  const pick = (layout: string, lookId: string) => {
    if (picked) return;
    setPicked(`${layout}-${lookId}`);
    const look = GALLERY_LOOKS.find((l) => l.id === lookId) || GALLERY_LOOKS[0];
    const shell = presetLayout(layout);
    saveUiPrefs({
      ...(shell ? { shell } : {}),
      theme: "nebula",
      palette: look.palette,
      ...(look.accent ? { accent: look.accent } : {}),
      setup: "done",
      setupAt: new Date().toISOString(),
    });
    // A beat on the tick, then in.
    setTimeout(() => {
      land();
      onDone();
    }, 420);
  };

  // Skipping keeps the standard Weered, and never asks again.
  const skip = () => {
    if (picked) return;
    saveUiPrefs({ setup: "skipped", setupAt: new Date().toISOString() });
    land();
    onDone();
  };

  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    window.addEventListener("keydown", onKey);
    // The page behind doesn't scroll under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={box}
      tabIndex={-1}
      role="dialog"
      aria-modal
      aria-labelledby="gallery-title"
      className="weered-gallery"
    >
      <div className="weered-gallery-inner">
        <header className="weered-gallery-head">
          <div>
            <div className="weered-gallery-eyebrow">Welcome to Weered{name ? `, ${name}` : ""}</div>
            <h1 id="gallery-title" className="weered-gallery-title">
              Pick a layout
            </h1>
            <p className="weered-gallery-note">
              You can change any of this later. <b>Change</b>, on Home, opens Design.
            </p>
          </div>
          <button type="button" className="weered-gallery-skip" onClick={skip}>
            Skip
          </button>
        </header>

        <div className="weered-gallery-groups">
          {LAYOUTS.map((p) => (
            <section key={p.id} className="weered-gallery-group" aria-label={p.name}>
              <div className="weered-gallery-group-head">
                <span className="weered-gallery-group-name">{p.name}</span>
                <span className="weered-gallery-group-blurb">{p.blurb}</span>
              </div>
              <div className="weered-gallery-tiles">
                {GALLERY_LOOKS.map((l) => {
                  const key = `${p.id}-${l.id}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`weered-gallery-tile${picked === key ? " is-picked" : ""}`}
                      style={{ ["--tile-a" as any]: l.swatch }}
                      disabled={!!picked && picked !== key}
                      onClick={() => pick(p.id, l.id)}
                      aria-label={`${p.name} in ${l.name}`}
                    >
                      <span className="weered-gallery-shot">
                        {broken[key] ? (
                          <span className="weered-gallery-shot-blank">{p.name}</span>
                        ) : (
                          <img
                            src={shotSrc(p.id, l.id)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            onError={() => setBroken((b) => ({ ...b, [key]: true }))}
                          />
                        )}
                        {picked === key && (
                          <span className="weered-gallery-tick" aria-hidden>
                            ✓
                          </span>
                        )}
                      </span>
                      <span className="weered-gallery-look">
                        <span className="weered-gallery-swatch" aria-hidden />
                        {l.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
