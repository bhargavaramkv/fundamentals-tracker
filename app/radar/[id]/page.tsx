import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoryActions } from "@/components/radar/StoryActions";
import { CategoryTag, formatDateTime, formatDay, ImportanceTag } from "@/components/radar/ui";
import { getAllTopics } from "@/lib/content";
import { getRadarStories, getRadarStory } from "@/lib/radar/load";
import { RADAR_CATEGORY_LABELS, type Credibility } from "@/lib/radar/types";

export const dynamicParams = false;

// A static export needs at least one path; "none" renders the not-found page until the first stories arrive.
export function generateStaticParams() {
  const ids = getRadarStories().map((s) => ({ id: s.id }));
  return ids.length > 0 ? ids : [{ id: "none" }];
}

export async function generateMetadata(props: PageProps<"/radar/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const story = getRadarStory(id);
  return { title: story ? `${story.analysis?.headline ?? story.title} · Tech Radar` : "Tech Radar" };
}

const CREDIBILITY: Record<Credibility, string> = { 3: "Primary source", 2: "Publication", 1: "Aggregator" };

function Prose({ title, children }: { title: string; children: string }) {
  return (
    <section>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 leading-relaxed text-ink-2">{children}</p>
    </section>
  );
}

function Bullets({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  if (items.length === 0 && !empty) return null;
  return (
    <section>
      <h3 className="text-base font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1.5 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink-2">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function RadarStoryPage(props: PageProps<"/radar/[id]">) {
  const { id } = await props.params;
  const story = getRadarStory(id);
  if (!story) notFound();
  const a = story.analysis;
  const topics = getAllTopics();
  const related = (a?.relatedTopics ?? [])
    .map((key) => topics.find((t) => `${t.domain}/${t.topic}` === key))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/radar/" className="tap hover:text-ink">
              Tech Radar
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>{RADAR_CATEGORY_LABELS[story.category]}</li>
        </ol>
      </nav>

      <header className="border-b border-line pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <CategoryTag category={story.category} />
          <ImportanceTag importance={story.importance} score={story.score.total} />
          {story.updatedAt && <span className="tag bg-surface-2 text-ink-2">Updated {formatDay(story.updatedAt)}</span>}
          {story.minor && <span className="tag bg-surface-2 text-ink-2">Minor update</span>}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-[2.125rem] sm:leading-tight">{a?.headline ?? story.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{a?.summary ?? story.excerpt}</p>
        <p className="mt-4 font-mono text-xs text-ink-3">
          Published {formatDay(story.publishedAt)}
          {story.dateEstimated && " (date estimated: the source gave none)"} · {story.sources[0].sourceName} · found{" "}
          {formatDateTime(story.firstSeenAt)}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={story.canonicalUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
            Read the original <span aria-hidden>↗</span>
            <span className="sr-only"> (external, opens in a new tab)</span>
          </a>
          <StoryActions id={story.id} />
        </div>
      </header>

      {a ? (
        <>
          <section aria-labelledby="facts-h" className="rounded-lg border border-line bg-surface p-5 sm:p-6">
            <p className="eyebrow">From the source</p>
            <h2 id="facts-h" className="mt-1 text-lg font-bold tracking-tight">What the source reports</h2>
            <p className="mt-1 text-xs text-ink-3">
              Extracted from {a.basedOn.length ? "the original article" : "the feed excerpt"} by the model. Check the original
              for exact wording.
            </p>
            <div className="mt-4 space-y-5">
              <Bullets title="Stated as fact" items={a.sourceFacts} />
              <Bullets title="Company claims (not independently verified)" items={a.companyClaims} empty="No vendor claims identified." />
            </div>
          </section>

          <section aria-labelledby="analysis-h" className="space-y-6">
            <div className="section-head">
              <h2 id="analysis-h">Analysis</h2>
              <span className="tag bg-accent/10 text-accent-text" title={`Generated by ${a.model} on ${a.generatedAt}`}>
                AI-generated · {a.model}
              </span>
            </div>
            <Prose title="What actually happened">{a.whatHappened}</Prose>
            <Prose title="How it works">{a.technicalExplanation}</Prose>
            <Prose title="Why it matters">{a.whyItMatters}</Prose>
            <Prose title="Industry impact">{a.industryImpact}</Prose>
          </section>

          <section aria-labelledby="fund-h">
            <div className="section-head">
              <h2 id="fund-h">The fundamentals behind it</h2>
            </div>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              {a.fundamentals.map((f) => (
                <div key={f.concept} className="rounded-lg border border-line bg-surface p-4">
                  <dt className="font-semibold">{f.concept}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-2">{f.explanation}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-8 sm:grid-cols-2">
            <Bullets title="Real-world applications" items={a.applications} />
            <Bullets title="What to learn next" items={a.learn} />
          </div>

          {related.length > 0 && (
            <section aria-labelledby="related-h">
              <div className="section-head">
                <h2 id="related-h">Practise it here</h2>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {related.map((t) => (
                  <li key={`${t.domain}/${t.topic}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/lessons/${t.domain}/${t.topic}/`} className="font-medium hover:text-accent-text">
                      {t.title}
                    </Link>
                    <Link href={`/practice/?topic=${t.domain}/${t.topic}`} className="btn btn-ghost">
                      Drill
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {a.limitations && <p className="text-sm text-ink-3">Limits of this analysis: {a.limitations}</p>}
        </>
      ) : (
        <section className="rounded-lg border border-line bg-surface p-5">
          <p className="eyebrow">Analysis pending</p>
          <p className="mt-2 text-sm text-ink-2">
            {story.status === "below-threshold"
              ? "This story ranked below the bar for a full analysis (or is a minor update). It's kept here for the record."
              : (story.statusNote ?? "This story hasn't been analysed yet. The next daily run will pick it up.")}
          </p>
          {story.excerpt && (
            <>
              <h2 className="mt-4 text-sm font-semibold">Feed excerpt (from the source)</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{story.excerpt}</p>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="sources-h">
        <div className="section-head">
          <h2 id="sources-h">Sources</h2>
          <span className="text-xs text-ink-3">External links open in a new tab</span>
        </div>
        <ul className="mt-2 space-y-3 text-sm">
          {story.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-accent-text hover:underline">
                {s.title} <span aria-hidden>↗</span>
                <span className="sr-only"> (external, opens in a new tab)</span>
              </a>
              <p className="font-mono text-xs text-ink-3">
                {s.sourceName} · {CREDIBILITY[s.credibility]}
                {s.publishedAt && ` · ${formatDay(s.publishedAt)}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rank-h">
        <div className="section-head">
          <h2 id="rank-h">Why it ranks here</h2>
          <span className="font-mono text-xs text-ink-3">{story.score.total}/100</span>
        </div>
        <table className="mt-2 w-full text-sm">
          <tbody className="divide-y divide-line">
            {story.score.parts.map((p) => (
              <tr key={p.label}>
                <th scope="row" className="py-2 pr-3 text-left font-medium align-top">{p.label}</th>
                <td className="py-2 pr-3 text-ink-2">{p.reason}</td>
                <td className={`py-2 text-right font-mono tabular-nums align-top ${p.points < 0 ? "text-bad" : "text-ink"}`}>
                  {p.points > 0 ? `+${p.points}` : p.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {story.revisions.length > 0 && (
        <section aria-labelledby="rev-h">
          <div className="section-head">
            <h2 id="rev-h">History</h2>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            <li>
              <span className="font-mono text-xs text-ink-3">{formatDateTime(story.firstSeenAt)}</span> First published here
            </li>
            {story.revisions.map((r) => (
              <li key={r.at + r.contentHash}>
                <span className="font-mono text-xs text-ink-3">{formatDateTime(r.at)}</span> {r.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
