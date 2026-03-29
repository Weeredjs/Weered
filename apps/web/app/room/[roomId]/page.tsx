import { Metadata } from "next";
import RoomCanvas from "../../../components/room/RoomCanvas";

export async function generateMetadata({ params }: { params: { roomId: string } }): Promise<Metadata> {
  const name = decodeURIComponent(params.roomId);
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

// NOTE: Server Component. Keep it stable.
export default async function RoomPage({ params }: { params: { roomId: string } }) {
  return <RoomCanvas roomId={params.roomId} />;
}