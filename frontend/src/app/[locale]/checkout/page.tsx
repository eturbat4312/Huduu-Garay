// filename: src/app/[locale]/checkout/page.tsx
import { Suspense } from "react";
import CheckoutContent from "@/components/CheckoutContent";
import PageSkeleton from "@/components/PageSkeleton";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={1} />}>
      <CheckoutContent />
    </Suspense>
  );
}
