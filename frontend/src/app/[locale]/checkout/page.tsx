// filename: src/app/[locale]/checkout/page.tsx
import { Suspense } from "react";
import CheckoutContent from "@/components/CheckoutContent";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
