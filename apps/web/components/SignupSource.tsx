"use client";

// Keeps a visitor's ?ref= and reports it once they have an account
// (lib/signupSource.ts). Renders nothing.
import { useEffect } from "react";
import { useWeered } from "./WeeredProvider";
import { captureRef, reportRef } from "../lib/signupSource";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export default function SignupSource() {
  const { me } = useWeered() as any;
  useEffect(() => {
    captureRef(location.search, Date.now(), {
      referrer: document.referrer,
      host: location.hostname,
      path: location.pathname,
    });
  }, []);
  const id = String(me?.id || "");
  useEffect(() => {
    if (id) void reportRef(API, id);
  }, [id]);
  return null;
}
