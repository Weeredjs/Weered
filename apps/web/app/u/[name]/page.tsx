import { redirect } from "next/navigation";

// weered.ca/u/<label>: someone's place (api routes/places.ts), a lobby whose id
// is "u-" + its label.
export default async function PlacePath({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const label = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  redirect(label ? `/lobby/u-${label}` : "/home");
}
