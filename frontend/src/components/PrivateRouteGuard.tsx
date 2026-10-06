"use client";

import { ReactNode, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import PageSkeleton from "@/components/PageSkeleton";

const PRIVATE_PATHS = [
  /^\/(?:mn)\/bookings(?:\/|$)/,
  /^\/(?:mn)\/profile(?:\/|$)/,
  /^\/(?:mn)\/favorites(?:\/|$)/,
  /^\/(?:mn)\/notifications(?:\/|$)/,
  /^\/(?:mn)\/my-listings(?:\/|$)/,
  /^\/(?:mn)\/host-bookings(?:\/|$)/,
  /^\/(?:mn)\/listings\/new(?:\/|$)/,
  /^\/(?:mn)\/edit-listing(?:\/|$)/,
  /^\/(?:mn)\/become-host(?:\/|$)/,
  /^\/(?:mn)\/(?:checkout|payment|booking-success|support)(?:\/|$)/,
];

export default function PrivateRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const { user, loading } = useAuth();
  const isPrivate = PRIVATE_PATHS.some((pattern) => pattern.test(pathname));

  useEffect(() => {
    if (isPrivate && !loading && !user) {
      router.replace(`/${locale || "mn"}/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isPrivate, loading, locale, pathname, router, user]);

  if (isPrivate && (loading || !user)) return <PageSkeleton cards={3} />;
  return children;
}
