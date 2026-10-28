import { Dashboard } from "@/components/Dashboard";
import { getAllNews, getAllQuestions, getAllTopics } from "@/lib/content";

export default function Home() {
  // Headlines only; the full story HTML stays on the news pages.
  const news = getAllNews().map(({ slug, title, date, updated, severity, summary }) => ({ slug, title, date, updated, severity, summary }));
  return <Dashboard questions={getAllQuestions()} topics={getAllTopics()} news={news} />;
}
