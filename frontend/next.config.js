/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    // Proxy backend routes through the frontend so everything is served
    // from a single domain (e.g. yt.tnvstore.com). The `backend` hostname
    // resolves via the Docker Compose network.
    const backend = process.env.BACKEND_INTERNAL_URL || "http://backend:8000";
    return [
      { source: "/api/:path*",   destination: `${backend}/api/:path*` },
      { source: "/docs",         destination: `${backend}/docs` },
      { source: "/redoc",        destination: `${backend}/redoc` },
      { source: "/openapi.json", destination: `${backend}/openapi.json` },
      { source: "/health",       destination: `${backend}/health` },
    ];
  },
};

module.exports = nextConfig;
