import { Metadata } from "next";
import RoomCanvas from "../../../components/room/RoomCanvas";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export async function generateMetadata(props: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  let name = decodeURIComponent(params.roomId);
  try {
    const res = await fetch(`${API}/rooms/${encodeURIComponent(params.roomId)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json();
      if (j?.room?.name) name = String(j.room.name);
    }
  } catch {}
  return {
    title: `${name} — Weered Room`,
    description: `Join the ${name} room on Weered. Real-time chat, modules, and presence.`,
    openGraph: {
      title: `${name} — Weered Room`,
      description: `Live room on Weered — join and be present.`,
      url: `https://weered.ca/room/${encodeURIComponent(params.roomId)}`,
    },
    alternates: { canonical: `https://weered.ca/room/${encodeURIComponent(params.roomId)}` },
  };
}

export default async function RoomPage(props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  return <RoomCanvas roomId={params.roomId} />;
}
