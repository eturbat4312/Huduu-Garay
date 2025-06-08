// 📄 components/ui/avatar.tsx
"use client";

import * as React from "react";

export function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300 bg-gray-100 flex items-center justify-center">
      {children}
    </div>
  );
}

export function AvatarImage({ src, alt }: { src: string; alt?: string }) {
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
}

export function AvatarFallback({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm text-gray-700 font-semibold">{children}</span>
  );
}
