// Whether moving decoration should hold still. Three switches:
//   - the viewer's "Turn off all animations" (Settings → Display), painted
//     on <html> as data-weered-reduce-motion="1";
//   - Light effects (lib/displaySettings.ts): chosen on this device, or on by
//     itself where it draws without a graphics card; data-weered-light="1";
//   - their system's reduce-motion setting.
// A lobby can force its own effect on past the first (theme.fxForced in
// lib/lobbyLayout.ts: "visitors can't turn it off"), never past the others:
// people set the system one because motion makes them unwell, and Light
// effects is about what the machine can carry.
import { useEffect, useState } from "react";

const ATTR = "data-weered-reduce-motion";
const LIGHT = "data-weered-light";

export function motionOff(forced = false): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  if (document.documentElement.getAttribute(LIGHT) === "1") return true;
  if (forced) return false;
  return document.documentElement.getAttribute(ATTR) === "1";
}

/** motionOff(), kept current when the viewer flips either switch. */
export function useMotionOff(forced = false): boolean {
  const [off, setOff] = useState(false);
  useEffect(() => {
    const read = () => setOff(motionOff(forced));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR, LIGHT] });
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener?.("change", read);
    return () => {
      mo.disconnect();
      mq?.removeEventListener?.("change", read);
    };
  }, [forced]);
  return off;
}
