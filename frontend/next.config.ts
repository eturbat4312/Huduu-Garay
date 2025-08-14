import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["localhost", "127.0.0.1"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8010",
        pathname: "/media/**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true, // ✅ Build дээр eslint алдаа үл тооно
  },
  async redirects() {
    return [
      {
        source: "/",              // үндсэн хаяг
        destination: "/listings", // шилжүүлэх хуудас
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
