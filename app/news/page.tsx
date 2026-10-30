import type { Metadata } from "next";
import Link from "next/link";
import { getAllNews, getAllTopics } from "@/lib/content";

export const metadata: Metadata = { title: "Tech news · Fundamentals Tracker" };

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function NewsPage() {
  const news = getAllNews();
  const topics = getAllTopics();
  const titleOf = (key: string) => topics.find((t) => `${t.domain}/${t.topic}` === key)?.title ?? key;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="hero-grid pt-2 sm:pt-6">
        <p className="eyebrow">Incidents, explained</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem]">Tech news</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Software incidents worth knowing about, each explained through the fundamentals behind it. Updated by the daily
          routine.
        </p>
      </div>

      {news.length === 0 ? (
        <p className="text-ink-2">No stories yet.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {news.map((n) => (
            <li key={n.slug}>
              <Link href={`/news/${n.slug}/`} className="group block py-6">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {n.severity === "critical" && (
                    <span className="tag bg-bad-bg text-bad">Critical</span>
                  )}
                  <span className="font-mono text-ink-3">
                    {formatDate(n.date)}
                    {n.updated && n.updated !== n.date ? ` · updated ${formatDate(n.updated)}` : ""}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-bold leading-snug tracking-tight group-hover:text-accent-text">{n.title}</h2>
                <p className="mt-1 text-sm text-ink-2">{n.summary}</p>
                {n.relatesTo.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-2 text-xs">
                    {n.relatesTo.map((r) => (
                      <span key={r} className="chip">
                        {titleOf(r)}
                      </span>
                    ))}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
