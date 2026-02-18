"use client";

import React from "react";
import { weeredClient, WEERED_API_BASE } from "../app/weeredClient";

export default function DockBanOverlay() {
  const [authErr, setAuthErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [tokenPreview, setTokenPreview] = React.useState(weeredClient.getTokenPreview());
  const [showLog, setShowLog] = React.useState(false);
  const [log, setLog] = React.useState<string[]>([]);

  React.useEffect(() => {
    const offFail = weeredClient.on("auth:fail", (m: any) => setAuthErr(String(m?.error ?? "auth_failed")));
    const offOk = weeredClient.on("auth:ok", () => setAuthErr(null));

    const t = setInterval(() => {
      setTokenPreview(weeredClient.getTokenPreview());
      if (showLog) setLog(weeredClient.getDebugLog().slice(-40));
    }, 500);

    return () => { offFail(); offOk(); clearInterval(t); };
  }, [showLog]);

  async function doDevLogin() {
    try {
      setBusy(true);
      await weeredClient.devLogin(); // POST /auth/dev-login
      weeredClient.retryAuth();
    } finally {
      setBusy(false);
    }
  }

  function retry() { weeredClient.retryAuth(); }
  function clearToken() { weeredClient.clearToken(); setTokenPreview(weeredClient.getTokenPreview()); }

  if (!authErr) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[min(720px,92vw)] rounded-xl bg-white p-4 shadow-xl">
        <div className="text-lg font-semibold">Not authenticated</div>
        <div className="mt-2 text-sm text-gray-700">
          Server says: <span className="font-mono">{authErr}</span>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          API base: <span className="font-mono">{WEERED_API_BASE}</span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          Token: <span className="font-mono">{tokenPreview}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={doDevLogin} disabled={busy}>
            {busy ? "Dev Login..." : "Dev Login"}
          </button>
          <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" onClick={retry}>
            Retry Auth
          </button>
          <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" onClick={clearToken}>
            Clear Token
          </button>
          <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setShowLog(v => !v); setLog(weeredClient.getDebugLog().slice(-40)); }}>
            {showLog ? "Hide Log" : "Show Log"}
          </button>
        </div>

        {showLog ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">{log.join("\n")}</pre>
        ) : null}
      </div>
    </div>
  );
}