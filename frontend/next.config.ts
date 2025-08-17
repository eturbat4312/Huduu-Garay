// filename: next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["localhost", "127.0.0.1", "tanaid-honoy.mn", "www.tanaid-honoy.mn"],
    remotePatterns: [
      // dev backend media
      { protocol: "http", hostname: "localhost", port: "8010", pathname: "/media/**" },
      // prod media (nginx-аар дамжсан)
      { protocol: "https", hostname: "tanaid-honoy.mn", pathname: "/media/**" },
      { protocol: "https", hostname: "www.tanaid-honoy.mn", pathname: "/media/**" },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  // ❌ Энд redirects() байхгүй. Root-ыг middleware шийднэ.
};

export default nextConfig;
