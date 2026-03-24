// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Turbopack config (Next.js 16 default)
  turbopack: {
    // External modules for Turbopack
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },

  // Webpack config for better-sqlite3 (fallback for webpack builds)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('better-sqlite3')
    }
    return config
  },

  // Server external packages (for App Router)
  serverExternalPackages: ['better-sqlite3'],

  // Headers for SSE
  async headers() {
    return [
      {
        source: '/api/sse',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-transform' },
          { key: 'Connection', value: 'keep-alive' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
    ]
  },
}

export default nextConfig