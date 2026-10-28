import type { Metadata } from "next";
import Link from "next/link";
import { DomainIcon, domainColor } from "@/components/DomainIcon";
import { TopicScore } from "@/components/TopicScore";
import { getAllQuestions, getAllTopics } from "@/lib/content";
import { DOMAINS, DOMAIN_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Lessons · Fundamentals Tracker" };

export default function LessonsPage() {
  const topics = getAllTopics();
  const questions = getAllQuestions();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lessons</h1>
        <p className="mt-1 text-ink-2">Short, interview-level guides. Each topic links to a focused drill.</p>
      </div>
      {DOMAINS.map((domain) => (
        <section key={domain}>
          <h2 className="mb-3 flex items-center gap-3 text-lg font-bold tracking-tight">
            <DomainIcon domain={domain} size={32} />
            {DOMAIN_LABELS[domain]}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {topics
              .filter((t) => t.domain === domain)
              .map((t) => (
                <li key={t.topic}>
                  <Link
                    href={`/lessons/${t.domain}/${t.topic}/`}
                    className="card block h-full p-4 transition-all hover:-translate-y-0.5 hover:border-ink-3"
                    style={{ borderLeft: `4px solid ${domainColor(t.domain)}` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{t.title}</p>
                      <TopicScore domain={t.domain} topic={t.topic} />
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{t.summary}</p>
                    <p className="mt-2 text-xs text-ink-3">
                      {questions.filter((q) => q.domain === t.domain && q.topic === t.topic).length} questions
                    </p>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
