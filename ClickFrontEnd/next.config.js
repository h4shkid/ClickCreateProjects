/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Prevent API routes from being statically generated during build
  // This avoids database access during the build phase
  experimental: {
    // Disable static optimization for API routes
  },

  images: {
    domains: [
      'i.seadn.io',
      'i2.seadn.io',
      'i3.seadn.io',
      'openseauserdata.com',
      'opensea.io',
      'storage.googleapis.com',
      'lh3.googleusercontent.com',
      'ipfs.io',
      'gateway.pinata.cloud'
    ],
  },

  webpack: (config, { isServer }) => {
    // Suppress warnings for optional dependencies
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    // Ignore specific modules that cause warnings
    config.externals = config.externals || []
    if (isServer) {
      config.externals.push('pino-pretty')
      // Prevent better-sqlite3 from being bundled during build
      // Use PostgreSQL in production via POSTGRES_URL
      config.externals.push('better-sqlite3')
    }

    return config
  },
}

module.exports = nextConfig