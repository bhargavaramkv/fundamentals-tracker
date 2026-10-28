import { Dashboard } from "@/components/Dashboard";
import { getAllQuestions, getAllTopics } from "@/lib/content";

export default function Home() {
  return <Dashboard questions={getAllQuestions()} topics={getAllTopics()} />;
}
