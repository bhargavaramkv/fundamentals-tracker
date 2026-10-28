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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Not feeling it? That&apos;s fine.</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          Two minutes, no score pressure. Real bugs that broke real systems, and the fundamental each one teaches.
        </p>
      </div>

      <section className="card p-5 sm:p-7">
        <p className="text-sm font-semibold text-accent">
          Bug story · {story.year > new Date().getFullYear() ? `coming in ${story.year}` : story.year}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">{story.title}</h2>
        <p className="mt-2 text-lg text-ink-2">{story.hook}</p>

        {revealed ? (
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed">
            <p>{story.story}</p>
            <p className="rounded-xl border-l-4 border-good bg-good-bg/50 p-4">
              <span className="font-semibold text-good">The lesson: </span>
              {story.lesson}
            </p>
            {lesson && (
              <Link href={`/lessons/${lesson.domain}/${lesson.topic}/`} className="tap text-sm text-accent hover:underline">
                Related lesson: {lesson.title} →
              </Link>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-3">Guess what went wrong before you reveal it.</p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {!revealed && (
            <button type="button" onClick={() => setRevealed(true)} className="btn btn-primary">
              What happened?
            </button>
          )}
          <button type="button" onClick={nextStory} className="btn btn-secondary">
            Another story
          </button>
        </div>
      </section>

      <section className="card p-5">
        <p className="text-sm font-semibold text-accent">Did you know?</p>
        <p className="mt-2 leading-relaxed">{fact.fact}</p>
        <button type="button" onClick={() => setFactIdx((i) => (i + 1) % facts.length)} className="btn btn-ghost -ml-3 mt-2">
          Another fact
        </button>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold">Warm-up: 5 easy questions</p>
          <p className="text-sm text-ink-2">Core-level only. Good for getting a streak going on a slow day.</p>
        </div>
        <Link href="/practice/?mode=warmup" className="btn btn-primary">
          Start warm-up
        </Link>
      </section>
    </div>
  );
}
