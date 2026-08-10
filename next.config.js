/** @type {import('next').NextConfig} */
const protectedApiNoStoreHeaders = [
  {
    key: 'Cache-Control',
    value: 'no-store, max-age=0',
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/admin/:path*',
        headers: protectedApiNoStoreHeaders,
      },
      {
        source: '/api/staff/:path*',
        headers: protectedApiNoStoreHeaders,
      },
    ];
  },

  webpack: (config, { isServer }) => {
    config.module.exprContextCritical = false;
    return config;
  },
};

module.exports = nextConfig;
