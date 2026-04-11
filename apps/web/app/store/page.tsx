"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWeered } from "../../components/WeeredProvider";

/* ─── Constants ──────────────────────────────────────────────────────────── */
const GOLD = "#F5C518";
const GREEN = "#22c55e";
const RED = "#ef4444";

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#9ca3af",
  UNCOMMON: "#22c55e",
  RARE: "#3b82f6",
  EPIC: "#a855f7",
  LEGENDARY: "#f59e0b",
};

const CATEGORY_ICONS: Record<string, string> = {
  BADGE: "🏅",
  TITLE: "🏷️",
  AVATAR_FRAME: "🖼️",
  CHAT_FLAIR: "✨",
  EMOTE: "😎",
  CONSUMABLE: "🧪",
  KEY: "🔑",
  COSMETIC: "🎨",
};

type Tab = "store" | "inventory" | "market";

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const S = {
  page: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "24px 16px",
    minHeight: "100vh",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    flexWrap: "wrap" as const,
    gap: 12,
  } as React.CSSProperties,
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: GOLD,
    letterSpacing: "-0.5px",
  } as React.CSSProperties,
  wallet: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(245,197,24,.08)",
    border: "1px solid rgba(245,197,24,.2)",
    borderRadius: 12,
    padding: "10px 18px",
  } as React.CSSProperties,
  walletAmount: {
    fontSize: 22,
    fontWeight: 700,
    color: GOLD,
  } as React.CSSProperties,
  walletLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,.45)",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  } as React.CSSProperties,
  tabs: {
    display: "flex",
    gap: 4,
    marginBottom: 20,
    background: "rgba(255,255,255,.03)",
    borderRadius: 10,
    padding: 4,
    border: "1px solid rgba(255,255,255,.06)",
  } as React.CSSProperties,
  card: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    padding: 16,
    transition: "border-color .15s, background .15s",
    cursor: "pointer",
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 14,
  } as React.CSSProperties,
  btn: (bg: string, disabled?: boolean) => ({
    background: disabled ? "rgba(255,255,255,.06)" : bg,
    color: disabled ? "rgba(255,255,255,.3)" : "#000",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    width: "100%",
    marginTop: 8,
    opacity: disabled ? 0.5 : 1,
  } as React.CSSProperties),
  rarityBadge: (rarity: string) => ({
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    color: RARITY_COLORS[rarity] || "#fff",
    border: `1px solid ${RARITY_COLORS[rarity] || "#fff"}33`,
    borderRadius: 4,
    padding: "2px 6px",
    letterSpacing: 0.5,
  } as React.CSSProperties),
  empty: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: "rgba(255,255,255,.35)",
    fontSize: 14,
  } as React.CSSProperties,
  dailyBtn: (claimed: boolean) => ({
    background: claimed ? "rgba(255,255,255,.06)" : `linear-gradient(135deg, ${GOLD}, #e6a800)`,
    color: claimed ? "rgba(255,255,255,.4)" : "#000",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontWeight: 700,
    fontSize: 13,
    cursor: claimed ? "default" : "pointer",
  } as React.CSSProperties),
};

