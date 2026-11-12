import type { Metadata } from "next";
import { Suspense } from "react";
import { JournalView } from "@/components/JournalView";

export const metadata: Metadata = { title: "Journal · Fundamentals" };

export default function JournalPage() {
  return (
    <Suspense fallback={<p className="text-ink-2">Loading…</p>}>
      <JournalView />
    </Suspense>
  );
}
