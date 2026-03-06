"use client";

import React from "react";
import { usePathname } from "next/navigation";

const NO_SHELL_ROUTES = ["/login", "/register", "/staff"];

export default function ShellGate({
  shell,
  children,
}: {
  shell: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const bare = NO_SHELL_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r + "?"));

  if (bare) return <>{children}</>;

  return (
    <div className="weered-shell">
      {shell}
      <main className="weered-center">{children}</main>
    </div>
  );
}
