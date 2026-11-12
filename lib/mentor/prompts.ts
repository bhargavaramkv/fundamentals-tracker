import type { SessionReview } from "@/lib/review/types";

/** Prompt for running one pending review in Claude Code, with the app and data repos cloned side by side. */
export function reviewNowPrompt(requestId: string): string {
  return `In fundamentals-tracker, run: npm run --silent journal-review -- context ${requestId} --data ../fundamentals-tracker-data, then follow docs/review-routine.md for this one request only.`;
}

const bullets = (items: string[]) => (items.length ? items.map((t) => `- ${t}`).join("\n") : "- (none)");

/** Context prompt for discussing a review with Claude as a Socratic teacher. No chat happens in the app. */
export function discussPrompt(review: SessionReview, session: { subject: string; topics: string[] }): string {
  const f = (title: string, list: { concept: string; text: string }[]) => `${title}:\n${bullets(list.map((x) => `${x.concept}: ${x.text}`))}`;
  return [
    "Act as a Socratic engineering teacher. Below is a review of one of my learning sessions. Ask me the verification questions one at a time, wait for my answer, and say what is right, what is missing and why before moving on. Do not give answers up front.",
    "",
    `Session: ${session.subject}${session.topics.length ? ` (topics: ${session.topics.join(", ")})` : ""}`,
    `Review summary: ${review.summary}`,
    "",
    f("Understood", review.understood),
    f("Misunderstandings", review.misunderstandings),
    f("Incomplete", review.incomplete),
    f("Claims without evidence", review.unsupportedClaims),
    `Worth checking:\n${bullets(review.missingConcepts.map((m) => `${m.concept}: ${m.text} (${m.question})`))}`,
    "",
    `Verification questions:\n${review.verificationQuestions.map((q, i) => `${i + 1}. [${q.concept}] ${q.question}`).join("\n")}`,
  ].join("\n");
}
