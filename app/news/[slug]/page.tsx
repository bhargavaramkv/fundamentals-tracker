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
      <header className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {item.severity === "critical" && <span className="rounded-full bg-bad-bg px-2 py-0.5 font-semibold text-bad">Critical</span>}
          <span className="text-ink-3">
            {formatDate(item.date)}
            {item.updated && item.updated !== item.date ? ` · updated ${formatDate(item.updated)}` : ""}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{item.title}</h1>
        <p className="mt-2 text-ink-2">{item.summary}</p>
      </header>

      <div className="prose-lesson" dangerouslySetInnerHTML={{ __html: item.html }} />

      {item.check && <CheckYourself check={item.check} />}

      {related.length > 0 && (
        <section className="card p-5">
          <h2 className="font-bold tracking-tight">Brush up on the fundamentals</h2>
          <ul className="mt-2 space-y-1">
            {related.map((t) => (
              <li key={`${t.domain}/${t.topic}`}>
                <Link href={`/lessons/${t.domain}/${t.topic}/`} className="tap text-accent hover:underline">
                  {t.title} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-bold tracking-tight">Sources</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {item.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="tap text-accent hover:underline">
                {s.title} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
