"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { activityPrompt, DIAGNOSTIC_PROMPT, freshnessOf, mentorSessionUrl, missedTonight, OPEN_PROMPT, saveSubmission, workSince, type MentorLoad } from "@/lib/mentor/client";
import { forDateOf } from "@/lib/mentor/time";
import { DIMENSIONS, DIMENSION_LABEL, knowledgeOf, LEVEL_LABEL, PRIMARY_AFTER_NIGHTS, type LearnerState, type Level, type MentorActivity, type MentorStatus, type Submission } from "@/lib/mentor/types";
import type { Resource } from "@/lib/resources";
import { useAuth } from "../AuthGate";
import { useProgress } from "../ProgressProvider";
import { useMentor } from "./useMentor";

export function MentorPage({ resources }: { resources: Resource[] }) {
  const load = useMentor();
  if (load === null) return <p className="meta py-10">Loading your plan…</p>;
  return <MentorView load={load} resources={resources} />;
}

const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const levelWord = (l: Level | null) => (l === null ? "Untested" : LEVEL_LABEL[l]);

function SessionLink({ prompt, children, primary = false }: { prompt: string; children: string; primary?: boolean }) {
  return (
    <a href={mentorSessionUrl(prompt)} target="_blank" rel="noreferrer" className={`btn ${primary ? "btn-primary" : "btn-secondary"}`}>
      {children} <span aria-hidden>↗</span>
    </a>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl py-6">
      <header className="page-head">
        <p className="eyebrow">Mentor</p>
        <h1 className="mt-2">{title}</h1>
      </header>
      <div className="mt-5 text-ink-2">{children}</div>
    </div>
  );
}

export function MentorView({ load, resources }: { load: MentorLoad; resources: Resource[] }) {
  if (load.kind === "no-token") {
    return (
      <Notice title="Your mentor needs sync">
        <p>
          The mentor reads and writes through your private data repo. Turn on sync in{" "}
          <Link href="/settings/" className="text-accent-text hover:underline">
            Settings
          </Link>
          .
        </p>
      </Notice>
    );
  }
  if (load.kind === "error") {
    return (
      <Notice title="Couldn't load your mentor">
        <p>
          {load.message}. If your sync token has expired, renew it in{" "}
          <Link href="/settings/" className="text-accent-text hover:underline">
            Settings
          </Link>
          . Nothing has been lost.
        </p>
      </Notice>
    );
  }
  if (load.kind === "empty") {
    return (
      <Notice title="Your mentor hasn't run yet">
        <p>It runs every night at 1:00 AM India time. You can start the diagnostic conversation now, and tonight&apos;s run will analyse it.</p>
        <div className="mt-5">
          <SessionLink prompt={DIAGNOSTIC_PROMPT} primary>
            Start diagnostic
          </SessionLink>
        </div>
      </Notice>
    );
  }
  return <Dashboard state={load.state} status={load.status} resources={resources} />;
}

