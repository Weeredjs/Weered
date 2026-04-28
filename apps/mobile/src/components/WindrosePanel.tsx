import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Image,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { LfgPanel } from "@/components/LfgPanel";

type Tab = "live" | "bounties" | "ports" | "mods" | "streams" | "news" | "lfg";

type Stream = { userLogin: string; userName: string; title: string; viewerCount: number; thumbnailUrl: string };
type StreamsResp = { ok: boolean; streams?: Stream[] };

type LiveResp = { ok: boolean; players?: number; checkedAt?: string };
type News = { id: string; title: string; url: string; date: string | null; feedlabel: string; contents: string };
type NewsResp = { ok: boolean; news?: News[] };

type Bounty = {
  id: string;
  posterId: string;
  posterName: string;
  targetHandle: string;
  targetServer?: string | null;
  amount: number;
  reason: string;
  status: "OPEN" | "CLAIMED" | "SETTLED" | "CANCELLED";
  claimantId?: string | null;
  claimantName?: string | null;
  proofNote?: string | null;
  proofImageUrl?: string | null;
  createdAt: string;
};
type BountyFilter = "OPEN" | "MINE";
type BountiesResp = { ok: boolean; bounties?: Bounty[] };
type WalletResp = { balance?: number };

type RegisteredServer = {
  id: string;
  name: string;
  host: string;
  region: string | null;
  description: string | null;
  framework: string | null;
  tags: string[];
  maxSlots: number;
  status: string;
  owner: { id: string; name: string };
};
type PublicServer = {
  addr: string;
  name: string;
  players: number;
  maxPlayers: number;
  passworded?: boolean;
  secure?: boolean;
};
type RegisteredResp = { ok: boolean; servers?: RegisteredServer[] };
type PublicResp = { ok: boolean; servers?: PublicServer[]; error?: string };

type ModRow = {
  id: string;
  name: string;
  author: string | null;
  summary: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  source: string;
  endorsements: number;
  downloads: number;
};
type ModsResp = { mods?: ModRow[] };

export function WindrosePanel({ lobbyId }: { lobbyId: string }) {
  const [tab, setTab] = useState<Tab>("live");
  return (
    <View className="border-t border-border/40 pt-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide px-4 pb-2">Windrose</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <TabBtn label="🎮 Live" active={tab === "live"} onPress={() => setTab("live")} />
        <TabBtn label="💀 Bounties" active={tab === "bounties"} onPress={() => setTab("bounties")} />
        <TabBtn label="⚓ Ports" active={tab === "ports"} onPress={() => setTab("ports")} />
        <TabBtn label="🪝 Mods" active={tab === "mods"} onPress={() => setTab("mods")} />
        <TabBtn label="📺 Streams" active={tab === "streams"} onPress={() => setTab("streams")} />
        <TabBtn label="📰 News" active={tab === "news"} onPress={() => setTab("news")} />
        <TabBtn label="🤝 LFG" active={tab === "lfg"} onPress={() => setTab("lfg")} />
      </ScrollView>
      <View className="min-h-[160px]">
        {tab === "live" && <LiveTab />}
        {tab === "bounties" && <BountiesTab />}
        {tab === "ports" && <PortsTab />}
        {tab === "mods" && <ModsTab />}
        {tab === "streams" && <StreamsTab />}
        {tab === "news" && <NewsTab />}
        {tab === "lfg" && <LfgPanel lobbyId={lobbyId} />}
      </View>
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="px-3 py-2.5 active:opacity-70">
      <Text className={`text-xs font-bold ${active ? "text-weered" : "text-weered-muted"}`}>{label}</Text>
    </Pressable>
  );
}

