// ✅ src/app/[locale]/booking-success/page.tsx

"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamic import ашиглана
const BookingSuccessWrapperPage = dynamic(
  () => import("@/components/BookingSuccessWrapperPage"),
  { ssr: false }
);

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BookingSuccessWrapperPage />
    </Suspense>
  );
}
