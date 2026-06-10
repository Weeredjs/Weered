"use client";
import { useEffect } from "react";

export default function SyncAuthedAttribute() {
  useEffect(() => {
    try {
      const has = !!localStorage.getItem("weered_user");
      if (has) document.documentElement.setAttribute("data-weered-authed", "1");
      else document.documentElement.removeAttribute("data-weered-authed");
    } catch {}
  });
  return null;
}
