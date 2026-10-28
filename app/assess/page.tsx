import type { Metadata } from "next";
import { AssessRunner } from "@/components/AssessRunner";
import { getAllQuestions } from "@/lib/content";

export const metadata: Metadata = { title: "Assessment · Fundamentals Tracker" };

export default function AssessPage() {
  return <AssessRunner questions={getAllQuestions()} />;
}
