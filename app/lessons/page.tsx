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
    <div className="space-y-12">
      <div className="hero-grid pt-2 sm:pt-6">
        <p className="eyebrow">{topics.length} topics · 5 domains</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.125rem]">Lessons</h1>
        <p className="mt-2 text-ink-2">Short, interview-level guides. Each topic links to a focused drill.</p>
      </div>
      {DOMAINS.map((domain) => (
        <section key={domain} id={domain} className="scroll-mt-20">
          <div className="section-head">
            <h2 className="flex items-center gap-3">
              <DomainIcon domain={domain} size={30} />
              {DOMAIN_LABELS[domain]}
            </h2>
          </div>
          <ul className="grid divide-y divide-line sm:grid-cols-2 sm:gap-x-10 sm:divide-y-0">
            {topics
              .filter((t) => t.domain === domain)
              .map((t) => (
                <li key={t.topic} className="sm:border-b sm:border-line">
                  <Link
                    href={`/lessons/${t.domain}/${t.topic}/`}
                    className="group block h-full border-l-2 py-3 pl-3"
                    style={{ borderLeftColor: domainColor(t.domain) }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold group-hover:text-accent-text">{t.title}</p>
                      <TopicScore domain={t.domain} topic={t.topic} />
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{t.summary}</p>
                    <p className="mt-1.5 font-mono text-xs text-ink-3">
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
