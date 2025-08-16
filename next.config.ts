import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Don’t fail the production build on ESLint issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // During testing, don’t fail the build on TS type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