function LiveTab() {
  const liveQ = useQuery({
    queryKey: ["windrose-live"],
    queryFn: () => api<LiveResp>("/windrose/live-players"),
    refetchInterval: 60_000,
  });
  const launchQ = useQuery({
    queryKey: ["windrose-launch"],
    queryFn: () => api<any>("/windrose/launch"),
  });

  return (
    <View className="py-4 px-4">
      <View className="bg-panel border border-border rounded-xl p-4 items-center mb-3">
        <Text className="text-weered-muted text-xs uppercase tracking-widest">Live players (Steam)</Text>
        <Text className="text-weered-text font-black text-3xl mt-1">
          {liveQ.isLoading ? "…" : (liveQ.data?.players ?? 0).toLocaleString()}
        </Text>
        <Text className="text-weered-muted text-[10px] mt-1">
          {liveQ.data?.checkedAt ? `checked ${new Date(liveQ.data.checkedAt).toLocaleTimeString()}` : ""}
        </Text>
      </View>

      {launchQ.data?.ok && (
        <>
          <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">Launch snapshot</Text>
          {(launchQ.data.milestones || []).map((m: any) => (
            <View key={m.label} className="bg-panel border border-border rounded-lg px-3 py-2 mb-1.5 flex-row items-center">
              <View className="flex-1">
                <Text className="text-weered-muted text-xs">{m.label}</Text>
                <Text className="text-weered-text font-bold">{m.value}</Text>
              </View>
              {!!m.sub && <Text className="text-weered-muted text-[10px]">{m.sub}</Text>}
            </View>
          ))}
          {launchQ.data.platform?.steam && (
            <Pressable
              onPress={() => Linking.openURL(launchQ.data.platform.steam).catch(() => {})}
              className="bg-weered px-4 py-2.5 rounded-lg mt-2 active:opacity-80"
            >
              <Text className="text-white text-center font-bold">Open on Steam ↗</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function BountiesTab() {
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<BountyFilter>("OPEN");
  const [composeOpen, setComposeOpen] = useState(false);
  const [claiming, setClaiming] = useState<Bounty | null>(null);

  const listQ = useQuery({
    queryKey: ["windrose-bounties", filter],
    queryFn: () => {
      const qs = filter === "MINE" ? "?mine=1" : "?status=OPEN";
      return api<BountiesResp>(`/windrose/bounties${qs}`);
    },
    refetchInterval: 30_000,
  });

  const walletQ = useQuery({
    queryKey: ["paper-wallet"],
    queryFn: () => api<WalletResp>("/paper/wallet"),
    enabled: !!me,
  });

  const settle = useMutation({
    mutationFn: (id: string) => api(`/windrose/bounties/${id}/settle`, { method: "POST", body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windrose-bounties"] });
      qc.invalidateQueries({ queryKey: ["paper-wallet"] });
    },
    onError: (e: any) => Alert.alert("Couldn't settle", e?.message || "Unknown error"),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api(`/windrose/bounties/${id}/reject`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["windrose-bounties"] }),
    onError: (e: any) => Alert.alert("Couldn't reject", e?.message || "Unknown error"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/windrose/bounties/${id}/cancel`, { method: "POST", body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windrose-bounties"] });
      qc.invalidateQueries({ queryKey: ["paper-wallet"] });
    },
    onError: (e: any) => Alert.alert("Couldn't cancel", e?.message || "Unknown error"),
  });

  const bounties = listQ.data?.bounties ?? [];
  const balance = walletQ.data?.balance;

  return (
    <View className="py-3">
      <View className="flex-row items-center px-4 pb-2">
        <Pressable onPress={() => setFilter("OPEN")} className="mr-2">
          <Text className={`text-xs font-bold ${filter === "OPEN" ? "text-weered" : "text-weered-muted"}`}>Open</Text>
        </Pressable>
        <Pressable onPress={() => setFilter("MINE")}>
          <Text className={`text-xs font-bold ${filter === "MINE" ? "text-weered" : "text-weered-muted"}`}>Mine</Text>
        </Pressable>
        <View className="flex-1" />
        {balance !== undefined && (
          <Text className="text-amber-300 text-xs font-bold mr-3">{balance.toLocaleString()} ¢</Text>
        )}
        {me && (
          <Pressable onPress={() => setComposeOpen(true)} hitSlop={6} className="active:opacity-70">
            <Text className="text-weered text-xs font-bold">+ Post</Text>
          </Pressable>
        )}
      </View>

      {listQ.isLoading && <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>}

      {!listQ.isLoading && bounties.length === 0 && (
        <Text className="text-weered-muted text-sm text-center py-6">
          {filter === "MINE" ? "No bounties under your name yet." : "No open bounties. Post the first one!"}
        </Text>
      )}

      {bounties.map((b) => {
        const isPoster = me?.id === b.posterId;
        const isClaimant = me?.id === b.claimantId;
        return (
          <View key={b.id} className="px-4 py-3 border-b border-border/30">
            <View className="flex-row items-start mb-1">
              <View className="flex-1 mr-2">
                <Text className="text-weered-text font-bold" numberOfLines={1}>💀 {b.targetHandle}</Text>
                {b.targetServer && (
                  <Text className="text-weered-muted text-[11px]" numberOfLines={1}>on {b.targetServer}</Text>
                )}
              </View>
              <Text className="text-amber-300 font-black text-base">{b.amount.toLocaleString()} ¢</Text>
            </View>
            {!!b.reason && (
              <Text className="text-weered-muted text-xs mb-1.5" numberOfLines={3}>{b.reason}</Text>
            )}
            <View className="flex-row items-center mb-1.5">
              <StatusPill status={b.status} />
              <Text className="text-weered-muted text-[10px] ml-2 flex-1" numberOfLines={1}>
                by {b.posterName}
                {b.claimantName ? ` · claimed by ${b.claimantName}` : ""}
              </Text>
            </View>
            {b.status === "CLAIMED" && b.proofNote && (
              <View className="bg-panel border border-border rounded-md px-2.5 py-2 mb-1.5">
                <Text className="text-weered-muted text-[10px] uppercase tracking-wide mb-0.5">Proof</Text>
                <Text className="text-weered-text text-xs">{b.proofNote}</Text>
              </View>
            )}
            <View className="flex-row">
              {b.status === "OPEN" && me && !isPoster && (
                <Pressable
                  onPress={() => setClaiming(b)}
                  className="bg-weered px-3 py-1.5 rounded-md mr-2 active:opacity-80"
                >
                  <Text className="text-white text-xs font-bold">Claim</Text>
                </Pressable>
              )}
              {b.status === "OPEN" && isPoster && (
                <Pressable
                  onPress={() => cancel.mutate(b.id)}
                  className="bg-panel border border-border px-3 py-1.5 rounded-md mr-2 active:opacity-70"
                >
                  <Text className="text-weered-muted text-xs font-bold">Cancel & refund</Text>
                </Pressable>
              )}
              {b.status === "CLAIMED" && isPoster && (
                <>
                  <Pressable
                    onPress={() => settle.mutate(b.id)}
                    className="bg-green-700 px-3 py-1.5 rounded-md mr-2 active:opacity-80"
                  >
                    <Text className="text-white text-xs font-bold">Confirm & pay</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => reject.mutate(b.id)}
                    className="bg-panel border border-border px-3 py-1.5 rounded-md active:opacity-70"
                  >
                    <Text className="text-weered-muted text-xs font-bold">Reject proof</Text>
                  </Pressable>
                </>
              )}
              {b.status === "CLAIMED" && isClaimant && !isPoster && (
                <Text className="text-weered-muted text-[11px] italic">Awaiting confirmation…</Text>
              )}
            </View>
          </View>
        );
      })}

      {composeOpen && (
        <BountyForm
          onClose={() => setComposeOpen(false)}
          onCreated={() => {
            setComposeOpen(false);
            qc.invalidateQueries({ queryKey: ["windrose-bounties"] });
            qc.invalidateQueries({ queryKey: ["paper-wallet"] });
          }}
        />
      )}
      {claiming && (
        <ClaimForm
          bounty={claiming}
          onClose={() => setClaiming(null)}
          onClaimed={() => {
            setClaiming(null);
            qc.invalidateQueries({ queryKey: ["windrose-bounties"] });
          }}
        />
      )}
    </View>
  );
}

function StatusPill({ status }: { status: Bounty["status"] }) {
  const palette: Record<Bounty["status"], { bg: string; text: string; label: string }> = {
    OPEN:      { bg: "bg-amber-700/30", text: "text-amber-300", label: "OPEN" },
    CLAIMED:   { bg: "bg-blue-700/30",  text: "text-blue-300",  label: "CLAIMED" },
    SETTLED:   { bg: "bg-green-700/30", text: "text-green-300", label: "SETTLED" },
    CANCELLED: { bg: "bg-panel",        text: "text-weered-muted", label: "CANCELLED" },
  };
  const p = palette[status];
  return (
    <View className={`${p.bg} px-2 py-0.5 rounded`}>
      <Text className={`${p.text} text-[10px] font-bold tracking-wide`}>{p.label}</Text>
    </View>
  );
}

function BountyForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [target, setTarget] = useState("");
  const [server, setServer] = useState("");
  const [amount, setAmount] = useState("1000");
  const [reason, setReason] = useState("");

  const create = useMutation({
    mutationFn: () => api("/windrose/bounties", {
      method: "POST",
      body: {
        targetHandle: target.trim(),
        targetServer: server.trim() || undefined,
        amount: Number(amount) || 0,
        reason: reason.trim(),
      },
    }),
    onSuccess: onCreated,
    onError: (e: any) => Alert.alert("Couldn't post bounty", e?.message || "Unknown error"),
  });

  const canPost = target.trim().length > 0 && Number(amount) > 0;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5 max-h-[85%]">
          <ScrollView>
            <Text className="text-weered-text font-bold text-lg mb-1">Post a bounty</Text>
            <Text className="text-weered-muted text-xs mb-4">Stake's escrowed when you post — refunded only on cancel.</Text>

            <Field label="Mark *">
              <Input value={target} onChangeText={setTarget} placeholder="BlackbeardXL · Kraken tooth · Rum run…" maxLength={60} />
            </Field>
            <Field label="Server (optional)">
              <Input value={server} onChangeText={setServer} placeholder="server name or IP" />
            </Field>
            <Field label="Bounty (¢)">
              <Input value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            </Field>
            <Field label="Why">
              <Input value={reason} onChangeText={setReason} placeholder="What does the hunter need to deliver?" multiline />
            </Field>

            <View className="flex-row mt-4">
              <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
                <Text className="text-weered-muted text-center font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => canPost && create.mutate()}
                disabled={create.isPending || !canPost}
                className={`flex-1 px-3 py-3 rounded-lg active:opacity-80 ${canPost ? "bg-weered" : "bg-weered/40"}`}
              >
                <Text className="text-white text-center font-bold">{create.isPending ? "Posting…" : "Post bounty"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ClaimForm({ bounty, onClose, onClaimed }: { bounty: Bounty; onClose: () => void; onClaimed: () => void }) {
  const [proofNote, setProofNote] = useState("");

  const claim = useMutation({
    mutationFn: () => api(`/windrose/bounties/${bounty.id}/claim`, {
      method: "POST",
      body: { proofNote: proofNote.trim() },
    }),
    onSuccess: onClaimed,
    onError: (e: any) => Alert.alert("Couldn't claim", e?.message || "Unknown error"),
  });

  const canClaim = proofNote.trim().length >= 6;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 justify-center px-5">
        <View className="bg-weered-bg border border-border rounded-2xl p-5">
          <Text className="text-weered-text font-bold text-lg mb-1">Claim bounty</Text>
          <Text className="text-weered-muted text-xs mb-3">
            💀 {bounty.targetHandle} · <Text className="text-amber-300 font-bold">{bounty.amount.toLocaleString()} ¢</Text>
          </Text>
          <Field label="Proof note">
            <Input
              value={proofNote}
              onChangeText={setProofNote}
              placeholder="Server, time, screenshot link, witnesses…"
              multiline
            />
          </Field>
          <View className="flex-row mt-3">
            <Pressable onPress={onClose} className="flex-1 mr-2 px-3 py-3 rounded-lg bg-panel border border-border active:opacity-70">
              <Text className="text-weered-muted text-center font-bold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => canClaim && claim.mutate()}
              disabled={claim.isPending || !canClaim}
              className={`flex-1 px-3 py-3 rounded-lg active:opacity-80 ${canClaim ? "bg-weered" : "bg-weered/40"}`}
            >
              <Text className="text-white text-center font-bold">{claim.isPending ? "Claiming…" : "Submit claim"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type PortRow = {
  key: string;
  source: "registered" | "public" | "both";
  name: string;
  addr: string;
  description?: string | null;
  region?: string | null;
  framework?: string | null;
  tags?: string[];
  players: number;
  maxPlayers: number;
  passworded?: boolean;
  ownerName?: string;
  status?: string;
};

function PortsTab() {
  const regQ = useQuery({
    queryKey: ["windrose-servers"],
    queryFn: () => api<RegisteredResp>("/windrose/servers"),
    refetchInterval: 60_000,
  });
  const pubQ = useQuery({
    queryKey: ["windrose-public-servers"],
    queryFn: () => api<PublicResp>("/windrose/public-servers"),
    refetchInterval: 60_000,
  });
  const [query, setQuery] = useState("");

  const rows = useMemo<PortRow[]>(() => {
    const reg = regQ.data?.servers ?? [];
    const pub = pubQ.data?.servers ?? [];
    const byAddr = new Map<string, PortRow>();
    for (const p of pub) {
      byAddr.set(p.addr.toLowerCase(), {
        key: `pub:${p.addr}`,
        source: "public",
        name: p.name || p.addr,
        addr: p.addr,
        players: p.players,
        maxPlayers: p.maxPlayers,
        passworded: p.passworded,
      });
    }
    for (const r of reg) {
      const host = String(r.host || "").toLowerCase();
      const existing = host ? byAddr.get(host) : undefined;
      if (existing) {
        byAddr.set(host, {
          ...existing,
          source: "both",
          name: r.name || existing.name,
          description: r.description ?? existing.description,
          region: r.region ?? existing.region,
          framework: r.framework ?? existing.framework,
          tags: r.tags?.length ? r.tags : existing.tags,
          ownerName: r.owner?.name,
          status: r.status,
        });
      } else {
        byAddr.set(`reg:${r.id}`, {
          key: `reg:${r.id}`,
          source: "registered",
          name: r.name,
          addr: r.host,
          description: r.description,
          region: r.region,
          framework: r.framework,
          tags: r.tags,
          players: 0,
          maxPlayers: r.maxSlots ?? 8,
          ownerName: r.owner?.name,
          status: r.status,
        });
      }
    }
    return Array.from(byAddr.values()).sort((a, b) => {
      const aPin = a.source !== "public" ? 1 : 0;
      const bPin = b.source !== "public" ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      if (b.players !== a.players) return b.players - a.players;
      return a.name.localeCompare(b.name);
    });
  }, [regQ.data, pubQ.data]);

  const filtered = query.trim()
    ? rows.filter((r) => `${r.name} ${r.addr} ${(r.tags || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;

  const loading = regQ.isLoading || pubQ.isLoading;
  const pubError = pubQ.data && !pubQ.data.ok;

  return (
    <View className="py-3">
      <View className="px-4 pb-2">
        <Input value={query} onChangeText={setQuery} placeholder="Search ports of call…" />
      </View>
      {loading && <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>}
      {!loading && filtered.length === 0 && (
        <Text className="text-weered-muted text-sm text-center py-6">
          {pubError ? "Steam discovery unavailable. Registered servers will still appear here." : "No ports of call yet."}
        </Text>
      )}
      {filtered.map((s) => (
        <View key={s.key} className="px-4 py-2.5 border-b border-border/30">
          <View className="flex-row items-center mb-1">
            <View
              style={{
                width: 8, height: 8, borderRadius: 4, marginRight: 6,
                backgroundColor: s.players > 0 ? "#22c55e" : "#94a3b8",
              }}
            />
            <Text className="text-weered-text font-bold flex-1" numberOfLines={1}>{s.name}</Text>
            <Text className="text-weered-muted text-xs">
              {s.players}/{s.maxPlayers || "?"}
            </Text>
          </View>
          {!!s.description && (
            <Text className="text-weered-muted text-xs mb-1" numberOfLines={2}>{s.description}</Text>
          )}
          <View className="flex-row items-center flex-wrap">
            {s.source !== "public" && (
              <View className="bg-amber-700/30 px-1.5 py-0.5 rounded mr-1.5">
                <Text className="text-amber-300 text-[9px] font-bold tracking-wide">REGISTERED</Text>
              </View>
            )}
            {s.region && <Text className="text-weered-muted text-[10px] mr-2">{s.region}</Text>}
            {s.framework && <Text className="text-weered-muted text-[10px] mr-2 uppercase">{s.framework}</Text>}
            {s.passworded && <Text className="text-weered-muted text-[10px] mr-2">🔒</Text>}
            {s.ownerName && <Text className="text-weered-muted text-[10px]">by {s.ownerName}</Text>}
          </View>
          {s.addr && (
            <Text className="text-weered-muted/70 text-[10px] font-mono mt-0.5">{s.addr}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function ModsTab() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"endorsed" | "downloads" | "updated" | "new">("endorsed");

  const q = useQuery({
    queryKey: ["windrose-mods", sort, search],
    queryFn: () => {
      const params = new URLSearchParams({ gameSlug: "windrose", sort, limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      return api<ModsResp>(`/mods?${params.toString()}`);
    },
    staleTime: 5 * 60_000,
  });

  const mods = q.data?.mods ?? [];

  return (
    <View className="py-3">
      <View className="px-4 pb-2">
        <Input value={search} onChangeText={setSearch} placeholder="Search mods, authors…" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6 }}>
        {(["endorsed", "downloads", "updated", "new"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSort(s)}
            className={`mr-2 px-2.5 py-1 rounded-md border ${sort === s ? "bg-weered border-weered" : "bg-panel border-border"}`}
          >
            <Text className={`text-[10px] font-bold uppercase tracking-wide ${sort === s ? "text-white" : "text-weered-muted"}`}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {q.isLoading && <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>}
      {!q.isLoading && mods.length === 0 && (
        <Text className="text-weered-muted text-sm text-center py-6">
          {search ? "No mods match that search." : "Catalog hasn't surfaced any Windrose mods yet."}
        </Text>
      )}

      {mods.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => m.sourceUrl && Linking.openURL(m.sourceUrl).catch(() => {})}
          className="flex-row items-center px-4 py-2.5 active:bg-panel border-b border-border/30"
        >
          {m.thumbnailUrl ? (
            <Image
              source={{ uri: m.thumbnailUrl }}
              style={{ width: 64, height: 36, borderRadius: 4, backgroundColor: "#111" }}
            />
          ) : (
            <View style={{ width: 64, height: 36, borderRadius: 4, backgroundColor: "#1a0a25" }} />
          )}
          <View className="flex-1 ml-3">
            <Text className="text-weered-text font-semibold text-sm" numberOfLines={1}>{m.name}</Text>
            {m.author && (
              <Text className="text-weered-muted text-[11px] italic" numberOfLines={1}>by {m.author}</Text>
            )}
            <View className="flex-row mt-0.5">
              <Text className="text-weered-muted text-[10px] mr-3">👍 {m.endorsements.toLocaleString()}</Text>
              <Text className="text-weered-muted text-[10px]">⬇ {m.downloads.toLocaleString()}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function StreamsTab() {
  const q = useQuery({
    queryKey: ["twitch-streams", "Windrose"],
    queryFn: () => api<StreamsResp>(`/twitch/streams?game=${encodeURIComponent("Windrose")}&first=20`),
    staleTime: 5 * 60 * 1000,
  });
  if (q.isLoading) return <View className="py-8 items-center"><ActivityIndicator color="#5800E5" /></View>;
  if (!q.data?.ok || !q.data.streams?.length) {
    return <Text className="text-weered-muted text-sm text-center py-6">No live streams.</Text>;
  }
  return (
    <View className="py-2">
      {q.data.streams.slice(0, 10).map((s) => (
        <Pressable
          key={s.userLogin}
          onPress={() => Linking.openURL(`https://twitch.tv/${s.userLogin}`).catch(() => {})}
          className="flex-row items-center px-4 py-2.5 active:bg-panel"
        >
          <Image
            source={{ uri: s.thumbnailUrl.replace("{width}", "160").replace("{height}", "90") }}
            style={{ width: 80, height: 45, borderRadius: 4, backgroundColor: "#111" }}
          />
          <View className="flex-1 ml-3">
            <Text className="text-weered-text font-semibold text-sm" numberOfLines={1}>{s.userName}</Text>
            <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={1}>{s.title}</Text>
            <Text className="text-red-400 text-xs mt-0.5">● {s.viewerCount.toLocaleString()} viewers</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function NewsTab() {
  const q = useQuery({
    queryKey: ["windrose-news"],
    queryFn: () => api<NewsResp>("/windrose/news"),
    staleTime: 10 * 60_000,
  });
  if (q.isLoading) return <View className="py-6 items-center"><ActivityIndicator color="#5800E5" /></View>;
  const rows = q.data?.news ?? [];
  if (rows.length === 0) return <Text className="text-weered-muted text-sm text-center py-6">No news.</Text>;
  return (
    <View className="py-2">
      {rows.map((n) => (
        <Pressable
          key={n.id}
          onPress={() => Linking.openURL(n.url).catch(() => {})}
          className="px-4 py-2.5 border-b border-border/20 active:bg-panel"
        >
          <Text className="text-weered-text font-semibold text-sm" numberOfLines={2}>{n.title}</Text>
          <Text className="text-weered-muted text-xs mt-0.5" numberOfLines={2}>{n.contents}</Text>
          <Text className="text-weered-muted/70 text-[10px] mt-0.5">{n.feedlabel}{n.date ? ` · ${new Date(n.date).toLocaleDateString()}` : ""}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-weered-muted text-xs uppercase tracking-wide mb-1">{label}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="rgba(160,160,170,0.6)"
      className="bg-panel border border-border text-weered-text px-3 py-2.5 rounded-lg"
      style={[{ fontSize: 14, minHeight: 42 }, props.multiline ? { minHeight: 64, textAlignVertical: "top" } : null]}
    />
  );
}
