import { Dashboard } from "@/components/Dashboard";
import { Home } from "@/components/mentor/Home";
import { getAllQuestions, getAllTopics, getWorkspaces } from "@/lib/content";
import { getBuildFeed } from "@/lib/radar/load";

export default function HomeRoute() {
  const feed = getBuildFeed();
  // A small slice of the feed: the dashboard shows three stories, and the live feed tops this up.
  const radar = { ...feed, items: feed.items.filter((i) => !i.minor).slice(0, 60) };
  return (
    <Home
      fallback={<Dashboard ctx={{ questions: getAllQuestions(), topics: getAllTopics(), workspaces: getWorkspaces() }} radar={radar} />}
    />
  );
}