function StatusLine({ state, status }: { state: LearnerState; status: MentorStatus | null }) {
  const now = new Date();
  const { kind, ageDays } = freshnessOf(state, now, status);
  const today = forDateOf(now);
  const failed = status?.lastRunStatus === "failed" && status.lastRunForDate === today;
  const missed = missedTonight(status, now);
  // Checked since the plan was written, with nothing new to analyse: the plan is unchanged on purpose, not neglected.
  const checkedSince = status?.lastSuccessForDate && status.lastSuccessForDate > state.plan.forDate ? status.lastSuccessForDate : null;
  const nights = status?.consecutiveNights ?? 0;
  return (
    <div className="mt-3 space-y-1 text-[15px]" role="status">
      <p className="meta">
        Plan for {dayLabel(state.plan.forDate)} · analysed {new Date(state.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · version {state.version}
      </p>
      {failed && <p className="border-l-2 border-warn pl-4 text-ink-2">Last night&apos;s analysis failed, so this is the last valid plan. Your data is safe, and it runs again tonight.</p>}
      {missed && !failed && <p className="border-l-2 border-warn pl-4 text-ink-2">No run reported last night. A usage limit or service outage leaves no record, and it tries again tonight.</p>}
      {checkedSince && !failed && <p className="text-ink-2">Checked again on {dayLabel(checkedSince)}. There was no new work to analyse, so the plan stays.</p>}
      {kind === "stale" && <p className="border-l-2 border-warn pl-4 text-ink-2">Your mentor hasn&apos;t reported in for {ageDays} days.</p>}
      {!status?.primaryEligible && (
        <p className="meta">
          {nights >= PRIMARY_AFTER_NIGHTS
            ? "On trial: it has run without errors for 5 nights. It becomes your home page after its first night with real work to analyse."
            : `On trial: ${nights} of ${PRIMARY_AFTER_NIGHTS} nights in a row without errors, then it becomes your home page.`}
        </p>
      )}
    </div>
  );
}

function Dashboard({ state, status, resources }: { state: LearnerState; status: MentorStatus | null; resources: Resource[] }) {
  const titleOf = (id: string) => state.profile.skills.find((s) => s.id === id)?.title ?? state.skillCatalogue.find((s) => s.id === id)?.title ?? id;
  const untested = state.skillCatalogue.filter((c) => !state.profile.skills.some((s) => s.id === c.id));
  const hasEvidence = state.profile.skills.length > 0;
  const noChange = state.analysis.improved.length === 0 && state.analysis.regressed.length === 0 && state.levelChanges.length === 0;
  const { data: progress } = useProgress();
  const waiting = workSince(progress, state.generatedAt);
  const waitingParts = [waiting.answers > 0 && `${waiting.answers} ${waiting.answers === 1 ? "answer" : "answers"}`, waiting.activities > 0 && `${waiting.activities} ${waiting.activities === 1 ? "activity" : "activities"}`].filter(Boolean);

  return (
    <div className="space-y-14">
      <header className="page-head">
        <p className="eyebrow">Today&apos;s focus</p>
        <h1 className="mt-2">{state.plan.primary.objective}</h1>
        <p>{state.analysis.summary}</p>
        <StatusLine state={state} status={status} />
      </header>

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0 space-y-14">
          <section aria-labelledby="plan-h">
            <div className="section-head">
              <h2 id="plan-h">Today</h2>
            </div>
            <ActivityCard activity={state.plan.primary} state={state} resources={resources} label="Primary" />
            {state.plan.supporting.map((a) => (
              <ActivityCard key={a.id} activity={a} state={state} resources={resources} label="Supporting" />
            ))}
            {/* With no evidence yet the activity's own "Why" says the same thing. */}
            {!state.plan.primary.noEvidenceYet && <p className="meta mt-4">Why this plan: {state.analysis.decisionRationale}</p>}
          </section>

          {state.feedback.length > 0 && (
            <section aria-labelledby="feedback-h">
              <div className="section-head">
                <h2 id="feedback-h">Feedback on your answers</h2>
              </div>
              <ul className="divide-y divide-line">
                {state.feedback.map((f) => (
                  <li key={f.submissionId} className="py-4">
                    <p className="meta capitalize">{f.verdict}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[15px]">{f.feedback}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(state.roadmap.items.length > 0 || state.roadmap.changes.length > 0) && (
            <section aria-labelledby="roadmap-h">
              <div className="section-head">
                <h2 id="roadmap-h">Your roadmap</h2>
              </div>
              <ol className="divide-y divide-line">
                {state.roadmap.items.map((r) => (
                  <li key={`${r.skillId}-${r.status}`} className="py-3">
                    <p className="meta capitalize">{r.status}</p>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-[15px] text-ink-2">{r.why}</p>
                  </li>
                ))}
              </ol>
              {state.roadmap.changes.length > 0 && (
                <>
                  <h3 className="mt-6 font-medium">What changed in the roadmap</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-2">
                    {state.roadmap.changes.map((c) => (
                      <li key={c.change}>
                        {c.change}. {c.why}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-12">
          <section aria-labelledby="progress-h">
            <div className="section-head">
              <h2 id="progress-h">Since the last analysis</h2>
            </div>
            {waitingParts.length > 0 && (
              <p className="mb-3 text-[15px]" role="status">
                {waitingParts.join(" and ")} since then {waiting.answers + waiting.activities === 1 ? "is" : "are"} waiting for tonight&apos;s 1:00 AM analysis.
              </p>
            )}
            {noChange ? (
              <p className="text-[15px] text-ink-2">{waitingParts.length > 0 ? "The last analysis found no change in what you'd demonstrated." : "No change in what you've demonstrated."}</p>
            ) : (
              <ul className="space-y-2 text-[15px]">
                {state.analysis.improved.map((x) => (
                  <li key={x}>
                    <span className="font-medium text-good">Improved:</span> {x}
                  </li>
                ))}
                {state.analysis.regressed.map((x) => (
                  <li key={x}>
                    <span className="font-medium text-bad">Regressed:</span> {x}
                  </li>
                ))}
                {state.levelChanges.map((c) => (
                  <li key={`${c.skillId}-${c.dimension}`} className="text-ink-2">
                    {titleOf(c.skillId)}, {DIMENSION_LABEL[c.dimension].toLowerCase()}: {levelWord(c.from)} to {levelWord(c.to)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="sw-h">
            <div className="section-head">
              <h2 id="sw-h">Strengths and gaps</h2>
            </div>
            {!hasEvidence && <p className="text-[15px] text-ink-2">Nothing tested yet. Claude won&apos;t guess a level without evidence.</p>}
            {state.profile.strengths.map((a) => (
              <p key={`s-${a.skillId}`} className="mb-3 text-[15px]">
                <span className="font-medium text-good">{titleOf(a.skillId)}:</span> {a.note}
              </p>
            ))}
            {state.profile.weaknesses.map((a) => (
              <p key={`w-${a.skillId}`} className="mb-3 text-[15px]">
                <span className="font-medium text-bad">{titleOf(a.skillId)}:</span> {a.note}
              </p>
            ))}
            {state.profile.misconceptions
              .filter((m) => m.status === "active")
              .map((m) => (
                <p key={m.id} className="mb-3 text-[15px]">
                  <span className="font-medium">Misconception, {titleOf(m.skillId)}:</span> {m.description}
                </p>
              ))}
          </section>

          <section aria-labelledby="revision-h">
            <div className="section-head">
              <h2 id="revision-h">Upcoming revision</h2>
            </div>
            {state.plan.revision.length === 0 ? (
              <p className="text-[15px] text-ink-2">Nothing scheduled yet.</p>
            ) : (
              <ul className="space-y-3 text-[15px]">
                {state.plan.revision.map((r) => (
                  <li key={`${r.skillId}-${r.due}`}>
                    <span className="font-medium">{titleOf(r.skillId)}</span>, {dayLabel(r.due)}
                    <span className="block text-ink-2">{r.why}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="skills-h">
            <div className="section-head">
              <h2 id="skills-h">What you&apos;ve shown</h2>
            </div>
            <ul className="space-y-4 text-[15px]">
              {state.profile.skills.map((s) => (
                <li key={s.id}>
                  <p className="font-medium">{s.title}</p>
                  <ul className="meta mt-1">
                    {DIMENSIONS.filter((d) => s.dimensions[d].level !== null).map((d) => (
                      <li key={d}>
                        {DIMENSION_LABEL[d]}: {levelWord(s.dimensions[d].level)} ({knowledgeOf(s.dimensions[d].level)}), {s.dimensions[d].confidence} confidence
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {untested.length > 0 && (
              <p className="meta mt-4">
                Untested: {untested.length} of {state.skillCatalogue.length} skills.
              </p>
            )}
          </section>

          {state.profile.longTermObjectives.length > 0 && (
            <section aria-labelledby="goals-h">
              <div className="section-head">
                <h2 id="goals-h">Long-term objectives</h2>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-2">
                {state.profile.longTermObjectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="talk-h">
            <div className="section-head">
              <h2 id="talk-h">Talk to your mentor</h2>
            </div>
            <p className="mb-3 text-[15px] text-ink-2">Opens a session on claude.ai using your Claude plan. It knows your profile, and tonight&apos;s analysis reads what you discussed.</p>
            <SessionLink prompt={OPEN_PROMPT}>Open a session</SessionLink>
          </section>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity: a, state, resources, label }: { activity: MentorActivity; state: LearnerState; resources: Resource[]; label: string }) {
  const { syncToken } = useAuth();
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fieldId = `answer-${a.id}`;

  async function submit() {
    if (!syncToken || !answer.trim()) return;
    setPhase("saving");
    const sub: Submission = {
      id: `${state.plan.forDate}-${a.id}-${crypto.randomUUID().slice(0, 8)}`.replace(/[^a-zA-Z0-9-]/g, "-"),
      forDate: state.plan.forDate,
      activityId: a.id,
      skillIds: a.skillIds,
      prompt: a.exercise,
      answer,
      submittedAt: new Date().toISOString(),
    };
    try {
      await saveSubmission(syncToken, sub);
      setAnswer("");
      setPhase("saved");
    } catch {
      setPhase("error");
    }
  }

  return (
    <article className="border-b border-line py-6 first:pt-2">
      <p className="meta">
        {label} · about {a.minutes} min
      </p>
      <h3 className="headline mt-1 text-xl">{a.title}</h3>
      <p className="mt-2 text-[15px]">
        <span className="font-medium">Why:</span> {a.why}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-[15px]">{a.exercise}</p>
      <div className="mt-3 text-[15px] text-ink-2">
        <p className="font-medium text-ink">You should come away able to:</p>
        <ul className="mt-1 list-disc pl-5">
          {a.expectedOutcomes.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </div>
      {a.resources.length > 0 && (
        <ul className="mt-3 space-y-1 text-[15px]">
          {a.resources.map((r) => {
            const res = resources.find((x) => x.id === r.id);
            return res ? (
              <li key={r.id}>
                <a href={res.url} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
                  {res.title}
                </a>
                <span className="text-ink-2">
                  {" "}
                  ({res.publisher}). {r.why}
                </span>
              </li>
            ) : null;
          })}
        </ul>
      )}
      <div className="mt-4">
        <label htmlFor={fieldId} className="text-[15px] font-medium">
          Your answer
        </label>
        <textarea
          id={fieldId}
          className="field mt-1 w-full"
          rows={5}
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            setPhase("idle");
          }}
          placeholder="Explain your reasoning, not just the conclusion."
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!answer.trim() || phase === "saving"} onClick={() => void submit()}>
            {phase === "saving" ? "Saving…" : "Save for tonight's review"}
          </button>
          <SessionLink prompt={activityPrompt(a)}>Work through it with Claude</SessionLink>
        </div>
        {phase === "saved" && (
          <p className="meta mt-2" role="status">
            Saved. Claude grades it tonight, and feedback appears here tomorrow.
          </p>
        )}
        {phase === "error" && (
          <p className="mt-2 text-[15px] text-bad" role="alert">
            Couldn&apos;t save. Your answer is still in the box.
          </p>
        )}
      </div>
    </article>
  );
}
