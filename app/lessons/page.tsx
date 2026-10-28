import type { Metadata } from "next";
import Link from "next/link";
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
        <h1 className="text-2xl font-semibold tracking-tight">Lessons</h1>
        <p className="mt-1 text-ink-2">Short, interview-level guides. Each topic links to a focused drill.</p>
      </div>
      {DOMAINS.map((domain) => (
        <section key={domain}>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-3">{DOMAIN_LABELS[domain]}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {topics
              .filter((t) => t.domain === domain)
              .map((t) => (
                <li key={t.topic}>
                  <Link
                    href={`/lessons/${t.domain}/${t.topic}/`}
                    className="block h-full rounded-xl border border-line bg-surface p-4 hover:border-ink-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{t.title}</p>
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
