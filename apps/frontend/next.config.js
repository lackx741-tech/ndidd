/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ndidd/sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: '*.ipfs.nftstorage.link' },
      { protocol: 'https', hostname: 'arweave.net' },
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
};

module.exports = nextConfig;
