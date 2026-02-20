"use client";
import { useEffect, useState } from "react";

type Space = { id: string; name: string; type: string; role: string };

export default function Lobby() {
  const [spaces, setSpaces] = useState<Space[]>([]);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_BASE!;
    const token = localStorage.getItem("token");
    fetch(`${api}/spaces`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setSpaces);
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h2>Your Spaces</h2>
      <ul>
        {spaces.map(s => (
          <li key={s.id}>
            <a href={`/space/${s.id}`}>{s.name}</a>{" "}
            <span style={{ opacity: 0.6 }}>({s.type}, {s.role})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
