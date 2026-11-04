"use client";

import { useEffect, useState } from "react";

/** True at once; false only after `value` has stayed false for `holdMs`. A
 *  deploy's restart (about 8 s, James 2026-11-03) doesn't flash the
 *  connection dot. */
export function useSteady(value: boolean, holdMs: number): boolean {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (value) {
      setShown(true);
      return;
    }
    const t = setTimeout(() => setShown(false), holdMs);
    return () => clearTimeout(t);
  }, [value, holdMs]);
  return shown;
}
