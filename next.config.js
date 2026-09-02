/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  ignoreBuildErrors: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, path: false, os: false, crypto: false,
      };
    }
    // Stub Node.js built-ins for edge runtime
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false, path: false, os: false, crypto: false,
      child_process: false, worker_threads: false, net: false, tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
