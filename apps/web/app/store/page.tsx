import { redirect } from "next/navigation";

// The store is gone (James 2026-11-10: "remove store"): its shelves were bare.
// The daily Paper bonus it held is the balance button on your card now
// (components/UserCorner.tsx). An old link lands on Home.
export default function StorePage() {
  redirect("/home");
}
