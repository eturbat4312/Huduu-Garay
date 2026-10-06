// ✅ src/app/[locale]/booking-success/page.tsx

"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import PageSkeleton from "@/components/PageSkeleton";

// Dynamic import ашиглана
const BookingSuccessWrapperPage = dynamic(
  () => import("@/components/BookingSuccessWrapperPage"),
  { ssr: false }
);

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton cards={1} />}>
      <BookingSuccessWrapperPage />
    </Suspense>
  );
}
