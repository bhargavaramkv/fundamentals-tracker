"use client";

import Link from "next/link";
import { useMentor } from "./MentorProvider";
import { useConcepts } from "./mentor/useConcepts";

const DUE_SHOWN = 3;
const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Today's mentor panel: pending reviews, the latest review, the latest weekly report and concepts due for a check. Nothing fake. */
export function TodayMentor() {
  const { hasToken, loaded, pending, reviews, weekly } = useMentor();
  const concepts = useConcepts();
  const due = concepts.filter((c) => c.result.dueForVerification).slice(0, DUE_SHOWN);
  const review = reviews[0];
  const report = weekly[0];

  if (!loaded) return null;
  if (!hasToken) return <p className="meta">Connect sync in Settings to see reviews.</p>;
  if (!review && !report && pending.length === 0 && due.length === 0) return <p className="meta">No reviews yet. They appear after you end a session.</p>;

  return (
    <section aria-label="Mentor" className="space-y-5 border-l-2 border-accent pl-4 sm:pl-5">
      <p className="eyebrow text-accent-text">Mentor</p>

      {pending.length > 0 && (
        <p className="text-[15px] text-ink-2">
          {pending.length} {pending.length === 1 ? "review" : "reviews"} queued.{" "}
          <Link href="/journal/" className="font-medium text-accent-text hover:underline">
            Open the journal
          </Link>
        </p>
      )}

      {review && (
        <div className="space-y-1.5">
          <p className="meta">Latest review · {dateOf(review.createdAt)}</p>
          <p className="break-words text-[15px]">{review.summary}</p>
          {review.nextSteps[0] && <p className="break-words text-[14px] text-ink-2">Next: {review.nextSteps[0]}</p>}
          <Link href={`/journal/?s=${encodeURIComponent(review.sessionId)}`} className="inline-block text-[14px] font-medium text-accent-text hover:underline">
            Read the review
          </Link>
        </div>
      )}

      {report && (
        <div className="space-y-1.5">
          <p className="meta">Weekly report · {report.week}</p>
          <p className="break-words text-[15px]">{report.sufficiency === "activity-only" ? "Limited data: activity summary only." : (report.priorities[0] ?? "Weekly coaching report")}</p>
          <Link href="/mentor/" className="inline-block text-[14px] font-medium text-accent-text hover:underline">
            Open the report
          </Link>
        </div>
      )}

      {due.length > 0 && (
        <div className="space-y-1.5">
          <p className="meta">Due for verification</p>
          <ul className="space-y-1 text-[15px]">
            {due.map((c) => (
              <li key={c.key} className="break-words">
                {c.label}
              </li>
            ))}
          </ul>
          <Link href="/knowledge/" className="inline-block text-[14px] font-medium text-accent-text hover:underline">
            See in Knowledge
          </Link>
        </div>
      )}
    </section>
  );
}
