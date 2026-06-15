"use client";

import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#a78bfa";

type Submission = {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string;
  voteCount?: number;
  createdAt: string;
  author?: { id: string; name: string; avatar?: string | null; avatarColor?: string | null };
};

type Contest = {
  id: string;
  lobbyId: string | null;
  title: string;
  description: string;
  theme: string;
  kind: "BADGE" | "BANNER" | "NAMEPLATE";
  status: "SUBMISSIONS" | "VOTING" | "COMPLETED" | "CANCELED";
  submissionOpensAt: string;
  submissionClosesAt: string;
  voteOpensAt: string;
  voteClosesAt: string;
  winnerSubmissionId?: string | null;
  rewardFlairId?: string | null;
  submissions: Submission[];
  mySubmission: Submission | null;
  myVote: { id: string; submissionId: string } | null;
  rewardFlair?: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    imageUrl: string | null;
    rarity: string;
    createdById: string | null;
  } | null;
};

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders() };
}

export default function FlairContestDetail({
  contestId,
  currentUserId,
  canManage,
  onBack,
  onChanged,
}: {
  contestId: string;
  currentUserId?: string;
  canManage?: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [contest, setContest] = React.useState<Contest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [showSubmit, setShowSubmit] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<Submission | null>(null);

  const fetchContest = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/flair-contests/${encodeURIComponent(contestId)}`, {
        headers: { ...authHeaders() },
      });
      const j = await r.json();
      if (j?.ok) setContest(j.contest);
      else setErr(j?.error || "Failed to load");
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  React.useEffect(() => {
    fetchContest();
  }, [fetchContest]);

  if (loading)
    return (
      <div
        style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.45)", fontSize: 13 }}
      >
        Loading...
      </div>
    );
  if (err || !contest)
    return (
      <div>
        <BackBar onBack={onBack} />
        <div style={{ padding: 30, color: "#fca5a5", fontSize: 13 }}>{err || "Not found"}</div>
      </div>
    );

  const status = contest.status;
  const winnerSub = contest.submissions.find((s) => s.id === contest.winnerSubmissionId) || null;

  async function castVote(submissionId: string) {
    const r = await fetch(`${API}/flair-contests/${encodeURIComponent(contestId)}/votes`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ submissionId }),
    });
    const j = await r.json();
    if (!r.ok || !j?.ok) {
      alert(j?.error || "Failed to vote");
      return;
    }
    fetchContest();
  }

  async function clearVote() {
    const r = await fetch(`${API}/flair-contests/${encodeURIComponent(contestId)}/votes`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    const j = await r.json();
    if (!r.ok || !j?.ok) {
      alert(j?.error || "Failed to clear vote");
      return;
    }
    fetchContest();
  }

  async function deleteSubmission(s: Submission) {
    if (typeof window !== "undefined" && !window.confirm("Delete your submission?")) return;
    const r = await fetch(
      `${API}/flair-contests/${encodeURIComponent(contestId)}/submissions/${encodeURIComponent(s.id)}`,
      {
        method: "DELETE",
        headers: { ...authHeaders() },
      },
    );
    const j = await r.json();
    if (!r.ok || !j?.ok) {
      alert(j?.error || "Failed to delete submission");
      return;
    }
    fetchContest();
    onChanged();
  }

  async function finalizeNow() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Finalize this contest now? Winner will be picked and flair minted.")
    )
      return;
    const r = await fetch(`${API}/flair-contests/${encodeURIComponent(contestId)}/finalize`, {
      method: "POST",
      headers: { ...authHeaders() },
    });
    const j = await r.json();
    if (!r.ok || !j?.ok) {
      alert(j?.error || "Failed to finalize");
      return;
    }
    fetchContest();
    onChanged();
  }

  const canFinalize =
    canManage && status === "VOTING" && new Date() >= new Date(contest.voteClosesAt);

  return (
    <div>
      <BackBar onBack={onBack} title={contest.title} status={status} />

      <div
        style={{
          background: "rgba(28,20,48,.6)",
          border: "1px solid rgba(167,139,250,.2)",
          borderRadius: 6,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <Pill label="Kind" value={contest.kind} />
          <Pill
            label="Submissions Close"
            value={new Date(contest.submissionClosesAt).toLocaleString()}
          />
          <Pill label="Vote Closes" value={new Date(contest.voteClosesAt).toLocaleString()} />
          <Pill label="Entries" value={String(contest.submissions.length)} />
        </div>
        {contest.theme && (
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "rgba(196,181,253,.85)", fontWeight: 700, marginRight: 6 }}>
              Theme:
            </span>
            {contest.theme}
          </div>
        )}
        {contest.description && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", whiteSpace: "pre-wrap" }}>
            {contest.description}
          </div>
        )}
      </div>

      {status === "SUBMISSIONS" && currentUserId && (
        <div style={{ marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowSubmit(true)}
            style={{
              padding: "10px 18px",
              background: `linear-gradient(135deg, ${ACCENT} 0%, #c4b5fd 100%)`,
              color: "#1e1b3a",
              border: `1px solid ${ACCENT}`,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {contest.mySubmission ? "Edit Submission" : "Submit Your Design"}
          </button>
          {contest.mySubmission && (
            <button
              type="button"
              onClick={() => deleteSubmission(contest.mySubmission!)}
              style={{
                padding: "10px 14px",
                background: "rgba(220,38,38,.12)",
                color: "#fca5a5",
                border: "1px solid rgba(220,38,38,.4)",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Withdraw
            </button>
          )}
        </div>
      )}

      {status === "VOTING" && contest.myVote && (
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            color: "rgba(255,255,255,.7)",
          }}
        >
          <span>You voted. Click another entry to change your vote, or </span>
          <button
            type="button"
            onClick={clearVote}
            style={{
              background: "transparent",
              border: "1px solid rgba(220,38,38,.4)",
              color: "#fca5a5",
              padding: "4px 10px",
              borderRadius: 3,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            cancel vote
          </button>
        </div>
      )}

      {canFinalize && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={finalizeNow}
            style={{
              padding: "10px 16px",
              background: ACCENT,
              color: "#1e1b3a",
              border: `1px solid ${ACCENT}`,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Finalize Contest
          </button>
        </div>
      )}

      {contest.submissions.length === 0 ? (
        <div
          style={{
            padding: 30,
            textAlign: "center",
            color: "rgba(255,255,255,.45)",
            fontSize: 13,
            border: "1px dashed rgba(167,139,250,.25)",
            borderRadius: 6,
          }}
        >
          {status === "SUBMISSIONS"
            ? "No submissions yet. Be the first."
            : "No entries were submitted."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {contest.submissions.map((s) => {
            const isMine = currentUserId && s.userId === currentUserId;
            const isMyVote = contest.myVote?.submissionId === s.id;
            const isWinner = winnerSub?.id === s.id;
            const canVote = status === "VOTING" && !!currentUserId && !isMine;
            const showCount = status !== "SUBMISSIONS";
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (canVote) castVote(s.id);
                  else setLightbox(s);
                }}
                style={{
                  position: "relative",
                  background: "rgba(28,20,48,.6)",
                  border: `2px solid ${isWinner ? "#fbbf24" : isMyVote ? ACCENT : "rgba(167,139,250,.2)"}`,
                  borderRadius: 6,
                  overflow: "hidden",
                  cursor: canVote || true ? "pointer" : "default",
                  transition: "transform .12s, border-color .12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    aspectRatio: "1 / 1",
                    background: "rgba(0,0,0,.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={s.imageUrl}
                    alt={s.caption || "submission"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                {isWinner && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      padding: "3px 10px",
                      background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                      color: "#1a0e04",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      borderRadius: 3,
                    }}
                  >
                    Winner
                  </div>
                )}
                {isMine && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      padding: "3px 8px",
                      background: "rgba(167,139,250,.3)",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      borderRadius: 3,
                    }}
                  >
                    Yours
                  </div>
                )}
                {isMyVote && !isMine && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      padding: "3px 8px",
                      background: "rgba(74,222,128,.3)",
                      color: "#86efac",
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      borderRadius: 3,
                      border: "1px solid rgba(74,222,128,.5)",
                    }}
                  >
                    Your Vote
                  </div>
                )}
                <div style={{ padding: "8px 10px" }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,.85)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.author?.name || "Unknown"}
                  </div>
                  {s.caption && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,.55)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.caption}
                    </div>
                  )}
                  {showCount && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>
                        {s.voteCount ?? 0}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,.5)",
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        votes
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {status === "COMPLETED" && contest.rewardFlair && winnerSub && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            background: "rgba(251,191,36,.08)",
            border: "1px solid rgba(251,191,36,.3)",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              color: "#fbbf24",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Flair Minted
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>
            <strong>{contest.rewardFlair.name}</strong> ({contest.rewardFlair.kind.toLowerCase()},{" "}
            {contest.rewardFlair.rarity.toLowerCase()}) added to{" "}
            {winnerSub.author?.name || "the winner"}'s inventory.
          </div>
        </div>
      )}

      {showSubmit && (
        <SubmitModal
          contestId={contestId}
          existing={contest.mySubmission}
          onClose={() => setShowSubmit(false)}
          onSaved={() => {
            setShowSubmit(false);
            fetchContest();
            onChanged();
          }}
        />
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 220,
            background: "rgba(8,5,16,.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox.imageUrl}
            alt={lightbox.caption || ""}
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              objectFit: "contain",
              borderRadius: 4,
              boxShadow: "0 0 40px rgba(167,139,250,.3)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function BackBar({
  onBack,
  title,
  status,
}: {
  onBack: () => void;
  title?: string;
  status?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <button
        onClick={onBack}
        style={{
          padding: "5px 10px",
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 3,
          color: "rgba(255,255,255,.85)",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        ← Back
      </button>
      {title && (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{title}</div>
          {status && (
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,.55)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 10 }}>
      <div
        style={{
          color: "rgba(196,181,253,.7)",
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ color: "rgba(255,255,255,.85)", fontSize: 11 }}>{value}</div>
    </div>
  );
}

function SubmitModal({
  contestId,
  existing,
  onClose,
  onSaved,
}: {
  contestId: string;
  existing: Submission | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [caption, setCaption] = React.useState(existing?.caption || "");
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(existing?.imageUrl || null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  function onPick(file: File | null) {
    setErr("");
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErr("Image too large (8MB max).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setDataUrl(result);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    if (!dataUrl && !existing) {
      setErr("Pick an image first.");
      return;
    }
    setBusy(true);
    try {
      const body: any = { caption: caption.slice(0, 280) };
      if (dataUrl) body.image = dataUrl;
      if (!dataUrl && existing) {
        setErr("Choose a new image to update.");
        setBusy(false);
        return;
      }
      const r = await fetch(`${API}/flair-contests/${encodeURIComponent(contestId)}/submissions`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setErr(j?.error || "Failed to submit");
        return;
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,5,16,.85)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          padding: 20,
          background: "linear-gradient(180deg, rgba(28,20,48,.97), rgba(14,10,28,.99))",
          border: "2px solid rgba(167,139,250,.5)",
          borderRadius: 6,
          color: "rgba(255,255,255,.92)",
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: ACCENT,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {existing ? "Edit Submission" : "Submit Design"}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 3,
              color: "rgba(255,255,255,.7)",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1.4,
              color: "rgba(196,181,253,.7)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Image
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => onPick(e.target.files?.[0] || null)}
            style={{ display: "block", width: "100%", color: "rgba(255,255,255,.7)", fontSize: 12 }}
          />
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.45)", marginTop: 4 }}>
            PNG, JPEG, WebP, or GIF. Up to 8MB. Resized + converted to WebP server-side.
          </div>
        </div>

        {previewUrl && (
          <div
            style={{ marginBottom: 12, padding: 8, background: "rgba(0,0,0,.4)", borderRadius: 4 }}
          >
            <img
              src={previewUrl}
              alt="preview"
              style={{
                maxWidth: "100%",
                maxHeight: 280,
                display: "block",
                margin: "0 auto",
                objectFit: "contain",
                borderRadius: 3,
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1.4,
              color: "rgba(196,181,253,.7)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Caption (optional)
          </div>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 280))}
            placeholder="A short note about your design"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "rgba(10,8,16,.6)",
              border: "1px solid rgba(167,139,250,.3)",
              color: "rgba(255,255,255,.95)",
              borderRadius: 3,
              fontSize: 12,
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {err && (
          <div
            style={{
              marginTop: 10,
              padding: 8,
              background: "rgba(185,28,28,.18)",
              border: "1px solid rgba(239,68,68,.4)",
              color: "#fca5a5",
              fontSize: 11,
              borderRadius: 3,
            }}
          >
            {err}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || (!dataUrl && !existing)}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "12px",
            background:
              !busy && (dataUrl || existing)
                ? `linear-gradient(135deg, ${ACCENT} 0%, #c4b5fd 100%)`
                : "rgba(255,255,255,.06)",
            color: !busy && (dataUrl || existing) ? "#1e1b3a" : "rgba(255,255,255,.4)",
            border: `1px solid ${!busy && (dataUrl || existing) ? ACCENT : "rgba(255,255,255,.1)"}`,
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: !busy && (dataUrl || existing) ? "pointer" : "default",
            fontFamily: "inherit",
          }}
        >
          {busy ? "Uploading..." : existing ? "Update Submission" : "Submit Design"}
        </button>
      </div>
    </div>
  );
}
