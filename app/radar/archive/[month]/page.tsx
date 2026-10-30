import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryTag, formatDay, ImportanceTag } from "@/components/radar/ui";
import { getRadarMonths, getRadarStories } from "@/lib/radar/load";

export const dynamicParams = false;

// A static export needs at least one path; "none" renders the not-found page until the first stories arrive.
export function generateStaticParams() {
  const months = getRadarMonths();
  return months.length > 0 ? months.map((month) => ({ month })) : [{ month: "none" }];
}

const label = (month: string) =>
  new Date(`${month}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export async function generateMetadata(props: PageProps<"/radar/archive/[month]">): Promise<Metadata> {
  const { month } = await props.params;
  return { title: /^\d{4}-\d{2}$/.test(month) ? `${label(month)} · Tech Radar archive` : "Tech Radar archive" };
}

export default async function ArchivePage(props: PageProps<"/radar/archive/[month]">) {
  const { month } = await props.params;
  const months = getRadarMonths();
  if (!months.includes(month)) notFound();
  const stories = getRadarStories().filter((s) => s.publishedAt.startsWith(month));

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="hero-grid pt-2 sm:pt-6">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
          <Link href="/radar/" className="tap hover:text-ink">
            ← Tech Radar
          </Link>
        </nav>
        <p className="eyebrow mt-4">Archive</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem]">{label(month)}</h1>
        <p className="mt-2 text-ink-2">Every story found this month, including minor updates, newest first.</p>
        <nav aria-label="Months" className="mt-4 flex flex-wrap gap-2">
          {months.map((m) => (
            <Link key={m} href={`/radar/archive/${m}/`} aria-current={m === month ? "page" : undefined} className={`chip ${m === month ? "border-accent text-ink" : "text-ink-2 hover:text-ink"}`}>
              {label(m)}
            </Link>
          ))}
        </nav>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {stories.map((s) => (
          <li key={s.id} className="py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-ink-3">{formatDay(s.publishedAt)}</span>
              <CategoryTag category={s.category} short />
              <ImportanceTag importance={s.importance} score={s.score.total} />
              {s.minor && <span className="text-xs text-ink-3">minor</span>}
            </div>
            <Link href={`/radar/${s.id}/`} className="mt-1 block font-semibold leading-snug hover:text-accent-text">
              {s.analysis?.headline ?? s.title}
            </Link>
            <p className="font-mono text-xs text-ink-3">{s.sources[0].sourceName}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
