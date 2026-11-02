import { isSitePath } from "./shellLayout";

// A Google or Discord sign-up that closed the window on the username step kept
// its stand-in name ("d_20972329") for good: nothing asked again, and the
// step's page sent them to sign-in (James 2026-11-02). The server marks such an
// account needsUsername on connect (api lib/standInName.ts); until a username
// is picked, these pages stay open and every other one goes back to the step.
const OPEN = [
  "/onboarding",
  "/login",
  "/logout",
  "/verify-email",
  "/reset-password",
  "/terms",
  "/privacy",
  "/guidelines",
  "/contact",
  "/about",
  "/pricing",
];

/** Where to send this person now, or null to leave them be. */
export function usernameStepFor(
  me: { needsUsername?: unknown } | null | undefined,
  pathname: string | null | undefined,
  search = "",
): string | null {
  if (!me?.needsUsername || !pathname) return null;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const back = `${pathname}${search}`;
  return back !== "/" && back !== "/home" && isSitePath(back)
    ? `/onboarding?next=${encodeURIComponent(back)}`
    : "/onboarding";
}

/** Where the step sends them once they've picked: back where they were. */
export function afterUsernameStep(next: string | null | undefined): string {
  const n = String(next || "");
  return n && isSitePath(n) ? n : "/home";
}
