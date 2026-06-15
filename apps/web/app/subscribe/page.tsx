"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";

const SubscribeContent = dynamic(() => import("./SubscribeContent"), { ssr: false });

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#080810",
            color: "rgba(255,255,255,.4)",
            fontSize: 13,
          }}
        >
          Loading...
        </div>
      }
    >
      <SubscribeContent />
    </Suspense>
  );
}
