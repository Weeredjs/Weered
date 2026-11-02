"use client";
import { useEffect } from "react";
import { isChunkError, reloadForNewBuild } from "../lib/chunkReload";

/** Code that failed to load after a deploy: reload once onto the new build
 *  (lib/chunkReload.ts). Errors React catches go through app/error.tsx and
 *  app/global-error.tsx; this catches the rest. */
export default function ChunkRecovery() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.error ?? e.message)) reloadForNewBuild();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) reloadForNewBuild();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
