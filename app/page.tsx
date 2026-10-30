import { Dashboard } from "@/components/Dashboard";
import { getAllQuestions, getAllTopics } from "@/lib/content";
import { getRadarStories, toListItem } from "@/lib/radar/load";

export default function Home() {
  // The three strongest non-minor Radar stories from the past week of discovery.
  const stories = getRadarStories();
  const newest = stories.reduce((m, s) => Math.max(m, Date.parse(s.firstSeenAt)), 0);
  const radar = stories
    .filter((s) => !s.minor && Date.parse(s.firstSeenAt) >= newest - 7 * 86_400_000)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 3)
    .map(toListItem);
  return <Dashboard questions={getAllQuestions()} topics={getAllTopics()} radar={radar} />;
}