/* ─── Hook: API fetch helper ─────────────────────────────────────────────── */
function useApi() {
  const { apiBase, token } = useWeered();
  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const get = useCallback(async (path: string) => {
    const r = await fetch(`${apiBase}${path}`, { headers: headers() });
    return r.json();
  }, [apiBase, headers]);

  const post = useCallback(async (path: string, body?: any) => {
    const r = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body || {}),
    });
    return r.json();
  }, [apiBase, headers]);

  return { get, post };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ─── Main Page ──────────────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function StorePage() {
  const { me, authed } = useWeered();
  const { get, post } = useApi();

  const [tab, setTab] = useState<Tab>("store");
  const [balance, setBalance] = useState(0);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [dailyNextAt, setDailyNextAt] = useState<string | null>(null);

  // Store state
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<any[]>([]);
  const [invLoading, setInvLoading] = useState(false);

  // Market state
  const [listings, setListings] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const [marketRarity, setMarketRarity] = useState("");
  const [marketSort, setMarketSort] = useState("newest");

  // Listing modal
  const [listingItem, setListingItem] = useState<any>(null);
  const [listingPrice, setListingPrice] = useState("");

  // Busy states
  const [busy, setBusy] = useState<string | null>(null);

  // ── Fetch wallet balance ──
  const fetchWallet = useCallback(async () => {
    try {
      const d = await get("/paper/wallet");
      if (d.ok !== false) setBalance(d.balance ?? 0);
    } catch {}
  }, [get]);

  // ── Fetch store items ──
  const fetchStore = useCallback(async () => {
    setStoreLoading(true);
    try {
      const d = await get("/store");
      if (d.ok !== false) setStoreItems(d.items || []);
    } catch {}
    setStoreLoading(false);
  }, [get]);

  // ── Fetch inventory ──
  const fetchInventory = useCallback(async () => {
    setInvLoading(true);
    try {
      const d = await get("/inventory");
      if (d.ok !== false) setInventory(d.items || []);
    } catch {}
    setInvLoading(false);
  }, [get]);

  // ── Fetch marketplace ──
  const fetchMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const params = new URLSearchParams();
      if (marketSearch) params.set("search", marketSearch);
      if (marketRarity) params.set("rarity", marketRarity);
      if (marketSort) params.set("sort", marketSort);
      const d = await get(`/market?${params}`);
      if (d.ok !== false) setListings(d.listings || []);
    } catch {}
    setMarketLoading(false);
  }, [get, marketSearch, marketRarity, marketSort]);

  // ── Initial load ──
  useEffect(() => {
    if (!authed) return;
    fetchWallet();
    fetchStore();
  }, [authed, fetchWallet, fetchStore]);

  // ── Tab change triggers ──
  useEffect(() => {
    if (!authed) return;
    if (tab === "inventory") fetchInventory();
    if (tab === "market") fetchMarket();
  }, [tab, authed, fetchInventory, fetchMarket]);

  // ── Daily claim ──
  async function claimDaily() {
    if (dailyClaimed) return;
    const d = await post("/paper/daily");
    if (d.ok) {
      setBalance(d.balance);
      setDailyClaimed(true);
    } else if (d.error === "cooldown") {
      setDailyClaimed(true);
      setDailyNextAt(d.nextAt);
    }
  }

  // Check daily status on mount via wallet transactions
  useEffect(() => {
    if (!authed) return;
    get("/paper/wallet").then(d => {
      if (!d.ok && d.ok !== undefined) return;
      setBalance(d.balance ?? 0);
      // Check if any EARN_DAILY transaction in last 24h
      const txns = d.transactions || [];
      const daily = txns.find((t: any) => t.type === "EARN_DAILY");
      if (daily) {
        const since = Date.now() - new Date(daily.createdAt).getTime();
        if (since < 86400000) {
          setDailyClaimed(true);
          setDailyNextAt(new Date(new Date(daily.createdAt).getTime() + 86400000).toISOString());
        }
      }
    }).catch(() => {});
  }, [authed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Store: buy ──
  async function buyItem(itemId: string) {
    setBusy(itemId);
    const d = await post(`/store/buy/${itemId}`);
    if (d.ok) {
      setBalance(d.balance ?? balance);
      fetchStore();
      fetchInventory();
    } else {
      alert(d.error === "insufficient_paper" ? "Not enough Paper!" : d.error === "sold_out" ? "Sold out!" : (d.error || "Purchase failed"));
    }
    setBusy(null);
  }

  // ── Inventory: equip ──
  async function equipItem(userItemId: string) {
    setBusy(userItemId);
    const d = await post(`/inventory/equip/${userItemId}`);
    if (d.ok) fetchInventory();
    setBusy(null);
  }

  // ── Inventory: consume ──
  async function consumeItem(userItemId: string) {
    setBusy(userItemId);
    const d = await post(`/inventory/consume/${userItemId}`);
    if (d.ok) {
      fetchInventory();
      fetchWallet();
    }
    setBusy(null);
  }

  // ── Market: list item for sale ──
  async function listForSale() {
    if (!listingItem || !listingPrice) return;
    setBusy("listing");
    const d = await post("/market/list", { userItemId: listingItem.id, price: parseInt(listingPrice) });
    if (d.ok) {
      setListingItem(null);
      setListingPrice("");
      fetchInventory();
      fetchMarket();
    } else {
      alert(d.error || "Failed to list");
    }
    setBusy(null);
  }

  // ── Market: buy listing ──
  async function buyListing(listingId: string) {
    setBusy(listingId);
    const d = await post(`/market/buy/${listingId}`);
    if (d.ok) {
      setBalance(d.balance ?? balance);
      fetchMarket();
      fetchInventory();
    } else {
      alert(d.error === "insufficient_paper" ? "Not enough Paper!" : (d.error || "Purchase failed"));
    }
    setBusy(null);
  }

  // ── Market: cancel listing ──
  async function cancelListing(listingId: string) {
    setBusy(listingId);
    const d = await post(`/market/cancel/${listingId}`);
    if (d.ok) {
      fetchMarket();
      fetchInventory();
    }
    setBusy(null);
  }

  if (!authed) {
    return <div style={S.page}><div style={S.empty}>Log in to access the store.</div></div>;
  }

  return (
    <div style={S.page}>
      {/* ── Header: title + wallet ── */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Paper</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 2 }}>Earn. Spend. Trade.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={claimDaily} style={S.dailyBtn(dailyClaimed)}>
            {dailyClaimed ? (dailyNextAt ? `Next: ${new Date(dailyNextAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Claimed") : "+ Claim 25 Paper"}
          </button>
          <div style={S.wallet}>
            <div>
              <div style={S.walletLabel}>Balance</div>
              <div style={S.walletAmount}>{balance.toLocaleString()}</div>
            </div>
            <span style={{ fontSize: 28 }}>💵</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={S.tabs}>
        {(["store", "inventory", "market"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              fontWeight: 700,
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              cursor: "pointer",
              background: tab === t ? "rgba(245,197,24,.15)" : "transparent",
              color: tab === t ? GOLD : "rgba(255,255,255,.45)",
              transition: "all .15s",
            }}
          >
            {t === "store" ? "🛒 Store" : t === "inventory" ? "🎒 Inventory" : "📊 Market"}
          </button>
        ))}
      </div>

      {/* ── Store Tab ── */}
      {tab === "store" && (
        <div>
          {storeLoading ? (
            <div style={S.empty}>Loading store...</div>
          ) : storeItems.length === 0 ? (
            <div style={S.empty}>Store is empty. Check back soon!</div>
          ) : (
            <div style={S.grid}>
              {storeItems.map((item: any) => {
                const soldOut = item.maxSupply > 0 && item.soldCount >= item.maxSupply;
                const canAfford = balance >= item.price;
                return (
                  <div
                    key={item.id}
                    style={{
                      ...S.card,
                      borderColor: `${RARITY_COLORS[item.rarity] || "#fff"}22`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 28 }}>{CATEGORY_ICONS[item.category] || "📦"}</span>
                      <span style={S.rarityBadge(item.rarity)}>{item.rarity}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.name}</div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 8, lineHeight: 1.4 }}>{item.description}</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: GOLD, fontSize: 15 }}>{item.price} 💵</span>
                      {item.maxSupply > 0 && (
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,.35)" }}>
                          {item.soldCount}/{item.maxSupply} sold
                        </span>
                      )}
                    </div>
                    <button
                      style={S.btn(GOLD, soldOut || !canAfford || busy === item.id)}
                      onClick={() => buyItem(item.id)}
                      disabled={soldOut || !canAfford || busy === item.id}
                    >
                      {busy === item.id ? "..." : soldOut ? "SOLD OUT" : !canAfford ? "CAN'T AFFORD" : "BUY"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Inventory Tab ── */}
      {tab === "inventory" && (
        <div>
          {invLoading ? (
            <div style={S.empty}>Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div style={S.empty}>Your collection is empty. Hit the store!</div>
          ) : (
            <div style={S.grid}>
              {inventory.map((ui: any) => {
                const item = ui.item || {};
                return (
                  <div
                    key={ui.id}
                    style={{
                      ...S.card,
                      borderColor: ui.equipped ? `${GOLD}44` : `${RARITY_COLORS[item.rarity] || "#fff"}22`,
                      background: ui.equipped ? "rgba(245,197,24,.06)" : S.card.background,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 28 }}>{CATEGORY_ICONS[item.category] || "📦"}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {ui.equipped && <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase" }}>Equipped</span>}
                        <span style={S.rarityBadge(item.rarity)}>{item.rarity}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.name}</div>
                    {item.maxSupply > 0 && ui.mintNumber && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginBottom: 4 }}>
                        #{ui.mintNumber} / {item.maxSupply}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {item.category !== "CONSUMABLE" && (
                        <button
                          style={{ ...S.btn(ui.equipped ? "rgba(255,255,255,.12)" : GOLD), flex: 1 }}
                          onClick={() => equipItem(ui.id)}
                          disabled={busy === ui.id}
                        >
                          {busy === ui.id ? "..." : ui.equipped ? "UNEQUIP" : "EQUIP"}
                        </button>
                      )}
                      {item.category === "CONSUMABLE" && !ui.consumed && (
                        <button
                          style={{ ...S.btn(GREEN), flex: 1 }}
                          onClick={() => consumeItem(ui.id)}
                          disabled={busy === ui.id}
                        >
                          {busy === ui.id ? "..." : "USE"}
                        </button>
                      )}
                      {!ui.equipped && !ui.consumed && (
                        <button
                          style={{ ...S.btn("rgba(255,255,255,.08)"), flex: 1, color: "#fff" }}
                          onClick={() => { setListingItem(ui); setListingPrice(""); }}
                        >
                          SELL
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Market Tab ── */}
      {tab === "market" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              placeholder="Search items..."
              value={marketSearch}
              onChange={e => setMarketSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 160,
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
            <select
              value={marketRarity}
              onChange={e => setMarketRarity(e.target.value)}
              style={{
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#fff",
                fontSize: 13,
              }}
            >
              <option value="">All Rarities</option>
              {Object.keys(RARITY_COLORS).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={marketSort}
              onChange={e => setMarketSort(e.target.value)}
              style={{
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#fff",
                fontSize: 13,
              }}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="rarity">Rarity</option>
            </select>
          </div>

          {marketLoading ? (
            <div style={S.empty}>Loading marketplace...</div>
          ) : listings.length === 0 ? (
            <div style={S.empty}>No listings right now. Be the first seller!</div>
          ) : (
            <div style={S.grid}>
              {listings.map((l: any) => {
                const isMine = l.sellerId === me?.id;
                return (
                  <div
                    key={l.id}
                    style={{
                      ...S.card,
                      borderColor: `${RARITY_COLORS[l.itemRarity] || "#fff"}22`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 28 }}>{CATEGORY_ICONS[l.category] || "📦"}</span>
                      <span style={S.rarityBadge(l.itemRarity)}>{l.itemRarity}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{l.itemName}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 4 }}>
                      Seller: {l.sellerName || "Unknown"}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: GOLD, fontSize: 16 }}>{l.price} 💵</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>
                        {timeLeft(l.expiresAt)}
                      </span>
                    </div>
                    {isMine ? (
                      <button
                        style={{ ...S.btn(RED), color: "#fff" }}
                        onClick={() => cancelListing(l.id)}
                        disabled={busy === l.id}
                      >
                        {busy === l.id ? "..." : "CANCEL"}
                      </button>
                    ) : (
                      <button
                        style={S.btn(GOLD, balance < l.price || busy === l.id)}
                        onClick={() => buyListing(l.id)}
                        disabled={balance < l.price || busy === l.id}
                      >
                        {busy === l.id ? "..." : balance < l.price ? "CAN'T AFFORD" : "BUY"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Listing Modal ── */}
      {listingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setListingItem(null)}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: "90%",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>List for Sale</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              {CATEGORY_ICONS[(listingItem.item || {}).category] || "📦"} {(listingItem.item || {}).name}
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={S.rarityBadge((listingItem.item || {}).rarity || "COMMON")}>{(listingItem.item || {}).rarity}</span>
            </div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,.5)", display: "block", marginBottom: 4 }}>
              Price (Paper)
            </label>
            <input
              type="number"
              min="1"
              value={listingPrice}
              onChange={e => setListingPrice(e.target.value)}
              placeholder="Enter price..."
              style={{
                width: "100%",
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                outline: "none",
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ ...S.btn("rgba(255,255,255,.08)"), color: "#fff", flex: 1 }}
                onClick={() => setListingItem(null)}
              >
                Cancel
              </button>
              <button
                style={S.btn(GOLD, !listingPrice || parseInt(listingPrice) <= 0 || busy === "listing")}
                onClick={listForSale}
                disabled={!listingPrice || parseInt(listingPrice) <= 0 || busy === "listing"}
              >
                {busy === "listing" ? "..." : "LIST"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginTop: 10, textAlign: "center" }}>
              Listing expires in 7 days
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function timeLeft(dateStr: string): string {
  if (!dateStr) return "";
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h > 0) return `${h}h left`;
  return `${Math.floor(ms / 60000)}m left`;
}
