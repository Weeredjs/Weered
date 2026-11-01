"use client";

// Sign in and create an account. Redone 2026-10-31 to match the landing page
// (styles: app/styles/55-auth.css): the pitch beside the card on wide
// screens, sign-in services first, then a username form password managers
// understand.
import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
/** Set on this device by any sign-in (here, and the socket's auth:ok in
 *  WeeredProvider); sign-out keeps it. Holds the username, or "1". */
const RETURNING_KEY = "weered:returning";

/** Hand a login to the browser's password manager (Chrome, Edge). The form is
 *  sent by fetch, so the browser can't always tell that it worked. */
function rememberLogin(id: string, password: string) {
  try {
    const PC = (window as any).PasswordCredential;
    if (PC && navigator.credentials?.store) {
      void navigator.credentials.store(new PC({ id, password, name: id })).catch(() => {});
    }
  } catch {}
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Full: the account cap is reached (api lib/registration.ts). They can leave
  // an email to hear when there's room instead of meeting a closed door.
  const [full, setFull] = useState(false);
  const [waitEmail, setWaitEmail] = useState("");
  const [waitState, setWaitState] = useState<"" | "busy" | "done" | "error">("");
  const [showPw, setShowPw] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = React.useRef<HTMLDivElement | null>(null);
  const captchaWidgetIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!TURNSTILE_SITE_KEY || mode !== "register") return;
    let cancelled = false;
    const ensureScript = () =>
      new Promise<void>((resolve) => {
        if ((window as any).turnstile) return resolve();
        const existing = document.querySelector('script[data-weered-turnstile="1"]');
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          return;
        }
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        s.dataset.weeredTurnstile = "1";
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    void ensureScript().then(() => {
      if (cancelled || !captchaRef.current || !(window as any).turnstile) return;
      captchaWidgetIdRef.current = (window as any).turnstile.render(captchaRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        appearance: "interaction-only",
        callback: (tok: string) => setCaptchaToken(tok),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    });
    return () => {
      cancelled = true;
      if (captchaWidgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(captchaWidgetIdRef.current);
        } catch {}
        captchaWidgetIdRef.current = null;
      }
      setCaptchaToken("");
    };
  }, [mode]);

  const nextPath = React.useMemo(() => {
    const n = sp?.get("next") || "";
    // A path on this site only: "//elsewhere" is another site (red team finding 22).
    return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/home";
  }, [sp]);

  // A device that has signed in before opens on Sign in, with its name filled,
  // even from "Get in" (James 2026-10-31: "Get In" opened Create account, so
  // the browser never offered his saved logins). Create account is one tab away.
  React.useEffect(() => {
    let returning = "";
    try {
      returning = localStorage.getItem(RETURNING_KEY) || "";
    } catch {}
    if (returning) {
      if (returning !== "1") setUsername((u) => u || returning);
      return;
    }
    if (sp?.get("mode") === "register") setMode("register");
  }, [sp]);

  // Saved logins, where the browser keeps them (Chrome, Edge): offered as soon
  // as the page opens, and picking one signs straight in.
  React.useEffect(() => {
    try {
      if (localStorage.getItem("weered_user")) return;
    } catch {}
    const PC = (window as any).PasswordCredential;
    if (!PC || !navigator.credentials?.get) return;
    let cancelled = false;
    navigator.credentials
      .get({ password: true, mediation: "optional" } as CredentialRequestOptions)
      .then((c: any) => {
        if (cancelled || c?.type !== "password" || !c.id || !c.password) return;
        setMode("login");
        setUsername(c.id);
        setPassword(c.password);
        void submit({ mode: "login", u: c.id, p: c.password });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  React.useEffect(() => {
    try {
      if (localStorage.getItem("weered_user")) router.replace(nextPath);
    } catch {}
  }, [router, nextPath]);

  async function submit(over?: { mode: "login" | "register"; u: string; p: string }) {
    const m = over?.mode ?? mode;
    const u = (over?.u ?? username).trim();
    const p = (over?.p ?? password).trim();
    const e = email.trim();
    setErr("");
    if (!u || !p) return setErr("Username and password required.");
    if (m === "register" && !e) return setErr("Email address required.");
    if (m === "register" && TURNSTILE_SITE_KEY && !captchaToken) {
      return setErr("Please complete the captcha.");
    }
    setBusy(true);
    try {
      const url = m === "register" ? `${API}/auth/register` : `${API}/auth/login`;
      const body: any = { username: u, password: p };
      if (m === "register") body.email = e;
      if (m === "register" && captchaToken) body.captchaToken = captchaToken;
      // credentials: the session is the httpOnly cookie this response sets.
      // Production's fetch wrapper (app/layout.tsx) adds it for api.weered.ca,
      // but a stack on another origin (the CI E2E job) needs it said here, or
      // the browser drops the cookie and every signed-in call is anonymous.
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}) as any);
      if (!r.ok) throw new Error(j?.error || j?.message || `Error ${r.status}`);
      // Web auth is the httpOnly cookie set by the server; no token in body.
      try {
        document.documentElement.setAttribute("data-weered-authed", "1");
      } catch {}
      if (j?.user) localStorage.setItem("weered_user", JSON.stringify(j.user));
      try {
        localStorage.setItem(RETURNING_KEY, String(j?.user?.username || u));
      } catch {}
      rememberLogin(u, p);
      // Verification mail still goes out, but it gates nothing: no dead-end
      // "check your email" screen, straight in.
      router.replace(nextPath);
    } catch (e: any) {
      const code = String(e?.message || "");
      if (code === "registration_full") {
        setFull(true);
        setWaitEmail(email.trim());
        return;
      }
      setErr(
        code === "registration_closed"
          ? "New accounts are closed right now. Try again soon."
          : code || "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function devLogin() {
    if (!username.trim()) return setErr("Enter a username for dev login.");
    setBusy(true);
    try {
      const r = await fetch(`${API}/auth/dev-login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const j = await r.json().catch(() => ({}) as any);
      if (!r.ok) throw new Error(j?.error || `Error ${r.status}`);
      void 0;
      try {
        document.documentElement.setAttribute("data-weered-authed", "1");
      } catch {}
      if (j?.user) localStorage.setItem("weered_user", JSON.stringify(j.user));
      router.replace(nextPath);
    } catch (e: any) {
      setErr(String(e?.message || "Dev login failed."));
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
    window.location.href = `${API}/auth/google`;
  }

  // Sign in with Discord (api routes/discordAuth.ts): the button shows once
  // the server says Discord is switched on.
  const [discordOn, setDiscordOn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/auth/providers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setDiscordOn(!!j?.discord))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  function discordLogin() {
    window.location.href = `${process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca"}/auth/discord`;
  }

  // A failed or refused Google sign-in lands back here with ?error=; it used to
  // show nothing at all.
  const notice = React.useMemo(() => {
    const e = sp?.get("error") || "";
    if (sp?.get("deleted") === "1") return "Your account is deleted. Thanks for being here.";
    if (e === "registration_closed") return "New accounts are closed right now. Try again soon.";
    if (e === "registration_full") return ""; // the full panel says it
    if (e === "account_suspended") return "This account is suspended.";
    if (e === "discord_cancelled") return "Discord sign-in was cancelled.";
    if (e) return "That sign-in didn't finish. Try again.";
    return "";
  }, [sp]);
  const isFull = full || sp?.get("error") === "registration_full";
  async function joinWaitlist(ev: React.FormEvent) {
    ev.preventDefault();
    const addr = waitEmail.trim();
    if (!addr) return;
    setWaitState("busy");
    try {
      const r = await fetch(`${API}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      setWaitState(r.ok ? "done" : "error");
    } catch {
      setWaitState("error");
    }
  }
  const isDev = process.env.NODE_ENV === "development";
  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setErr("");
  };

  return (
    <div className="wa">
      <div className="wa-aura" aria-hidden />
      <div className="wa-grid" aria-hidden />
      <div className="wa-shell">
        {/* ── The pitch, beside the card on wide screens ── */}
        <section className="wa-pitch" aria-label="What Weered is">
          <a href="/" className="wa-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- the brand mark */}
            <img src="/brand/logo/weered-logo-128.png" alt="" />
            Weered
          </a>
          <h1 className="wa-headline">A place for anything.</h1>
          <ul className="wa-points">
            <li>
              <span aria-hidden>✦</span>
              <span>
                <b>Vibe code your own lobby.</b> Say what you want and it builds.
              </span>
            </li>
            <li>
              <span aria-hidden>🏠</span>
              <span>
                <b>A place of your own</b> at yourname.weered.ca.
              </span>
            </li>
            <li>
              <span aria-hidden>🎙</span>
              <span>
                <b>Rooms that are live</b> the moment you walk in: voice, video, watch parties.
              </span>
            </li>
            <li>
              <span aria-hidden>🎮</span>
              <span>
                <b>Your games and your crew,</b> together in one spot.
              </span>
            </li>
          </ul>
          <div className="wa-fine">Free to join. Your own lobby is $6 a month.</div>
        </section>

        {/* ── The card ── */}
        <main className="wa-card">
          <a href="/" className="wa-brand wa-brand-small">
            {/* eslint-disable-next-line @next/next/no-img-element -- the brand mark */}
            <img src="/brand/logo/weered-logo-128.png" alt="" />
            Weered
          </a>
          <h2 className="wa-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="wa-sub">
            {mode === "login"
              ? "Sign in and pick up where you left off."
              : isFull
                ? "We'll tell you when there's room."
                : "Thirty seconds and you're in."}
          </p>

          <div className="wa-tabs" role="group" aria-label="Sign in or create an account">
            <button
              type="button"
              className={`wa-tab${mode === "login" ? " is-on" : ""}`}
              aria-pressed={mode === "login"}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`wa-tab${mode === "register" ? " is-on" : ""}`}
              aria-pressed={mode === "register"}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>

          {notice && (
            <div className="wa-notice" role="status">
              {notice}
            </div>
          )}

          {isFull && (
            <div className="wa-notice" role="status">
              <strong>Weered is full for now.</strong> We&apos;re letting people in as we make room.
              {waitState === "done" ? (
                <div style={{ marginTop: 8 }}>
                  You&apos;re on the list. One email when there&apos;s room, nothing else.
                </div>
              ) : (
                <form onSubmit={joinWaitlist} style={{ marginTop: 10 }}>
                  <input
                    className="wa-input"
                    type="email"
                    required
                    value={waitEmail}
                    onChange={(ev) => setWaitEmail(ev.target.value)}
                    placeholder="you@example.com"
                    aria-label="Your email, to hear when there's room"
                  />
                  <button
                    type="submit"
                    className="wl-btn wa-go"
                    style={{ marginTop: 10, fontSize: 15, padding: 11 }}
                    disabled={waitState === "busy"}
                  >
                    {waitState === "busy" ? "One sec…" : "Tell me when there's room"}
                  </button>
                </form>
              )}
              {waitState === "error" && (
                <div style={{ marginTop: 6 }}>
                  That didn&apos;t go through. Check the address and try again.
                </div>
              )}
            </div>
          )}

          {/* Sign-in services. A new one (Discord, Twitch, Steam) is one more button here. */}
          <div className="wa-providers">
            <button type="button" className="wa-provider" onClick={googleLogin} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
            {discordOn && (
              <button type="button" className="wa-provider" onClick={discordLogin} disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#5865F2"
                    d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.89 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01c.12.1.24.2.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z"
                  />
                </svg>
                Continue with Discord
              </button>
            )}
          </div>

          {!(isFull && mode === "register") && (
            <>
              <div className="wa-or">
                <span>
                  {mode === "login" ? "or sign in with your username" : "or make a username"}
                </span>
              </div>

              {/* A real form, so password managers know this is a login: they
              offer saved accounts on Sign in and offer to save on success. */}
              <form
                method="post"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <label className="wa-label" htmlFor="wl-username">
                  Username
                </label>
                <input
                  id="wl-username"
                  name="username"
                  className="wa-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_handle"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                />

                {mode === "register" && (
                  <>
                    <label className="wa-label" htmlFor="wl-email">
                      Email
                    </label>
                    <input
                      id="wl-email"
                      name="email"
                      className="wa-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </>
                )}

                <div className="wa-label-row">
                  <label className="wa-label" htmlFor="wl-password">
                    Password
                  </label>
                  {mode === "login" && (
                    <a href="/forgot-password" className="wa-forgot">
                      Forgot it?
                    </a>
                  )}
                </div>
                <div className="wa-pw">
                  <input
                    id="wl-password"
                    name="password"
                    className="wa-input"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="wa-eye"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    aria-pressed={showPw}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>

                {/* Cloudflare's check: it shows only when it needs a click. */}
                {mode === "register" && TURNSTILE_SITE_KEY && (
                  <div ref={captchaRef} className="wa-captcha" />
                )}

                {err && (
                  <div className="wa-error" role="alert">
                    {err}
                  </div>
                )}

                <button type="submit" className="wl-btn wa-go" disabled={busy}>
                  {busy ? "One sec…" : mode === "login" ? "Sign in" : "Create account"}
                </button>

                {mode === "register" && (
                  <p className="wa-legal">
                    By creating an account you agree to the <a href="/terms">Terms</a> and{" "}
                    <a href="/privacy">Privacy Policy</a>.
                  </p>
                )}
              </form>
            </>
          )}

          <div className="wa-switch">
            {mode === "login" ? "New here?" : "Have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
            {isDev && (
              <button type="button" className="wa-dev" onClick={devLogin} disabled={busy}>
                dev login
              </button>
            )}
          </div>

          <nav className="wa-links" aria-label="More">
            <a href="/about">About</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact">Contact</a>
          </nav>
        </main>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080810" }} />}>
      <LoginForm />
    </Suspense>
  );
}
