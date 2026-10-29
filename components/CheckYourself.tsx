"use client";

import { useState } from "react";
import type { CheckQuestion } from "@/lib/types";

/** A single ungraded question to make a story stick. Not logged to progress. */
export function CheckYourself({ check }: { check: CheckQuestion }) {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <section className="rounded-lg border border-line bg-surface p-5 sm:p-6">
      <p className="eyebrow">Check yourself</p>
      <h2 className="mt-1 font-semibold leading-snug">{check.prompt}</h2>
      <ol className="mt-4 space-y-2">
        {check.options.map((option, i) => {
          const isCorrect = i === check.answer;
          let tone = "border-line bg-bg hover:border-accent hover:bg-surface-2";
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
                className={`flex min-h-12 w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-[15px] transition-colors disabled:cursor-default ${tone}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line font-mono text-xs font-bold text-ink-2" aria-hidden>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{option}</span>
                {picked !== null && isCorrect && <span className="text-sm font-medium text-good">✓ Correct</span>}
                {picked !== null && i === picked && !isCorrect && <span className="text-sm font-medium text-bad">✗ Your answer</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {picked !== null && (
        <p
          role="status"
          className={`mt-4 rounded-lg border-l-4 p-4 text-sm leading-relaxed text-ink-2 ${
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
