"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type SheetType = "dock" | "profile" | "settings" | "roomDetails";

export type Sheet = {
  type: SheetType;
  payload?: any;
};

type OverlayApi = {
  stack: Sheet[];
  openSheet: (type: SheetType, payload?: any) => void;
  closeSheet: () => void;
  clearSheets: () => void;
  replaceTop: (type: SheetType, payload?: any) => void;
};

const OverlayContext = createContext<OverlayApi | null>(null);

export function useOverlay(): OverlayApi {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used within OverlayProvider");
  return ctx;
}

export default function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Sheet[]>([]);

  const openSheet = useCallback((type: SheetType, payload?: any) => {
    setStack((cur) => [...cur, { type, payload }]);
  }, []);

  const closeSheet = useCallback(() => {
    setStack((cur) => (cur.length ? cur.slice(0, -1) : cur));
  }, []);

  const clearSheets = useCallback(() => setStack([]), []);

  const replaceTop = useCallback((type: SheetType, payload?: any) => {
    setStack((cur) => {
      if (!cur.length) return [{ type, payload }];
      const next = cur.slice(0, -1);
      next.push({ type, payload });
      return next;
    });
  }, []);

  const api = useMemo(
    () => ({ stack, openSheet, closeSheet, clearSheets, replaceTop }),
    [stack, openSheet, closeSheet, clearSheets, replaceTop],
  );

  return <OverlayContext.Provider value={api}>{children}</OverlayContext.Provider>;
}
