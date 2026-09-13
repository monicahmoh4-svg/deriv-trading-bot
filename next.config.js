/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  webpack: (config) => {
    config.externals = [...(config.externals || []), { ws: 'ws' }];
    return config;
  },
};

module.exports = nextConfig;
