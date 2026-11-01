import type { Metadata } from "next";
import { LearningPath } from "@/components/LearningPath";
import { getAllQuestions, getAllTopics, getWorkspaces } from "@/lib/content";

export const metadata: Metadata = { title: "Learning Path · Fundamentals" };

export default function LearnPage() {
  return <LearningPath ctx={{ questions: getAllQuestions(), topics: getAllTopics(), workspaces: getWorkspaces() }} />;
}
