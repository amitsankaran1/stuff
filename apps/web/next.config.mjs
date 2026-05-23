import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import withSerwistInit from '@serwist/next';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
loadEnv({ path: resolve(root, '.env.local') });
loadEnv({ path: resolve(root, '.env') });

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@stuff/shared', '@stuff/notion'],
};

export default withSerwist(nextConfig);
