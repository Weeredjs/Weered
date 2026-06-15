"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirect() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const roomId = sp?.get("room") || "";
    const article = sp?.get("article") || "";
    if (roomId) {
      router.replace(
        `/room/${encodeURIComponent(roomId)}${article ? `?article=${encodeURIComponent(article)}` : ""}`,
      );
    } else {
      router.replace("/lobby");
    }
  }, []);

  return <div style={{ minHeight: "100vh", background: "#080810" }} />;
}

export default function ArticleRoomPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080810" }} />}>
      <Redirect />
    </Suspense>
  );
}
