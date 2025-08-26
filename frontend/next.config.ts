// next.config.ts
import type { NextConfig } from "next";
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["localhost", "127.0.0.1", "tanaid-honoy.mn", "www.tanaid-honoy.mn"],
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8010", pathname: "/media/**" },
      { protocol: "https", hostname: "tanaid-honoy.mn", pathname: "/media/**" },
      { protocol: "https", hostname: "www.tanaid-honoy.mn", pathname: "/media/**" },
    ],
    unoptimized: isDev, // dev-д тайван байлгахад тус болдог
  },

  async redirects() {
    return [{ source: "/", destination: "/mn", permanent: false }];
  },

  async rewrites() {
    if (!isDev) return []; // ← PROD-д НӨЛӨӨЛӨХГҮЙ
    return [
      // DEV backend рүү дамжуулна
      { source: "/api/:path*",   destination: "http://localhost:8010/api/:path*" },
      { source: "/media/:path*", destination: "http://localhost:8010/media/:path*" },
      { source: "/static/:path*", destination: "http://localhost:8010/static/:path*" },

      // Хэрвээ зарим зураг DB-д "filename.jpg" шиг үндсэн root-т хадгалагдсан бол:
      // root-ын зураг файлуудыг /media руу чиглүүлж өгнө
      { source: "/:file(.*\\.(?:png|jpe?g|webp|gif|avif))", destination: "http://localhost:8010/media/:file" },
    ];
  },
};

export default nextConfig;
