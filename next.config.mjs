/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export keeps the existing Netlify (static hosting) deployment working.
  // Remove `output: "export"` if you prefer SSR on Vercel/Netlify Functions.
  output: "export",
  images: {
    // Required for `output: "export"`; we mostly use plain <img> for user content.
    unoptimized: true,
  },
  eslint: {
    // Lint is run separately via `npm run lint`; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
