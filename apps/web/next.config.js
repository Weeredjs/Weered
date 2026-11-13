/** @type {import("next").NextConfig} */
const SENTRY_RELEASE = (() => {
  try {
    return require("child_process").execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return process.env.NEXT_PUBLIC_SENTRY_RELEASE || "dev";
  }
})();

const nextConfig = {
  // No X-Powered-By: Next.js header (review 2026-10-06).
  poweredByHeader: false,
  // The workspace is this repository, said outright. On the server Next
  // guessed /opt, the folder above it (a stray /opt/package-lock.json), and
  // warned about it on every start: 43 times in a week's error log.
  outputFileTracingRoot: require("path").join(__dirname, "../.."),
  // A deploy builds beside the live site (NEXT_DIST_DIR=.next-staged) and
  // swaps it in when done (scripts/deploy.sh); everything else uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: { NEXT_PUBLIC_SENTRY_RELEASE: SENTRY_RELEASE },
  // Lint runs in CI (root eslint flat config); the build is the type-gate only.
  eslint: { ignoreDuringBuilds: true },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 1 week
    // The hosts the resizer will fetch from, and no others (image-hosts.json,
    // shared with lib/sizedImage.ts so a page never asks for one it refuses).
    // It used to end with "**": any https address on the internet. That made
    // weered.ca an open image proxy, free to anyone, each new address costing
    // this server a download and a resize; scanners were already aiming it at
    // internal addresses (refused, 2026-11-12). A picture from anywhere else
    // still shows: the visitor's browser loads it directly.
    remotePatterns: require("./image-hosts.json").map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Security headers on all routes
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
          // HSTS: 1yr + subdomains. 'preload' intentionally omitted — it's a
          // hard-to-reverse commitment; flip it on deliberately later.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // CSP shipped Report-Only first: observe field violations before
          // enforcing so a missed source can't break the app. Promote the key
          // to 'Content-Security-Policy' once the report stream is clean.
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com https://embed.twitch.tv https://player.twitch.tv https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self' blob: https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/brand/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

module.exports = nextConfig;
