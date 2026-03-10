"use client";

import React from "react";
import { usePathname } from "next/navigation";
import SiteFooter from "./SiteFooter";

const NO_SHELL_ROUTES = ["/login", "/register", "/staff", "/about", "/premium", "/contact"];

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

  if (bare) return (
    <>
      {children}
      <SiteFooter />
    </>
  );

  const NO_FOOTER_ROUTES = ["/room/"];
  const hideFooter = NO_FOOTER_ROUTES.some(r => pathname.startsWith(r));

  return (
    <>
      <div className="weered-shell">
        <aside className="weered-left">{left}</aside>
        <main className="weered-center">{children}</main>
        <aside className="weered-right">{right}</aside>
      </div>
      {!hideFooter && <SiteFooter />}
    </>
  );
}
