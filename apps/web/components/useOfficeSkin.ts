"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// The office gate: true inside ECEB meeting rooms (/room/mtg-*) or when the app
// is served from the office/meet host. Everything Fathom-skinned checks this and
// ONLY this; off the gate the platform behaves exactly as stock Weered.
const OFFICE_HOST_RE = /^(office|meet)\.eastcoastemployeebenefits\.com$/;

export function useOfficeSkin(): boolean {
  const pathname = usePathname() || "";
  // Hostname is only knowable in the browser; resolve it after mount so the
  // server render (and first client render) stay deterministic (false).
  const [officeHost, setOfficeHost] = useState(false);
  useEffect(() => {
    try {
      setOfficeHost(OFFICE_HOST_RE.test(window.location.hostname));
    } catch {
      setOfficeHost(false);
    }
  }, []);
  return pathname.startsWith("/room/mtg-") || officeHost;
}

export default useOfficeSkin;
