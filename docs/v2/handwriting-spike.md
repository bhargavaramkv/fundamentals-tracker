# Handwriting spike: protocol

Status: **waiting for photos.** No results exist yet, and none are to be assumed.

## Question
Can a Claude Code session read the owner's handwritten study notes well enough to review them? The aim is to
review, not to archive. The answer decides whether a photo upload pipeline is worth building (Phase 2+). That
pipeline stays blocked until the security gate passes (see ARCHITECTURE.md, "Needs approval").

## Input
Five real photos of the owner's handwritten notes, in their usual conditions (phone camera, normal light). They
should include, between them:
1. Dense text with technical terms (e.g. HLD: "consistent hashing", "quorum", "idempotency key").
2. A diagram: boxes and arrows, such as a system design.
3. A page with a known mistake (something written incorrectly).
4. A page that is incomplete (an idea started, then left).
5. A hard page: poor handwriting, a crossed-out part, an angled shot or low light.

The owner also writes a short **ground truth** for each photo: what the page says, which parts are wrong, and which
parts are unfinished. Without it, accuracy cannot be scored.

Photos stay out of the public app repo. Put them in a local folder outside the repo, and share the path in the
session.

## Procedure (per photo, in a Claude Code session)
1. Transcribe it verbatim. Mark unreadable words as `[illegible]`; never guess silently.
2. List the technical terms found.
3. Describe any diagram as nodes and edges.
4. Flag content that looks **incorrect** separately from content that looks **incomplete**.
5. Give a confidence level (high/medium/low) for each section.

## Scoring (against the ground truth)
| Measure | How |
|---|---|
| Transcription | word error rate on a 100-word sample |
| Terminology | terms correct / terms present |
| Diagram | nodes and edges correct / present |
| Incorrect vs incomplete | each planted case classified correctly (yes/no) |
| Illegible handling | marked `[illegible]` rather than invented (count the invented ones) |

## Decision rule
- Go: transcription WER ≤ 10%, terminology ≥ 90%, no invented text, and both planted cases classified.
- Partial: readable but diagrams or classification are unreliable. Go for text only; diagrams need a typed caption.
- No-go: invented text, or WER > 20%. Notes stay typed in the journal.

## Results
_Not run yet._ The limitations are reported first, then the scores, then the decision.
