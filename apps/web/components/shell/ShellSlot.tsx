"use client";

// The box every movable piece of the viewer's own Weered sits in: a built-in
// section or a block. Design mode finds these by data-shell-key to outline,
// select and drag them; outside Design mode they are plain wrappers.
import React from "react";
import { isCore, itemName, keyOf, type ShellItem, type ShellRegion } from "../../lib/shellLayout";
import ShellBlockView from "./ShellBlockView";

export default function ShellSlot({
  item,
  region,
  order,
  children,
}: {
  item: ShellItem;
  region: ShellRegion;
  /** Flex order, where the slot shares a container with sections ordered by CSS. */
  order?: number;
  children?: React.ReactNode;
}) {
  const style: React.CSSProperties = {};
  if (order !== undefined) style.order = order;
  // Home is a 12-column grid: sections take the row, blocks their width.
  if (region === "home")
    style.gridColumn = isCore(item) ? "1 / -1" : `span ${SPAN[item.size] || 12}`;
  return (
    <div
      className={`weered-shell-slot weered-shell-slot-${region}${isCore(item) ? "" : " is-block"}`}
      data-shell-key={keyOf(item)}
      data-shell-region={region}
      data-shell-label={itemName(item)}
      style={style}
    >
      {children ?? (isCore(item) ? null : <ShellBlockView block={item} region={region} />)}
    </div>
  );
}

const SPAN = { s: 4, m: 6, l: 8, full: 12 } as const;
