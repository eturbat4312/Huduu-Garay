// src/app/[locale]/social/callback/page.tsx
"use client";

import { Suspense } from "react";
// import SocialCallbackContent from "@/components/SocialCallbackContent";
import SocialCallbackContent from "@/components/SocialCallbackContent";

export default function SocialCallbackPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <SocialCallbackContent />
    </Suspense>
  );
}
