import type { Metadata } from "next";
import { FunCorner } from "@/components/FunCorner";
import { getAllTopics, getFunFacts, getFunStories } from "@/lib/content";

export const metadata: Metadata = { title: "Fun corner · Fundamentals Tracker" };

export default function FunPage() {
  return <FunCorner stories={getFunStories()} facts={getFunFacts()} topics={getAllTopics()} />;
}
