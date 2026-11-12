import type { Metadata } from "next";
import { KnowledgeView } from "@/components/KnowledgeView";

export const metadata: Metadata = { title: "Knowledge · Fundamentals" };

export default function KnowledgePage() {
  return <KnowledgeView />;
}
