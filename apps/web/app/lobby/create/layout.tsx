import React from "react";
import type { Metadata } from "next";
import RequireAuth from "../../../components/RequireAuth";

// The builder's own title: it read "Lobbies", its parent's.
export const metadata: Metadata = {
  title: "Build your lobby",
  description: "Say what you want and Weered builds it: the rooms, the look, the welcome page.",
  alternates: { canonical: "https://weered.ca/lobby/create" },
};

export default function CreateLobbyLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
