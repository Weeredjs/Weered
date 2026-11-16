"use client";
// The faces in the office (James 2026-11-16: "make these a bit bigger ... Make
// sure a square shows for the participant isn't on cam. just do the initials
// thing. Then have something comical. 'Camera Shy'").
//
// The video tiles are added by hand (page.tsx addTile, one div[data-pid] per
// camera) into a container React never renders into. That container is
// display:contents inside this grid, so the camera-shy tiles React draws sit
// in the same grid beside them. A MutationObserver says who has a camera on.
import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

type Person = { id: string; name: string };

const initials = (name: string) =>
  name
    .replace(/\(you\)/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "·";

/** The ids with a camera tile in the container right now. */
function useCameraIds(tilesEl: RefObject<HTMLDivElement | null>): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const el = tilesEl.current;
    if (!el) return;
    const read = () =>
      setIds(
        new Set(
          Array.from(el.querySelectorAll("[data-pid]")).map(
            // A host on a second device joins as "<id>~<device>" (api routes/voice.ts).
            (n) => (n.getAttribute("data-pid") || "").split("~")[0],
          ),
        ),
      );
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { childList: true });
    return () => mo.disconnect();
  }, [tilesEl]);
  return ids;
}

export function Faces({
  tilesEl,
  people,
  selfId,
  show,
}: {
  tilesEl: RefObject<HTMLDivElement | null>;
  people: Person[];
  selfId: string;
  /** Camera-shy tiles only where faces belong (the office, not reception). */
  show: boolean;
}) {
  const on = useCameraIds(tilesEl);
  const shy = show ? people.filter((p) => p.id && !on.has(p.id)) : [];
  return (
    <div style={F.grid}>
      <div ref={tilesEl} style={{ display: "contents" }} />
      {shy.map((p) => {
        const name = p.name.replace(/\(you\)/i, "").trim() || "Guest";
        return (
          <div key={p.id} style={F.tile} aria-label={`${name}, camera off`}>
            <div style={F.disc}>{initials(name)}</div>
            <div style={F.shy}>Camera shy</div>
            <div style={F.tag}>
              {name}
              {p.id === selfId ? " (you)" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const F: Record<string, CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
    gap: 12,
  },
  tile: {
    position: "relative",
    aspectRatio: "4/3",
    borderRadius: 6,
    border: "1px solid #1E3A5F",
    background: "radial-gradient(120% 90% at 50% 35%, #15335A 0%, #0A1D35 70%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    overflow: "hidden",
  },
  disc: {
    width: 76,
    height: 76,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontFamily: "Georgia, 'Iowan Old Style', Cambria, serif",
    fontSize: 30,
    color: "#F3E9D2",
    background: "linear-gradient(180deg, #1B3B62, #102542)",
    border: "1px solid rgba(198,161,91,.55)",
    boxShadow: "0 6px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08)",
  },
  shy: {
    fontFamily: "'Segoe UI', Inter, system-ui, sans-serif",
    fontSize: 12,
    fontStyle: "italic",
    letterSpacing: ".04em",
    color: "rgba(198,161,91,.9)",
  },
  tag: {
    position: "absolute",
    left: 8,
    bottom: 8,
    font: "600 11px 'Segoe UI',sans-serif",
    color: "rgba(236,242,250,.95)",
    background: "rgba(10,29,53,.72)",
    padding: "2px 8px",
    borderRadius: 4,
  },
};
