/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: `next build` emits ./out, which the FastAPI backend
  // serves directly. No Node server, no rewrites — the UI and the API live
  // on the same origin, so the browser just calls /api/* relatively.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
