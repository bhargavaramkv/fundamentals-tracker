import type { Metadata } from "next";
import { MentorView } from "@/components/mentor/MentorView";

export const metadata: Metadata = { title: "Mentor · Fundamentals" };

export default function MentorPage() {
  return <MentorView />;
}
