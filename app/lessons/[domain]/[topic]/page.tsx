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
      <Link href="/lessons/" className="tap text-sm text-ink-3 hover:text-ink">
        ← {DOMAIN_LABELS[lesson.domain]}
      </Link>
      <header className="card mt-2 mb-8 p-5 sm:p-7" style={{ borderTop: `4px solid ${domainColor(lesson.domain)}` }}>
        <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
          <DomainIcon domain={lesson.domain} size={28} />
          {DOMAIN_LABELS[lesson.domain]}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{lesson.title}</h1>
        <p className="mt-1 text-ink-2">{lesson.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link
            href={`/practice/?topic=${lesson.domain}/${lesson.topic}`}
            className="btn btn-primary"
          >
            Drill this topic · {count} q
          </Link>
          <TopicScore domain={lesson.domain} topic={lesson.topic} />
        </div>
      </header>
      <div className="prose-lesson" dangerouslySetInnerHTML={{ __html: lesson.html }} />
      <LessonReadTracker domain={lesson.domain} topic={lesson.topic} />
    </article>
  );
}
