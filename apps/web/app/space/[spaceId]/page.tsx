"use client";
import { useEffect, useState, use } from "react";

type Room = { id: string; name: string; roomType: string; privacyMode: string };

export default function SpaceRooms(props: any) {
  const params = use(props.params) as { spaceId: string };
  const { spaceId } = params;
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_BASE!;
    const token = localStorage.getItem("token");
    fetch(`${api}/spaces/${spaceId}/rooms`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setRooms);
  }, [spaceId]);

  return (
    <main style={{ padding: 24 }}>
      <h2>Rooms</h2>
      <ul>
        {rooms.map(r => (
          <li key={r.id}>
            <a href={`/room/${r.id}`}>{r.name}</a>{" "}
            <span style={{ opacity: 0.6 }}>({r.roomType}, {r.privacyMode})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
