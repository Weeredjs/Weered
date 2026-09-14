"use client";

import React, { useState } from "react";
import { barMapThumb } from "./useBarMaps";

/**
 * A map's minimap from BAR's API. Not every map in the catalogue has one (some
 * return 404), so a failed load swaps to a quiet placeholder instead of the
 * browser's broken-image icon.
 */
export default function MapThumb({
  fileName,
  style,
}: {
  fileName?: string | null;
  style: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (!fileName || failed) {
    return <div aria-hidden style={{ ...style, background: "rgba(255,255,255,.05)" }} />;
  }
  return (
    <img
      src={barMapThumb(fileName)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      style={style}
    />
  );
}
