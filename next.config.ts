import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Apple HAE export uploads (ADR-024 D7); actions.ts enforces the same 4 MB cap.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
