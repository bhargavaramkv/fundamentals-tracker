import type { Metadata } from "next";
import Link from "next/link";
import { RadarFeed } from "@/components/radar/RadarFeed";
import { getBuildFeed, getListedStories, getRadarMonths, toListItem } from "@/lib/radar/load";
import { SOURCES } from "@/lib/radar/sources";

export const metadata: Metadata = { title: "Tech Radar · Fundamentals" };

// The feed page carries the last 180 days; older stories stay reachable through the monthly archive.
const FEED_DAYS = 180;

export default function RadarPage() {
  const stories = getListedStories();
  const newest = stories.reduce((m, s) => Math.max(m, Date.parse(s.firstSeenAt)), 0);
  const feedFrom = newest - FEED_DAYS * 86_400_000;
  // Everything the build has a page for, so the client can tell built stories from ones only the live feed knows.
  const build = { ...getBuildFeed(), items: stories.filter((s) => Date.parse(s.publishedAt) >= feedFrom).map(toListItem) };
  const months = getRadarMonths();

  return (
    <div className="space-y-8">
      <header className="page-head">
        <p className="eyebrow">Technology news</p>
        <h1>Tech Radar</h1>
        <p>
          What changed in AI, developer tools, programming, cloud, databases, infrastructure and open source, drawn from{" "}
          {SOURCES.length} official blogs, release feeds and publications. Every story links to its original source.
        </p>
        <nav aria-label="Radar sections" className="mt-3 flex flex-wrap gap-x-5 text-sm">
          <Link href="/radar/weekly/" className="tap font-medium text-accent-text hover:underline">
            Weekly roundup
          </Link>
          {months.length > 0 && (
            <Link href={`/radar/archive/${months[0]}/`} className="tap font-medium text-accent-text hover:underline">
              Monthly archive
            </Link>
          )}
        </nav>
      </header>
      <RadarFeed build={build} />
    </div>
  );
}
