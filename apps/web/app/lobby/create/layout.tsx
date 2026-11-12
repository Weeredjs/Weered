"use client";

import React from "react";
import RequireAuth from "../../../components/RequireAuth";

export default function CreateLobbyLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
