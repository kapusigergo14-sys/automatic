/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard is for local-only use — never deployed.
  // Disable image optimization since we're loading data URIs / nothing remote.
  images: { unoptimized: true },
};

export default nextConfig;
