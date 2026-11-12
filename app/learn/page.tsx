import type { Metadata } from "next";
import { LearnHome } from "@/components/LearnHome";
import { getAllTopics, getCurriculum, getWorkspaceSummaries } from "@/lib/content";

export const metadata: Metadata = { title: "Learn · Fundamentals" };

export default function LearnPage() {
  return <LearnHome curriculum={getCurriculum()} topics={getAllTopics()} workspaces={getWorkspaceSummaries()} />;
}
