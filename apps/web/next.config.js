/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1','localhost'],
  async headers() {
    return [{
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    }];
  },
};

module.exports = nextConfig;