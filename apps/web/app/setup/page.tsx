"use client";

// /setup: run first-run setup again (linked from Settings → Theme).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SetupFlow from "../../components/setup/SetupFlow";

export default function SetupPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let authed = false;
    try {
      authed = !!JSON.parse(localStorage.getItem("weered_user") || "null")?.id;
    } catch {}
    if (authed) setOk(true);
    else router.replace("/login?next=%2Fsetup");
  }, [router]);
  if (!ok) return null;
  return <SetupFlow mode="again" onClose={(next) => router.replace(next || "/home")} />;
}
