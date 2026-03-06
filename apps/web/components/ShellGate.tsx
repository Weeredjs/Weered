"use client";

import React from "react";
import { usePathname } from "next/navigation";

const NO_SHELL_ROUTES = ["/login", "/register", "/staff"];

export default function ShellGate({
  left,
  right,
  children,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const bare = NO_SHELL_ROUTES.some(
    r => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r + "?")
  );

  if (bare) return <>{children}</>;

  return (
    <div className="weered-shell">
      <aside className="weered-left">{left}</aside>
      <main className="weered-center">{children}</main>
      <aside className="weered-right">{right}</aside>
    </div>
  );
}
