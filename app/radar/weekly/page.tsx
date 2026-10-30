import type { Metadata } from "next";
import Link from "next/link";
import { CategoryTag, formatDay, ImportanceTag } from "@/components/radar/ui";
import { getRadarStories, weekStart } from "@/lib/radar/load";
import { RADAR_CATEGORIES, type RadarStory } from "@/lib/radar/types";

export const metadata: Metadata = { title: "Weekly roundup · Tech Radar" };

const WEEKS = 26;
const PER_WEEK = 7;

export default function WeeklyPage() {
  const weeks = new Map<string, RadarStory[]>();
  for (const s of getRadarStories()) {
    const w = weekStart(s.publishedAt);
    weeks.set(w, [...(weeks.get(w) ?? []), s]);
  }
  const keys = [...weeks.keys()].sort().reverse().slice(0, WEEKS);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div className="hero-grid pt-2 sm:pt-6">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
          <Link href="/radar/" className="tap hover:text-ink">
            ← Tech Radar
          </Link>
        </nav>
        <p className="eyebrow mt-4">Weekly roundup</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem]">The week in technology</h1>
        <p className="mt-2 text-ink-2">The highest-ranked stories of each week (Monday to Sunday, UTC), minor updates excluded.</p>
      </div>

      {keys.length === 0 && <p className="text-sm text-ink-2">No stories yet. The first scheduled update fills this page.</p>}

      {keys.map((w) => {
        const all = weeks.get(w) ?? [];
        const top = all.filter((s) => !s.minor).sort((a, b) => b.score.total - a.score.total).slice(0, PER_WEEK);
        const end = new Date(Date.parse(w) + 6 * 86_400_000).toISOString();
        return (
          <section key={w} aria-labelledby={`w-${w}`}>
            <div className="section-head">
              <h2 id={`w-${w}`}>
                {formatDay(`${w}T12:00:00Z`)} – {formatDay(end)}
              </h2>
              <span className="font-mono text-xs text-ink-3">{all.length} stories</span>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
              {RADAR_CATEGORIES.map((c) => {
                const n = all.filter((s) => s.category === c).length;
                return n > 0 ? (
                  <span key={c} className="inline-flex items-center gap-1">
                    <CategoryTag category={c} short /> {n}
                  </span>
                ) : null;
              })}
            </p>
            <ol className="mt-2 divide-y divide-line">
              {top.map((s) => (
                <li key={s.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <CategoryTag category={s.category} short />
                    <ImportanceTag importance={s.importance} score={s.score.total} />
                  </div>
                  <Link href={`/radar/${s.id}/`} className="mt-1 block font-semibold leading-snug hover:text-accent-text">
                    {s.analysis?.headline ?? s.title}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{s.analysis?.summary ?? s.excerpt}</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
