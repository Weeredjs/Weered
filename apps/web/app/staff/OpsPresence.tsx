"use client";
import { useWeered, useRoomUsers } from "../../components/WeeredProvider";

/** Who else has the ops area open (the @ops room's presence). */
export function OpsPresence() {
  const ctx = useWeered();
  const users: any[] = useRoomUsers(ctx?.activeRoomId);
  return (
    <div>
      <div className="wops-here-label">In ops now</div>
      <div className="wops-here">
        {users.length === 0 && <span className="wops-muted">No one else here.</span>}
        {users.map((u: any, i: number) => {
          const name = String(u?.name ?? "?");
          return (
            <span key={u?.id ?? i} className="wops-here-who" title={String(u?.globalRole ?? "")}>
              <i>{name.slice(0, 1).toUpperCase()}</i>
              <span>{name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
