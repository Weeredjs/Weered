import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Weered",
  description:
    "Log in or create your Weered account. Join lobbies, create rooms, and connect with communities in real time.",
  openGraph: {
    title: "Sign In — Weered",
    description: "Log in or create your Weered account.",
    url: "https://weered.ca/login",
  },
  alternates: { canonical: "https://weered.ca/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
