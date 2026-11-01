import { Today } from "@/components/Today";
import { getAllQuestions, getAllTopics, getWorkspaces } from "@/lib/content";
import { getBuildFeed } from "@/lib/radar/load";

export default function TodayRoute() {
  const feed = getBuildFeed();
  // A small slice of the feed: Today shows three stories, and the live feed tops this up.
  const radar = { ...feed, items: feed.items.filter((i) => !i.minor).slice(0, 60) };
  return <Today ctx={{ questions: getAllQuestions(), topics: getAllTopics(), workspaces: getWorkspaces() }} radar={radar} />;
}
