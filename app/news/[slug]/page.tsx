import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckYourself } from "@/components/CheckYourself";
import { getAllNews, getAllTopics } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllNews().map((n) => ({ slug: n.slug }));
}

function find(slug: string) {
  return getAllNews().find((n) => n.slug === slug) ?? null;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function generateMetadata(props: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const item = find(slug);
  return { title: item ? `${item.title} · Tech news` : "Tech news" };
}

export default async function NewsStoryPage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  const item = find(slug);
  if (!item) notFound();
  const topics = getAllTopics();
  const related = item.relatesTo
    .map((key) => topics.find((t) => `${t.domain}/${t.topic}` === key))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/news/" className="tap text-sm text-ink-3 hover:text-ink">
        ← Tech news
      </Link>
      <header className="border-b border-line pb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {item.severity === "critical" && <span className="tag bg-bad-bg text-bad">Critical</span>}
          <span className="font-mono text-ink-3">
            {formatDate(item.date)}
            {item.updated && item.updated !== item.date ? ` · updated ${formatDate(item.updated)}` : ""}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-[2.125rem] sm:leading-tight">{item.title}</h1>
        <p className="mt-2 text-ink-2">{item.summary}</p>
      </header>

      <div className="prose-lesson" dangerouslySetInnerHTML={{ __html: item.html }} />

      {item.check && <CheckYourself check={item.check} />}

      {related.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Brush up on the fundamentals</h2>
          </div>
          <ul className="mt-2 space-y-1">
            {related.map((t) => (
              <li key={`${t.domain}/${t.topic}`}>
                <Link href={`/lessons/${t.domain}/${t.topic}/`} className="tap text-accent-text hover:underline">
                  {t.title} →
                </Link>{" "}
                <span className="text-ink-3">·</span>{" "}
                <Link href={`/practice/?topic=${t.domain}/${t.topic}`} className="tap text-sm text-ink-2 hover:text-ink hover:underline">
                  drill
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Sources</h2>
          <span className="text-xs text-ink-3">External links open in a new tab</span>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {item.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="tap text-accent-text hover:underline">
                {s.title} <span aria-hidden>↗</span>
                <span className="sr-only"> (external, opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
