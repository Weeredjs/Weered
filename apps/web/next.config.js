/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1','localhost'],
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 1 week
    remotePatterns: [
      // YouTube / Google
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      // Reddit
      { protocol: 'https', hostname: 'i.redd.it' },
      { protocol: 'https', hostname: 'preview.redd.it' },
      { protocol: 'https', hostname: 'external-preview.redd.it' },
      { protocol: 'https', hostname: 'styles.redditmedia.com' },
      { protocol: 'https', hostname: 'b.thumbs.redditmedia.com' },
      { protocol: 'https', hostname: 'a.thumbs.redditmedia.com' },
      // Twitch
      { protocol: 'https', hostname: 'static-cdn.jtvnw.net' },
      { protocol: 'https', hostname: 'clips-media-assets2.twitch.tv' },
      // Imgur
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'imgur.com' },
      // Game publishers
      { protocol: 'https', hostname: 'ddragon.leagueoflegends.com' },
      { protocol: 'https', hostname: 'web.poecdn.com' },
      { protocol: 'https', hostname: 'www.pathofexile.com' },
      { protocol: 'https', hostname: 'www.bungie.net' },
      { protocol: 'https', hostname: 'bungie.net' },
      { protocol: 'https', hostname: 'fortnite-api.com' },
      { protocol: 'https', hostname: '**.fortnite-api.com' },
      { protocol: 'https', hostname: 'media.contentapi.ea.com' },
      { protocol: 'https', hostname: 'cdn.akamai.steamstatic.com' },
      { protocol: 'https', hostname: 'cdn.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'shared.fastly.steamstatic.com' },
      { protocol: 'https', hostname: 'steamcdn-a.akamaihd.net' },
      { protocol: 'https', hostname: '**.riotgames.com' },
      { protocol: 'https', hostname: 'trackercdn.com' },
      // Sports APIs
      { protocol: 'https', hostname: 'img.mlbstatic.com' },
      { protocol: 'https', hostname: 'a.espncdn.com' },
      // Avatars / generators
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      // News / misc
      { protocol: 'https', hostname: '**.ctvnews.ca' },
      { protocol: 'https', hostname: '**.cbc.ca' },
      { protocol: 'https', hostname: 'globalnews.ca' },
      { protocol: 'https', hostname: '**.globalnews.ca' },
      // Weered's own domain (safety)
      { protocol: 'https', hostname: 'weered.ca' },
      { protocol: 'https', hostname: '**.weered.ca' },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Security headers on all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/brand/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
