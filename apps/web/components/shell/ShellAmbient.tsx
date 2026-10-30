"use client";

// The viewer's own moving effect (snow, a blizzard, embers, their own symbol
// floating by...), drawn behind the whole app over Nebula's sky. The same
// canvas lobbies use (components/LobbyAmbient.tsx). Nebula only; lobbies
// with their own theme keep theirs; off when Reduce motion is on.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LobbyAmbient from "../LobbyAmbient";
import { useShellLook } from "../../lib/shellDesign";
import { paletteColours } from "../../lib/uiPrefs";

/** Re-render when these <html> attributes change. */
function useHtmlAttrs(names: string[]): Record<string, string | null> {
  const read = () =>
    Object.fromEntries(names.map((n) => [n, document.documentElement.getAttribute(n)]));
  const [v, setV] = useState<Record<string, string | null>>({});
  useEffect(() => {
    setV(read());
    const obs = new MutationObserver(() => setV(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: names });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

export default function ShellAmbient() {
  const look = useShellLook();
  const html = useHtmlAttrs([
    "data-weered-theme",
    "data-weered-lobby",
    "data-weered-reduce-motion",
  ]);
  if (!look || !look.fx || look.fx === "none") return null;
  if (html["data-weered-theme"] !== "nebula" || html["data-weered-lobby"]) return null;
  if (html["data-weered-reduce-motion"] === "1") return null;
  const c = paletteColours(look.palette, look.accent);
  return createPortal(
    <LobbyAmbient
      effect={look.fx}
      accent={c.a}
      intensity={look.fxIntensity}
      symbol={look.fxSymbol}
      light={!!c.light}
      // In front: over the page (below sheets and Design mode), never in the
      // way of a click; behind: under the glass, over the sky.
      style={
        look.fxFront
          ? { position: "fixed", zIndex: 9000, opacity: 0.9 }
          : { position: "fixed", zIndex: -1 }
      }
    />,
    document.body,
  );
}
