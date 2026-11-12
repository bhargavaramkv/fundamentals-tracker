# V2 data contracts

JSON shapes of the files in the private data repo. The TypeScript types are the source of truth; each section names the file. See [ARCHITECTURE.md](ARCHITECTURE.md) for who writes what.

All times are ISO 8601 strings. All files are UTF-8 JSON. A `v` field is the schema version.

## Session: `journal/sessions/YYYY/MM/<id>.json`

Types: `lib/journal/types.ts` (`JournalSession`, `SessionEvent`, `SessionSource`). Parser: `parseSession` in `lib/journal/events.ts`. Writer: browser.

```json
{
  "v": 1,
  "id": "string",
  "createdAt": "ISO time (UTC; fixes the path)",
  "device": "string",
  "subject": "string",
  "source": { "kind": "atlas|docs|book|course|video|article|leetcode|other", "title": "string (optional)" },
  "objective": "string (optional)",
  "events": [ { "id": "string", "at": "ISO time", "device": "string", "kind": "...", "...": "per kind" } ]
}
```

Events are sorted by `(at, id)` and merged by `id`. Every event has `id`, `at`, `device` and `kind`. Fields by kind:

| kind | extra fields |
|---|---|
| `start`, `pause`, `resume`, `discard` | none |
| `topic`, `note`, `difficulty` | `text` |
| `bookmark` | `label`, `activeMs` |
| `end` | `learned?`, `difficult?`, `unclear?` |
| `edit` | `target` (id of an earlier event), `text` (empty hides it) |
| `meta` | `subject?`, `objective?`, `source?` (latest per field wins) |
| `attach` | `attachmentId`, `mime`, `width`, `height`, `bytes`, `sha256`, `name?` |

Events with an unknown `kind` are kept verbatim and ignored when deriving. An event without a usable `id`, `at` or `device` makes the remote file a conflict.

## Review request: `journal/requests/<sessionId>/<requestId>.json`

Type: `ReviewRequest` in `lib/journal/types.ts`. Writer: browser. Create-only.

```json
{ "v": 1, "id": "string", "sessionId": "string", "requestedAt": "ISO time", "device": "string", "inputHash": "sha256 hex of the session's canonical JSON" }
```

## Conflict backup: `journal/conflicts/<sessionId>/<sha>.json`

Writer: browser (`resolveConflict` in `lib/journal/sync.ts`; path from `conflictBackupPath`). The content is the exact text of the GitHub session file whose blob sha is `<sha>`, so it normally has the session shape above, but it may be unreadable or invalid, which is why it was backed up. Create-only.

## Review: `journal/reviews/<sessionId>/<requestId>.json`

Types: `lib/review/types.ts` (`SessionReview`, `Finding`, `MissingConcept`, `EvidenceRef`). Validator: `lib/review/validate.ts`. Writer: `npm run journal-review -- commit`.

```json
{
  "v": 1,
  "id": "requestId",
  "sessionId": "string",
  "inputHash": "copied from the request",
  "createdAt": "ISO time",
  "model": "string",
  "summary": "string, at most 2000 characters",
  "understood": [ { "concept": "string", "text": "string", "evidence": [ { "eventId": "string", "quote": "exact substring (optional)" } ], "verifies": { "requestId": "string", "question": "string" } } ],
  "misunderstandings": [ "Finding" ],
  "incomplete": [ "Finding" ],
  "unsupportedClaims": [ "Finding" ],
  "missingConcepts": [ { "concept": "...", "text": "...", "evidence": [], "question": "string" } ],
  "explanationQuality": { "level": "clear|partial|unclear|insufficient-evidence", "note": "string", "evidence": [ "EvidenceRef" ] },
  "learningBehaviour": { "observations": [ "Finding" ], "improvements": [ "string, 0-5" ] },
  "nextSteps": [ "string, 1-5" ],
  "verificationQuestions": [ { "concept": "string", "question": "string" } ],
  "insufficientEvidence": false,
  "sessionChangedSinceRequest": true
}
```

- A `Finding` is `{ concept, text, evidence }`. Evidence has 1-5 refs (0-5 for `missingConcepts`, and for `explanationQuality` when the level is `insufficient-evidence`).
- `verifies` is allowed only on `understood`.
- `verificationQuestions` has 1-5 items.
- `sessionChangedSinceRequest` is set by the commit script, only when true.
- `understood` must be empty when `insufficientEvidence` is true.

## Review failure: `journal/review-failures/<requestId>.json`

