/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@stuff/shared', '@stuff/notion'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
