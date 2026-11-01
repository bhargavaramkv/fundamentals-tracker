"use client";

import Link from "next/link";
import { useState } from "react";
import type { FunFact, FunStory, TopicMeta } from "@/lib/types";

function dayIndex(length: number): number {
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return day % length;
}

/** Low-effort learning for days without motivation: a real-world bug story, a fact, and an easy warm-up. */
export function FunCorner({ stories, facts, topics }: { stories: FunStory[]; facts: FunFact[]; topics: TopicMeta[] }) {
  // A new story each day, and the fact rotates the other way so they rarely repeat together.
  const [storyIdx, setStoryIdx] = useState(() => dayIndex(stories.length));
  const [factIdx, setFactIdx] = useState(() => facts.length - 1 - dayIndex(facts.length));
  const [revealed, setRevealed] = useState(false);

  const story = stories[storyIdx];
  const fact = facts[factIdx];
  const lesson = topics.find((t) => `${t.domain}/${t.topic}` === story.relatesTo);

  const nextStory = () => {
    setRevealed(false);
    setStoryIdx((i) => (i + 1) % stories.length);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="page-head">
        <nav aria-label="Breadcrumb" className="meta mb-3">
          <Link href="/" className="tap hover:text-ink">
            Today
          </Link>
        </nav>
        <h1>Not feeling it? That&apos;s fine.</h1>
        <p>Two minutes, no score pressure. Real bugs that broke real systems, and the fundamental each one teaches.</p>
      </header>

      <section className="border-y border-line py-7">
        <p className="eyebrow">
          Bug story · {story.year > new Date().getFullYear() ? `coming in ${story.year}` : story.year}
        </p>
        <h2 className="headline mt-1 text-3xl">{story.title}</h2>
        <p className="mt-2 text-lg text-ink-2">{story.hook}</p>

        {revealed ? (
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed" aria-live="polite">
            <p>{story.story}</p>
            <p className="border-l-2 border-good pl-4">
              <span className="font-semibold text-good">The lesson: </span>
              {story.lesson}
            </p>
            {lesson && (
              <Link href={`/learn/${lesson.domain}/${lesson.topic}/`} className="tap text-sm text-accent-text hover:underline">
                Related topic: {lesson.title} →
              </Link>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-3">Guess what went wrong before you reveal it.</p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {!revealed && (
            <button type="button" onClick={() => setRevealed(true)} className="btn btn-primary">
              What happened? <span className="btn-arrow" aria-hidden>→</span>
            </button>
          )}
          <button type="button" onClick={nextStory} className="btn btn-secondary">
            Another story
          </button>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Did you know?</h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[17px] leading-relaxed">{fact.fact}</p>
        <button type="button" onClick={() => setFactIdx((i) => (i + 1) % facts.length)} className="btn btn-ghost -ml-3 mt-2">
          Another fact
        </button>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <div>
          <p className="font-semibold">Warm-up: 5 easy questions</p>
          <p className="text-sm text-ink-2">Core-level only. A gentle way back in on a slow day.</p>
        </div>
        <Link href="/practice/?mode=warmup" className="btn btn-secondary">
          Start warm-up
        </Link>
      </section>
    </div>
  );
}
