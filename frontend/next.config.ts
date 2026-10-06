// next.config.ts
import type { NextConfig } from "next";
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    domains: ["localhost", "127.0.0.1", "tanaid-honoy.mn", "www.tanaid-honoy.mn"],
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8010", pathname: "/media/**" },
      { protocol: "http", hostname: "localhost", port: "8011", pathname: "/media/**" },
      { protocol: "https", hostname: "tanaid-honoy.mn", pathname: "/media/**" },
      { protocol: "https", hostname: "www.tanaid-honoy.mn", pathname: "/media/**" },
    ],
    unoptimized: isDev, // dev-д тайван байлгахад тус болдог
  },

  async redirects() {
    return [{ source: "/", destination: "/mn", permanent: false }];
  },

  async headers() {
    const privateRoutes = [
      "/:locale(mn)/bookings/:path*",
      "/:locale(mn)/profile/:path*",
      "/:locale(mn)/favorites/:path*",
      "/:locale(mn)/notifications/:path*",
      "/:locale(mn)/my-listings/:path*",
      "/:locale(mn)/host-bookings/:path*",
      "/:locale(mn)/checkout/:path*",
      "/:locale(mn)/payment/:path*",
      "/:locale(mn)/booking-success/:path*",
      "/:locale(mn)/support/:path*",
      "/:locale(mn)/edit-listing/:path*",
      "/:locale(mn)/listings/new/:path*",
      "/:locale(mn)/become-host/:path*",
    ];
    return privateRoutes.map((source) => ({
      source,
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ],
    }));
  },

  async rewrites() {
    if (!isDev) return []; // ← PROD-д НӨЛӨӨЛӨХГҮЙ
    return [
      // DEV backend рүү дамжуулна
      { source: "/api/:path*",   destination: "http://backend:8010/api/:path*" },
      { source: "/media/:path*", destination: "http://backend:8010/media/:path*" },
      { source: "/static/:path*", destination: "http://backend:8010/static/:path*" },

      // Хэрвээ зарим зураг DB-д "filename.jpg" шиг үндсэн root-т хадгалагдсан бол:
      // root-ын зураг файлуудыг /media руу чиглүүлж өгнө
      { source: "/:file(.*\\.(?:png|jpe?g|webp|gif|avif))", destination: "http://backend:8010/media/:file" },
    ];
  },
};

export default nextConfig;
