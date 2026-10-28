import type { Metadata } from "next";
import Link from "next/link";
import { TopicScore } from "@/components/TopicScore";
import { getAllQuestions, getAllTopics } from "@/lib/content";
import { DOMAINS, DOMAIN_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Intel files · BHARGAVA.DEV" };

export default function LessonsPage() {
  const topics = getAllTopics();
  const questions = getAllQuestions();
  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-accent">THE ARCHIVES</p>
        <h1 className="font-comic text-5xl text-white">Intel files</h1>
        <p className="mt-1 text-ink-2">Short, interview-level briefings. Every file links to a targeted drill.</p>
      </div>
      {DOMAINS.map((domain) => (
        <section key={domain}>
          <h2 className="mb-3 font-comic text-2xl text-accent">{DOMAIN_LABELS[domain]}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {topics
              .filter((t) => t.domain === domain)
              .map((t) => (
                <li key={t.topic}>
                  <Link
                    href={`/lessons/${t.domain}/${t.topic}/`}
                    className="block h-full rounded-xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-neon"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-white">{t.title}</p>
                      <TopicScore domain={t.domain} topic={t.topic} />
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{t.summary}</p>
                    <p className="mt-2 font-mono text-[10px] tracking-wider text-ink-3 uppercase">
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
