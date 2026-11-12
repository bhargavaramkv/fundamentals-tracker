"use client";

import Link from "next/link";
import { GOAL_ANSWERS, streak, todayGoal } from "@/lib/curriculum";
import { Flame, ProgressRing } from "./ProgressRing";
import { useCourse, type CourseContext } from "./useCourse";
import { useLearnerProfile } from "./useLearnerProfile";

/** Daily goal, streak and what the coach has learned about you. Fits a narrow rail and a full-width stack. */
export function CoachPanel(ctx: CourseContext) {
  const { data, now, ready, meta } = useCourse(ctx);
  const profile = useLearnerProfile();
  const days = ready && now !== null ? streak(data, now) : 0;
  const goal = ready && now !== null ? todayGoal(data, now) : null;
  const goalValue = goal ? (goal.met ? 1 : goal.answers / GOAL_ANSWERS) : 0;
  const title = (key: string) => meta(key)?.title ?? key;

  return (
    <aside className="space-y-4" aria-label="Your progress and coach">
      <div className="card space-y-4 p-4">
        <div className="flex items-center gap-3">
          <ProgressRing value={goalValue} size={44} color={goal?.met ? "var(--good)" : "var(--accent)"}>
            {goal?.met ? "✓" : ""}
          </ProgressRing>
          <div className="min-w-0">
            <p className="font-extrabold">Daily goal</p>
            <p className="text-sm text-ink-2">{goal?.met ? "Done for today" : `1 lesson or ${GOAL_ANSWERS} answers (${goal?.answers ?? 0}/${GOAL_ANSWERS})`}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
            <Flame lit={days > 0} size={26} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold tabular-nums">{days === 1 ? "1 day" : `${days} days`}</p>
            <p className="text-sm text-ink-2">{days > 0 ? "Streak. Keep it alive!" : "Learn today to start a streak"}</p>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <p className="eyebrow">Your coach</p>
        {!profile ? (
          <p className="meta">Enable sync in Settings and your coach will tailor lessons to you.</p>
        ) : (
          <>
            <p className="text-[15px] leading-snug">{profile.headline}</p>
            {profile.nextUp.length > 0 && (
              <div>
                <p className="meta font-bold">Picked for you</p>
                <ul className="mt-1 space-y-2">
                  {profile.nextUp.map((n) => (
                    <li key={n.topic}>
                      <Link href={`/learn/${n.topic}/`} className="font-bold text-accent-text hover:underline">
                        {title(n.topic)}
                      </Link>
                      <p className="text-sm text-ink-2">{n.why}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.struggles.length > 0 && (
              <div>
                <p className="meta font-bold">Working on</p>
                <ul className="mt-1 space-y-1">
                  {profile.struggles.map((s) => (
                    <li key={s.topic} className="text-sm text-ink-2">
                      <span className="font-bold text-ink">{title(s.topic)}:</span> {s.misconception}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.adaptations.length > 0 && (
              <div>
                <p className="meta font-bold">Tuned for you</p>
                <ul className="mt-1 space-y-1">
                  {profile.adaptations.slice(0, 3).map((a, i) => (
                    <li key={i} className="text-sm text-ink-2">
                      <span className="tabular-nums">{a.date}</span> · {title(a.topic)} · {a.change}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