Writer: `recordFailure` in `lib/review/data.ts`. Type: `ReviewFailure` in `lib/mentor/parse.ts` (read side). An append-only array:

```json
[ { "at": "ISO time", "error": "string" } ]
```

## Weekly report: `journal/weekly/<YYYY>-W<ww>.json`

Types: `lib/review/weekly.ts` (`WeeklyReport`, `WeeklyActivity`, `WeeklyFinding`, `WeeklyCite`). Validator: `validateWeekly`. Writer: `npm run weekly -- commit`.

```json
{
  "v": 1,
  "week": "2026-W46",
  "createdAt": "ISO time",
  "model": "string",
  "sufficiency": "coaching|activity-only",
  "activity": {
    "week": "2026-W46", "sessions": 0, "endedSessions": 0, "activeMinutes": 0, "topics": ["string"], "difficultyEvents": 0, "reviews": 0,
    "findings": { "understood": 0, "misunderstandings": 0, "incomplete": 0, "unsupportedClaims": 0, "missingConcepts": 0 }
  },
  "improved": [ { "concept": "string", "text": "string", "evidence": [ { "sessionId": "string", "eventId": "string (optional)" } ] } ],
  "weak": [ "WeeklyFinding" ],
  "repeatedMisunderstandings": [ "WeeklyFinding" ],
  "revisit": [ "WeeklyFinding" ],
  "learnNext": [ "WeeklyFinding" ],
  "priorities": [ "string, 1-2" ],
  "previousRecommendations": [ { "text": "string", "followed": "yes|no|unclear", "evidence": [ "WeeklyCite" ] } ]
}
```

`week`, `sufficiency` and `activity` must equal the values the script computes. Weeks are ISO weeks in Asia/Kolkata.

## Knowledge evidence: `knowledge/evidence.json`

Types: `lib/knowledge/types.ts` (`EvidenceFile`, `Evidence`). Mapping: `lib/knowledge/migrate.ts`. Writer: `npm run knowledge-migrate -- commit`.

```json
{
  "v": 1,
  "generatedBy": "scripts/knowledge-migrate.ts",
  "items": [
    {
      "id": "mig:mcq:<answerId> | mig:mentor:<entryId>",
      "concept": "lowercase, trimmed, single spaces",
      "label": "string",
      "subject": "string (optional)",
      "kind": "mcq-answer|written-explanation|review-finding|practical|delayed-check",
      "signal": "exposed|correct|incorrect|misconception|applied",
      "strength": "weak|moderate|strong",
      "at": "ISO time",
      "source": { "repo": "data", "path": "string", "ref": "string" },
      "historical": true,
      "note": "string (optional)"
    }
  ]
}
```

Items are sorted by `id` and never changed once written. Levels are not in the file: `levelOf` in `lib/knowledge/levels.ts` computes them and returns `{ level: none|exposed|understood|applied|retained, reasons, needsReassessment, dueForVerification, contradictions }`. Review-derived evidence has ids `rev:<requestId>:<n>` and is not stored.

## Coding review: `mentor/coding.json`

Type: `CodingAnalysis` (extends `CodingReview`) in `lib/leetcode-history.ts`. Writer: `npm run coding-review -- commit`.

```json
{
  "version": 1, "generatedAt": "ISO time", "reviewedIds": ["string"],
  "forDate": "YYYY-MM-DD", "headline": "string (optional on old files)", "trend": { "direction": "improving|steady|slipping|unclear", "note": "string" },
  "summary": "string",
  "focus": [ { "title": "string", "why": "string" } ],
  "mistakes": [ { "pattern": "string", "detail": "string", "check": "string", "problems": ["string"] } ],
  "nextProblems": [ { "slug": "string", "title": "string", "why": "string" } ],
  "reviews": [ { "slug": "string", "title": "string", "verdict": "good|improve|struggling", "note": "string" } ]
}
```

## Learner profile: `learner/profile.json`

Type: `LearnerProfile` in `lib/learner.ts` (validator `validateLearnerProfile`). Writer: `npm run learner`.

```json
{
  "updatedAt": "ISO time", "analysedThrough": "ISO time", "headline": "string, at most 200 characters",
  "patterns": [ { "label": "string", "note": "string" } ],
  "interests": ["string"], "strengths": ["string"],
  "struggles": [ { "topic": "string", "misconception": "string" } ],
  "nextUp": [ { "topic": "string", "why": "string" } ],
  "adaptations": [ { "date": "string", "topic": "string", "change": "string", "why": "string" } ],
  "notes": "string, at most 4000 characters"
}
```

List lengths are limited by `validateLearnerProfile`.
