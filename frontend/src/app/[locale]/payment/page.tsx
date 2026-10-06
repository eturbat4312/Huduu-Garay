// filename: src/app/[locale]/payment/page.tsx
import { Suspense } from "react";
import PaymentContent from "@/components/PaymentContent";
import PageSkeleton from "@/components/PageSkeleton";

export default function PaymentPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={1} />}>
      <PaymentContent />
    </Suspense>
  );
}
