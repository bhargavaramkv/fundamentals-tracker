import type { Metadata } from "next";
import { MentorPage } from "@/components/mentor/MentorPage";
import { getResources } from "@/lib/content";

export const metadata: Metadata = { title: "Mentor · Fundamentals" };

export default function MentorRoute() {
  return <MentorPage resources={getResources()} />;
}
