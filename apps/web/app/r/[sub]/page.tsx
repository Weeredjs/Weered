"use client";
import React, { use } from "react";
import { useRouter } from "next/navigation";

export default function SubredditRoute(props: { params: Promise<{ sub: string }> }) {
  const params = use(props.params) as { sub: string };
  const router = useRouter();
  React.useEffect(() => {
    const raw = String(params?.sub || "").trim();
    const sub = raw.replace(/^r\//i, "").replace(/^\/+/, "");
    router.replace(`/lobby?sub=${encodeURIComponent("r/" + sub)}`);
  }, [router, params?.sub]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--weered-bg,#050816)", color: "rgba(243,244,246,.92)", fontWeight: 900 }}>
      Opening lobby…
    </div>
  );
}
