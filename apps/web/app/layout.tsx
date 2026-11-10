import "./globals.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import React from "react";
import RootFrame from "../components/RootFrame";
import { PRELOADED_FONTS } from "../lib/fonts";
import {
  chromeFor,
  FORCED_THEME_LOBBIES,
  NO_SHELL_ROUTES,
  SKIN_CACHE_KEY,
  THEMEABLE_LOBBY_IDS,
} from "../lib/lobbyThemes";
import {
  NB_CUSTOM_KEY,
  PREFS_KEY,
  SITE_THEME_IDS,
  DEFAULT_LOOK,
  LOOK_EPOCH,
  LOOK_EPOCH_KEY,
  LOOK_FIELDS,
  customPalette,
  nebulaVars,
} from "../lib/uiPrefs";

/** The default colourway's tokens, for the boot script's clean slate. */
const DEFAULT_LOOK_VARS = nebulaVars(customPalette(DEFAULT_LOOK.accent || "#8b5cf6"));

export const metadata = {
  title: {
    default: "Weered: Real-Time Community Platform",
    template: "%s | Weered",
  },
  description:
    "A place for anything. Voice, video, rooms and live integrations for your team, your club or your game, on your own domain if you want it.",
  metadataBase: new URL("https://weered.ca"),
  icons: {
    icon: [{ url: "/brand/logo/weered-logo-32.png", sizes: "32x32", type: "image/png" }],
    // Padded on the dark: iOS fills transparency with black and rounds the
    // corners, which clipped the full-width logo.
    apple: "/brand/logo/weered-apple-touch-180.png?v=2",
    shortcut: "/brand/logo/weered-logo-32.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Weered: Real-Time Community Platform",
    description:
      "A place for anything. Voice, video, rooms and live integrations, on your own domain if you want it.",
    url: "https://weered.ca",
    siteName: "Weered",
    images: [
      {
        url: "https://weered.ca/og",
        width: 1200,
        height: 630,
        alt: "Weered: Real-Time Community Platform",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weered: Real-Time Community Platform",
    description: "A place for anything. Voice, video, rooms and live integrations.",
    images: ["https://weered.ca/og"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Weered",
  },
  alternates: {
    canonical: "https://weered.ca",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  themeColor: "#5800E5",
  width: "device-width",
  initialScale: 1,
};

const themeBootScript = `
try {
  var d = document.documentElement;
  // Clean slate (lib/uiPrefs.ts LOOK_EPOCH): once per epoch every browser goes
  // back to Weered's look. Its own layout and setup state stay.
  if (localStorage.getItem(${JSON.stringify(LOOK_EPOCH_KEY)}) !== ${JSON.stringify(LOOK_EPOCH)}) {
    var cur = null;
    try { cur = JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)}) || 'null'); } catch(e) {}
    var next = ${JSON.stringify(DEFAULT_LOOK)};
    if (cur && typeof cur === 'object') {
      for (var k in cur) if (${JSON.stringify(LOOK_FIELDS)}.indexOf(k) < 0) next[k] = cur[k];
    }
    localStorage.setItem(${JSON.stringify(PREFS_KEY)}, JSON.stringify(next));
    localStorage.setItem(${JSON.stringify(NB_CUSTOM_KEY)}, ${JSON.stringify(JSON.stringify(DEFAULT_LOOK_VARS))});
    localStorage.setItem('weered_theme_v2', 'nebula');
    try {
      var so = JSON.parse(localStorage.getItem('weered:settings:v0') || 'null') || {};
      so.theme = 'nebula';
      localStorage.setItem('weered:settings:v0', JSON.stringify(so));
    } catch(e) {}
    localStorage.setItem(${JSON.stringify(LOOK_EPOCH_KEY)}, ${JSON.stringify(LOOK_EPOCH)});
  }
  var v2 = localStorage.getItem('weered_theme_v2');
  var sraw = localStorage.getItem('weered:settings:v0');
  var s = sraw ? JSON.parse(sraw) : null;
  var keepDefault = !!(s && s.keepDefaultTheme === true);
  var valid = ${JSON.stringify(SITE_THEME_IDS)};
  var theme = (v2 && valid.indexOf(v2) >= 0) ? v2
            : (s && s.theme && valid.indexOf(s.theme) >= 0) ? s.theme
            : 'nebula';
  d.setAttribute('data-weered-theme', theme);
  // Nebula's colourway and starfield (lib/uiPrefs.ts), before first paint.
  var up = null;
  try { up = JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)}) || 'null'); } catch(e) {}
  d.setAttribute('data-weered-palette', (up && up.palette) || 'custom');
  if (!up || up.palette === 'custom') {
    try {
      var cv = JSON.parse(localStorage.getItem(${JSON.stringify(NB_CUSTOM_KEY)}) || 'null');
      if (cv) for (var ck in cv) d.style.setProperty(ck, cv[ck]);
    } catch(e) {}
  }
  if (up && up.font && up.font !== 'default') d.setAttribute('data-weered-font', up.font);
  var shp = (up && up.shape) || 'soft';
  if (shp !== 'round') d.setAttribute('data-weered-shape', shp);
  if (up && up.buttons && up.buttons !== 'tile') d.setAttribute('data-weered-buttons', up.buttons);
  if (up && up.lines === 'hard') d.setAttribute('data-weered-lines', 'hard');
  if (up && up.texture && up.texture !== 'glass') d.setAttribute('data-weered-texture', up.texture);
  if (up && up.backdrop && up.backdrop !== 'sky') d.setAttribute('data-weered-backdrop', up.backdrop);
  if (up && up.stars === false) d.setAttribute('data-weered-stars', 'off');
  if (up && up.skyMotion === true) d.setAttribute('data-weered-sky-motion', 'on');
  if (up && (up.bars === 'solid' || up.bars === 'slant')) d.setAttribute('data-weered-bars', up.bars);
  if (up && /^#[0-9a-f]{6}$/i.test(up.barColor || '')) d.style.setProperty('--nb-bar', up.barColor);
  if (s && s.density) d.setAttribute('data-weered-density', s.density);
  if (s && s.reduceMotion) d.setAttribute('data-weered-reduce-motion', '1');
  // Light effects (lib/displaySettings.ts): as chosen here, else as this device draws.
  if (s && s.lightEffects === true) d.setAttribute('data-weered-light', '1');
  else if (!(s && s.lightEffects === false) && localStorage.getItem('weered:sw-draw') === '1') d.setAttribute('data-weered-light', '1');
  // SEO slab gate: hide the server-rendered lobby slab for authenticated users
  // before paint (no FOUC). The slab stays in the DOM for crawlers.
  if (localStorage.getItem('weered_user')) d.setAttribute('data-weered-authed', '1');
  // A guest (a lobby's guest link) sees the lobby alone: lib/guestSession.ts.
  try { var wu = JSON.parse(localStorage.getItem('weered_user') || 'null'); if (wu && wu.isGuest) d.setAttribute('data-weered-guest', '1'); } catch (e) {}
  // The server's shell says "Guest" until the scripts sign the member in; show
  // this device's saved name instead (lib/bootMark.ts, styles/44-boot.css).
  try {
    var bu = JSON.parse(localStorage.getItem('weered_user') || 'null');
    var bn = bu && bu.id ? String(bu.name || bu.username || '').trim() : '';
    if (bn) {
      d.setAttribute('data-weered-booting', '1');
      d.style.setProperty('--weered-boot-name', JSON.stringify(bn));
      d.style.setProperty('--weered-boot-initial', JSON.stringify(bn.slice(0, 1).toUpperCase()));
      setTimeout(function () { d.removeAttribute('data-weered-booting'); }, 15000);
    }
  } catch (e) {}
  // Streamer overlay route: strip chrome + transparent body before paint
  // so OBS browser-source captures a clean composite over the game capture.
  if (location.pathname.indexOf('/overlay/') === 0 || location.pathname === '/overlay') {
    d.setAttribute('data-weered-bare', 'overlay');
  }
  // Lobby skin + minimal chrome, decided by the SAME function every later
  // writer uses (lib/lobbyThemes chromeFor), so the first paint already
  // matches what the page settles on. The skin cache remembers what this
  // viewer saw last time (a member's skin, which lobby a room belongs to).
  var cache = null;
  try { cache = JSON.parse(localStorage.getItem(${JSON.stringify(SKIN_CACHE_KEY)}) || 'null'); } catch(e) {}
  var chromeFor = ${chromeFor.toString()};
  var dec = chromeFor(location.pathname, location.search, keepDefault, cache,
    ${JSON.stringify(THEMEABLE_LOBBY_IDS)}, ${JSON.stringify(FORCED_THEME_LOBBIES)}, ${JSON.stringify(NO_SHELL_ROUTES)});
  if (dec[0]) d.setAttribute('data-weered-lobby', dec[0]);
  if (dec[1]) d.setAttribute('data-weered-chrome', 'min');
} catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Our own fonts (app/styles/01-fonts.css), fetched before the CSS asks. */}
        {PRELOADED_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('weered_token')){localStorage.removeItem('weered_token');}}catch(e){}if(typeof window==='undefined'||window.__wfp)return;window.__wfp=1;try{if(/^(office|meet)\\.eastcoastemployeebenefits\\.com$/.test(location.hostname)){var _de=document.documentElement;_de.setAttribute('data-pro-host','1');_de.setAttribute('data-weered-theme','press');try{localStorage.setItem('weered_theme_v2','press');}catch(e2){}_de.style.background='#1a1a1c';}}catch(e){}var _wl=/^(www\\.)?weered\\.ca$/.test(location.hostname)||location.hostname==='localhost'||location.hostname==='127.0.0.1';var _f=window.fetch;window.fetch=function(i,o){o=o||{};var u=typeof i==='string'?i:(i&&i.url)||'';if(u.indexOf('api.weered.ca')!==-1){if(!_wl){var p=u.replace(/^https?:\\/\\/api\\.weered\\.ca/,'/api');if(typeof i==='string'){i=p;}else{try{i=new Request(p,i);}catch(e){}}}o.credentials='include';try{var h=new Headers(o.headers||{});h.delete('authorization');h.set('x-client','web');o.headers=h;}catch(e){}}return _f.call(this,i,o);};})();`,
          }}
        />
      </head>
      <body>
        <RootFrame>{children}</RootFrame>
      </body>
    </html>
  );
}
