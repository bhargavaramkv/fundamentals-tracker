import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DomainIcon, domainColor } from "@/components/DomainIcon";
import { LessonReadTracker } from "@/components/LessonReadTracker";
import { TopicScore } from "@/components/TopicScore";
import { getAllQuestions, getAllTopics, getLesson } from "@/lib/content";
import { DOMAINS, DOMAIN_LABELS, type Domain } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllTopics().map((t) => ({ domain: t.domain, topic: t.topic }));
}

function load(domain: string, topic: string) {
  if (!(DOMAINS as readonly string[]).includes(domain)) return null;
  return getLesson(domain as Domain, topic);
}

export async function generateMetadata(props: PageProps<"/lessons/[domain]/[topic]">): Promise<Metadata> {
  const { domain, topic } = await props.params;
  const lesson = load(domain, topic);
  return { title: lesson ? `${lesson.title} · Fundamentals Tracker` : "Lesson" };
}

export default async function LessonPage(props: PageProps<"/lessons/[domain]/[topic]">) {
  const { domain, topic } = await props.params;
  const lesson = load(domain, topic);
  if (!lesson) notFound();
  const count = getAllQuestions().filter((q) => q.domain === lesson.domain && q.topic === lesson.topic).length;

  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/lessons/" className="tap hover:text-ink">
              Lessons
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/lessons/#${lesson.domain}`} className="tap hover:text-ink">
              {DOMAIN_LABELS[lesson.domain]}
            </Link>
          </li>
        </ol>
      </nav>
      <header className="mt-3 mb-10 border-b border-line pb-8" style={{ borderTop: `2px solid ${domainColor(lesson.domain)}` }}>
        <p className="mt-6 flex items-center gap-2 text-sm font-medium text-ink-2">
          <DomainIcon domain={lesson.domain} size={26} />
          {DOMAIN_LABELS[lesson.domain]}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-[2.125rem]">{lesson.title}</h1>
        <p className="mt-2 text-ink-2">{lesson.summary}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href={`/practice/?topic=${lesson.domain}/${lesson.topic}`} className="btn btn-primary">
            Practice this topic · {count} q <span className="btn-arrow" aria-hidden>→</span>
          </Link>
          <TopicScore domain={lesson.domain} topic={lesson.topic} />
        </div>
      </header>
      <div className="prose-lesson" dangerouslySetInnerHTML={{ __html: lesson.html }} />
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-sm text-ink-2">Done reading? Check it stuck.</p>
        <Link href={`/practice/?topic=${lesson.domain}/${lesson.topic}`} className="btn btn-secondary">
          Practice this topic
        </Link>
      </div>
      <LessonReadTracker domain={lesson.domain} topic={lesson.topic} />
    </article>
  );
}
