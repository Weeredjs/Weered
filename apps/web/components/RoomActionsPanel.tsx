'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { weeredWs, type WsMsg } from '../app/weeredClient';

type Member = { id: string; name: string; role: string };
type BanRecord = { userId: string; reason?: string; displayName?: string };

type Props = {
  roomId: string;
  members: Member[];
  bans: BanRecord[];
  onBan: (userId: string) => void;
  onKick: (userId: string) => void;
  onRefresh: () => void;
};

export default function RoomActionsPanel(props: Props) {
  const { roomId, members, bans, onBan, onKick, onRefresh } = props;

  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  
  const handleBan = (userId: string) => {
    const reason = reasonDraft[userId]?.trim() || prompt('Enter reason for ban:') || '';
    if (reason) onBan(userId);
  };

  const handleKick = (userId: string) => {
    onKick(userId);
  };

  return (
    <div style={{ marginTop: 20, padding: 12, borderRadius: 12, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Room Members</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {members.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: 10, padding: 10, borderBottom: '1px solid #ddd' }}>
            <div style={{ flex: 1 }}>{m.name} ({m.role})</div>
            <div>
              {m.role !== 'owner' && m.role !== 'admin' && (
                <button onClick={() => handleKick(m.id)} style={{ marginRight: 10 }}>Kick</button>
              )}
              <button onClick={() => handleBan(m.id)}>Ban</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Ban List</div>
        {bans.length === 0 ? (
          <div>No bans.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bans.map((b) => (
              <div key={b.userId} style={{ display: 'flex', gap: 10, padding: 10, borderBottom: '1px solid #ddd' }}>
                <div style={{ flex: 1 }}>{b.displayName || b.userId}</div>
                <div>{b.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onRefresh} style={{ marginTop: 12 }}>Refresh</button>
    </div>
  );
}