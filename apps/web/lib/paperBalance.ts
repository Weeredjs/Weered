"use client";

// Your Paper (Weered's play money): the balance on your ID card, which opens
// the store (James 2026-11-07: "Remove paper. Have that as a button off the
// profile"). Fetched once and every thirty seconds after (lib/floodMode's poll
// slows it under load); null until it answers or when signed out.
import { useEffect, useState } from "react";
import { poll } from "./floodMode";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export function usePaperBalance(): number | null {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    const load = () => {
      const tok = localStorage.getItem("weered_token");
      fetch(`${API}/paper/wallet`, tok ? { headers: { Authorization: `Bearer ${tok}` } } : {})
        .then((r) => r.json())
        .then((j) => {
          if (typeof j?.balance === "number") setBalance(j.balance);
        })
        .catch(() => {});
    };
    load();
    return poll(load, 30000);
  }, []);
  return balance;
}
