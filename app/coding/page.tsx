import type { Metadata } from "next";
import { Suspense } from "react";
import { CodingInsights } from "@/components/coding/CodingInsights";

export const metadata: Metadata = { title: "Coding · Fundamentals" };

export default function CodingPage() {
  return (
    <Suspense fallback={<p className="text-ink-2">Loading…</p>}>
      <CodingInsights />
    </Suspense>
  );
}
