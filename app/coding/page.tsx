import type { Metadata } from "next";
import { Suspense } from "react";
import { CodingTracker } from "@/components/CodingTracker";

export const metadata: Metadata = { title: "Coding · Fundamentals" };

export default function CodingPage() {
  return (
    <Suspense fallback={<p className="text-ink-2">Loading…</p>}>
      <CodingTracker />
    </Suspense>
  );
}
