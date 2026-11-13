"use client";

// Your Paper (Weered's play money): the balance on your ID card (James
// 2026-11-07: "Remove paper. Have that as a button off the profile"). The
// store it opened is gone (2026-11-10), so the button claims the daily 25
// instead, and glows while it's waiting. Fetched once and every thirty seconds
// after (lib/floodMode's poll slows it under load); null until it answers or
// when signed out.
import { useCallback, useEffect, useState } from "react";
import { poll } from "./floodMode";
import { hasAccount } from "./hasAccount";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export type DailyResult = { ok: true; awarded: number } | { ok: false; nextAt?: string };

export function usePaperBalance(): {
  balance: number | null;
  dailyReady: boolean;
  claimDaily: () => Promise<DailyResult>;
} {
  const [balance, setBalance] = useState<number | null>(null);
  const [dailyReady, setDailyReady] = useState(false);
  const auth = (): HeadersInit => {
    const tok = localStorage.getItem("weered_token");
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  };
  useEffect(() => {
    // Only for an account: a signed-out visitor's page asked every thirty
    // seconds and was refused every time (2026-11-12), and a guest has no Paper.
    const load = () => {
      if (!hasAccount()) return;
      fetch(`${API}/paper/wallet`, { headers: auth() })
        .then((r) => r.json())
        .then((j) => {
          if (typeof j?.balance === "number") setBalance(j.balance);
          setDailyReady(j?.dailyReady === true);
        })
        .catch(() => {});
    };
    load();
    return poll(load, 30000);
  }, []);
  const claimDaily = useCallback(async (): Promise<DailyResult> => {
    try {
      const j = await fetch(`${API}/paper/daily`, { method: "POST", headers: auth() }).then((r) =>
        r.json(),
      );
      setDailyReady(false);
      if (j?.ok) {
        if (typeof j.balance === "number") setBalance(j.balance);
        return { ok: true, awarded: Number(j.awarded) || 25 };
      }
      return { ok: false, nextAt: typeof j?.nextAt === "string" ? j.nextAt : undefined };
    } catch {
      return { ok: false };
    }
  }, []);
  return { balance, dailyReady, claimDaily };
}
