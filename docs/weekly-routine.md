# Weekly coaching routine

An unattended Claude Code session (Opus) that runs on Mondays for the previous ISO week (Asia/Kolkata). No API keys. It writes JSON itself; the script validates and publishes. It writes only `journal/weekly/<YYYY>-W<ww>.json`, through `npm run weekly`.

`<data>` below is the data repo checkout (`../fundamentals-tracker-data`).

## Steps

1. **Pull.** `git -C <data> pull --rebase origin main`. Make sure the session reviews have run first (`docs/review-routine.md`).
2. **Context.** `npm run --silent weekly -- context --data <data>`. It defaults to the previous complete ISO week; pass `YYYY-Www` to pick another. The output has the computed `activity`, `sufficiency` with its reason, that week's reviews, the session and event ids you may cite, and the previous report.
3. **Write the report** to a temporary file outside both repos:
   - Copy `week`, `sufficiency` and `activity` from the context exactly; the validator rejects any difference.
   - Fields: `v: 1`, `createdAt`, `model`, `improved`, `weak`, `repeatedMisunderstandings`, `revisit`, `learnNext` (each `{concept, text, evidence: [{sessionId, eventId?}]}`), `priorities` (1-2 short strings), and `previousRecommendations` (`{text, followed: "yes"|"no"|"unclear", evidence}`).
   - Judge `previousRecommendations` against the previous report's priorities and the week's evidence. Use `unclear` when you cannot tell.
   - Cite only sessions and events from the context. Never invent evidence.
   - If `sufficiency` is `activity-only`, make no long-term claims: leave `improved`, `weak` and `repeatedMisunderstandings` empty. `revisit` and `learnNext` are allowed only when they cite sessions that have a review.
4. **Commit.** `npm run --silent weekly -- commit <report.json> --data <data>`.
   - `written` or `exists`: done. The same report again is a no-op.
   - A different report for the same week is refused. Use `--replace` only if the owner asked to redo the week.
   - Exit code 2 prints validation errors and writes nothing. Fix and retry at most 2 times, then stop and report the errors.
5. **Summary.** One line: the week, `sufficiency`, and the priorities.
