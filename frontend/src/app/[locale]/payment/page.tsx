// filename: src/app/[locale]/payment/page.tsx
import { Suspense } from "react";
import PaymentContent from "@/components/PaymentContent";

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
