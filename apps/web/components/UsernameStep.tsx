"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWeered } from "./WeeredProvider";
import { usernameStepFor } from "../lib/usernameStep";

/** Back to the username step for an account that skipped it after a Google or
 *  Discord sign-up (lib/usernameStep.ts). */
export default function UsernameStep() {
  const { me, wsReady } = useWeered() as any;
  const pathname = usePathname();
  const router = useRouter();
  // The server's answer on connect, never the copy saved on this device: a
  // name picked on another device mustn't send this one back to the step.
  const needs = !!wsReady && !!me?.needsUsername;
  useEffect(() => {
    if (!needs) return;
    const to = usernameStepFor({ needsUsername: needs }, pathname, window.location.search);
    if (to) router.replace(to);
  }, [needs, pathname, router]);
  return null;
}
