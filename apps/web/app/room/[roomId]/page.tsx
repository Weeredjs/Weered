import RoomCanvas from "../../../components/room/RoomCanvas";

// NOTE: Server Component. Keep it stable.
export default async function RoomPage({ params }: { params: { roomId: string } }) {
  return <RoomCanvas roomId={params.roomId} />;
}