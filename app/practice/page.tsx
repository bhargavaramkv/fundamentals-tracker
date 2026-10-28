import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { getAllQuestions, getAllTopics } from "@/lib/content";

export const metadata: Metadata = { title: "Training · BHARGAVA.DEV" };

export default function PracticePage() {
  return (
    <Suspense fallback={<p className="text-ink-2">Loading…</p>}>
      <PracticeRunner questions={getAllQuestions()} topics={getAllTopics()} />
    </Suspense>
  );
}
