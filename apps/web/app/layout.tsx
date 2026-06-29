import "./globals.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import React from "react";
import {
  Pirata_One,
  Cormorant_Garamond,
  Rajdhani,
  Barlow_Condensed,
  Saira_Stencil_One,
} from "next/font/google";

const pirataOne = Pirata_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pirata",
  display: "swap",
  preload: true,
});
const cormorant = Cormorant_Garamond({
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
  preload: true,
});
const rajdhani = Rajdhani({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
  preload: true,
});
const barlow = Barlow_Condensed({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
  preload: true,
});
const sairaStencil = Saira_Stencil_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-saira-stencil",
  display: "swap",
  preload: true,
});
import RootFrame from "../components/RootFrame";

export const metadata = {
  title: {
    default: "Weered: Real-Time Community Platform",
    template: "%s | Weered",
  },
  description:
    "Weered is a real-time community platform. Lobbies, rooms, presence, and modules, built for gaming communities and beyond.",
  metadataBase: new URL("https://weered.ca"),
  icons: {
    icon: [{ url: "/brand/logo/weered-logo-32.png", sizes: "32x32", type: "image/png" }],
    apple: "/brand/logo/weered-logo-128.png",
    shortcut: "/brand/logo/weered-logo-32.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Weered: Real-Time Community Platform",
    description:
      "Lobbies, rooms, presence, and modules. A community platform that feels like a place, not a product.",
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
    description: "Lobbies, rooms, presence, and modules. Built for gaming communities.",
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
  var v2 = localStorage.getItem('weered_theme_v2');
  var sraw = localStorage.getItem('weered:settings:v0');
  var s = sraw ? JSON.parse(sraw) : null;
  var valid = ['slate','zinc','stone','gray','ishimura','broadcast','press'];
  var theme = (v2 && valid.indexOf(v2) >= 0) ? v2
            : (s && s.theme && valid.indexOf(s.theme) >= 0) ? s.theme
            : 'press';
  d.setAttribute('data-weered-theme', theme);
  if (s && s.density) d.setAttribute('data-weered-density', s.density);
  if (s && s.reduceMotion) d.setAttribute('data-weered-reduce-motion', '1');
  // SEO slab gate: hide the server-rendered lobby slab for authenticated users
  // before paint (no FOUC). The slab stays in the DOM for crawlers.
  if (localStorage.getItem('weered_user')) d.setAttribute('data-weered-authed', '1');
  // Streamer overlay route: strip chrome + transparent body before paint
  // so OBS browser-source captures a clean composite over the game capture.
  if (location.pathname.indexOf('/overlay/') === 0 || location.pathname === '/overlay') {
    d.setAttribute('data-weered-bare', 'overlay');
  }
  // chrome=min default baseline (pre-paint, FOUC-safe). ShellGate / lobby
  // page reconcile per-route after hydration. Skip /lobby/* (lobby page owns
  // the dense-vs-min decision after moduleType loads), /overlay, and the
  // ?chrome=full override. Inert on bare pages (no shell DOM to style).
  if (location.pathname.indexOf('/lobby/') !== 0
      && location.pathname.indexOf('/overlay') !== 0
      && location.search.indexOf('chrome=full') < 0) {
    d.setAttribute('data-weered-chrome', 'min');
  }
  // Lobbies: flagship purple (min) is the default for ALL lobbies, the 4
  // reskinnable ones (windrose/destiny2/dnd/helldivers2) INCLUDED. The reskin
  // is opt-in (settings.keepDefaultThemeInLobbies === false) + member-only and
  // is resolved by the lobby page AFTER hydration. Previously these 4 were left
  // UNSET here to dodge a min->reskin flash, but that left them painting the
  // base/gold theme for the entire lobbyInfo API-load window (the lobby page's
  // chrome effect bails until lobbyInfo loads), which is the base->theme flash
  // James kept hitting on hard load. So pre-paint min for EVERY lobby. The
  // common/default case is now flash-free; an opted-in member gets a single
  // clean min->reskin transition once membership resolves (was two before).
  else if (location.pathname.indexOf('/lobby/') === 0
      && location.search.indexOf('chrome=full') < 0) {
    d.setAttribute('data-weered-chrome', 'min');
  }
} catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${pirataOne.variable} ${cormorant.variable} ${rajdhani.variable} ${barlow.variable} ${sairaStencil.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('weered_token')){localStorage.removeItem('weered_token');}}catch(e){}if(typeof window==='undefined'||window.__wfp)return;window.__wfp=1;var _f=window.fetch;window.fetch=function(i,o){o=o||{};var u=typeof i==='string'?i:(i&&i.url)||'';if(u.indexOf('api.weered.ca')!==-1){o.credentials='include';try{var h=new Headers(o.headers||{});h.delete('authorization');h.set('x-client','web');o.headers=h;}catch(e){}}return _f.call(this,i,o);};})();`,
          }}
        />
      </head>
      <body>
        <RootFrame>{children}</RootFrame>
      </body>
    </html>
  );
}
