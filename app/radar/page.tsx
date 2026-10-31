import type { Metadata } from "next";
import Link from "next/link";
import { RadarFeed, type SourceProblem } from "@/components/radar/RadarFeed";
import { getRadarMonths, getRadarState, getRadarStories, toListItem } from "@/lib/radar/load";
import { SOURCES } from "@/lib/radar/sources";

export const metadata: Metadata = { title: "Tech Radar · Fundamentals Tracker" };

// The feed page carries the last 180 days; older stories stay reachable through the monthly archive.
const FEED_DAYS = 180;

export default function RadarPage() {
  const stories = getRadarStories();
  const state = getRadarState();
  const newest = stories.reduce((m, s) => Math.max(m, Date.parse(s.firstSeenAt)), 0);
  const feedFrom = newest - FEED_DAYS * 86_400_000;
  const items = stories.filter((s) => Date.parse(s.publishedAt) >= feedFrom).map(toListItem);

  // Briefing: the strongest non-minor stories found by the most recent successful run.
  const lastRun = state.lastSuccessAt ? Date.parse(state.lastSuccessAt) : 0;
  const briefing = stories
    .filter((s) => !s.minor && Date.parse(s.firstSeenAt) >= lastRun - 26 * 3_600_000)
    .sort((a, b) => Number(Boolean(b.analysis)) - Number(Boolean(a.analysis)) || b.score.total - a.score.total)
    .slice(0, 5)
    .map((s) => s.id);

  const problems: SourceProblem[] = SOURCES.flatMap((s) => {
    const h = state.sources[s.id];
    return h && h.consecutiveFailures > 0 ? [{ name: s.name, error: h.lastError ?? "unknown error", failures: h.consecutiveFailures }] : [];
  });

  return (
    <div className="space-y-10">
      <div className="hero-grid pt-2 sm:pt-6">
        <p className="eyebrow">Tech Radar</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem]">What&apos;s moving in tech, and why it works</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Discovered daily from {SOURCES.length} official blogs, release feeds, advisories, research feeds and publications.
          Each important story is explained through the engineering fundamentals behind it. Analysis is AI-generated and
          labelled; facts link back to their sources.
        </p>
        <nav aria-label="Radar sections" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/radar/weekly/" className="tap font-medium text-accent-text hover:underline">
            Weekly roundup →
          </Link>
          {getRadarMonths().length > 0 && (
            <Link href={`/radar/archive/${getRadarMonths()[0]}/`} className="tap font-medium text-accent-text hover:underline">
              Monthly archive →
            </Link>
          )}
        </nav>
      </div>
      <RadarFeed
        items={items}
        briefing={briefing}
        briefingDate={state.lastSuccessAt}
        lastSuccessAt={state.lastSuccessAt}
        lastRunAt={state.lastRunAt}
        problems={problems}
        sourceCount={SOURCES.length}
        healthyCount={SOURCES.filter((s) => state.sources[s.id]?.consecutiveFailures === 0).length}
      />
    </div>
  );
}
