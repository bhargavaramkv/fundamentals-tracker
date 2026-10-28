"use client";

import { useState } from "react";
import type { CheckQuestion } from "@/lib/types";

/** A single ungraded question to make a story stick. Not logged to progress. */
export function CheckYourself({ check }: { check: CheckQuestion }) {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <section className="card p-5 sm:p-6">
      <p className="text-sm font-semibold text-accent">Check yourself</p>
      <h2 className="mt-1 font-semibold leading-snug">{check.prompt}</h2>
      <ol className="mt-4 space-y-2">
        {check.options.map((option, i) => {
          const isCorrect = i === check.answer;
          let tone = "border-line bg-bg hover:border-accent";
          if (picked !== null) {
            if (isCorrect) tone = "border-good bg-good-bg";
            else if (i === picked) tone = "border-bad bg-bad-bg";
            else tone = "border-line opacity-55";
          }
          return (
            <li key={option}>
              <button
                type="button"
                onClick={() => setPicked(i)}
                disabled={picked !== null}
                className={`flex min-h-12 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] transition-all ${tone}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink-2">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{option}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {picked !== null && (
        <p
          className={`mt-4 rounded-xl border-l-4 p-4 text-sm leading-relaxed text-ink-2 ${
            picked === check.answer ? "border-good bg-good-bg/50" : "border-bad bg-bad-bg/50"
          }`}
        >
          <span className={`font-semibold ${picked === check.answer ? "text-good" : "text-bad"}`}>
            {picked === check.answer ? "Correct. " : "Not quite. "}
          </span>
          {check.explanation}
        </p>
      )}
    </section>
  );
}
