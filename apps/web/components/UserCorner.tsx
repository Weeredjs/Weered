"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useWeered } from "./WeeredProvider";

function pickFirstString(...vals: any[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}

function normRole(x: string) {
  const s = String(x || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "GOD")     return "GOD";
  if (s === "SUPPORT") return "SUPPORT";
  if (s === "STAFF")   return "STAFF";
  if (s === "ADMIN")   return "ADMIN";
  if (s === "MOD")     return "MOD";
  if (s === "OWNER")   return "OWNER";
  if (s === "MEMBER")  return "MEMBER";
  return s.slice(0, 14);
}

export default function UserCorner() {
  const { me, role, globalRole } = useWeered();

  const name       = useMemo(() => pickFirstString(me?.name, me?.username, "Guest"), [me]);
  const gRole      = useMemo(() => normRole(globalRole || ""), [globalRole]);
  const roomRole   = useMemo(() => normRole(pickFirstString(role)), [role]);
  const initial    = (name || "G").trim().slice(0, 1).toUpperCase();

  return (
    <Link href="/room/@me" className="weered-usercorner" title="Home (your personal space)">
      <div className="weered-avatar" aria-hidden="true">{initial}</div>
      <div className="weered-usercorner-meta">
        <div className="weered-usercorner-name">{name}</div>
        <div className="weered-usercorner-tags">
          {gRole    ? <span className="weered-chip weered-chip-purple">{gRole}</span>    : null}
          {roomRole ? <span className="weered-chip">{roomRole}</span> : null}
        </div>
      </div>
    </Link>
  );
}
