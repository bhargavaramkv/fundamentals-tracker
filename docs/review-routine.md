# Session review routine

An unattended Claude Code session (Sonnet) that reviews pending journal sessions. No API keys: it runs on the owner's subscription, and it is the "reviewer". It writes JSON itself; the scripts validate and publish.

`<data>` below is the data repo checkout (`../fundamentals-tracker-data`). The routine writes only through `npm run journal-review`, and only `journal/reviews/**` and `journal/review-failures/**`. It never writes `journal/sessions/**` or `journal/requests/**`, and never edits the app repo.

## Steps

1. **Pull.** `git -C <data> pull --rebase origin main`.
2. **List the work.** `npm run --silent journal-review -- pending --data <data>`.
   - `pending` is the requests without a review, oldest first.
   - `skipped` explains requests that are ignored (discarded or missing session). Do nothing for those.
   - If `pending` is empty, stop and say so.
3. **For each pending request, oldest first:**
   1. `npm run --silent journal-review -- context <requestId> --data <data>`. The output is self-contained: the session timeline with event ids, the schema, the rules, and prior knowledge (labelled with source and strength).
   2. Write the review JSON to a temporary file outside both repos, following the schema exactly. Act as a thoughtful engineering teacher.
      - Every conclusion needs evidence refs (`{eventId, quote?}`) from this session's timeline.
      - Never fabricate a quote. A quote must be copied exactly from the event's text, or left out.
      - Absence of a concept is not proof of ignorance. Use `missingConcepts` with a question, not a claim.
      - If the evidence is insufficient, set `insufficientEvidence: true`, leave `understood` empty, say so in `explanationQuality`, and ask verification questions.
      - Prior knowledge is context only. Do not cite it as evidence.
      - Set `model` to the model you are. Copy `id`, `sessionId` and `inputHash` from the request.
   3. `npm run --silent journal-review -- commit <requestId> <file.json> --data <data>`.
      - `written` or `exists`: done. Running commit again is safe; a valid existing review is never changed.
      - Exit code 2 prints validation errors and writes nothing. Fix the file and retry, at most 2 times.
      - If it still fails, run `npm run --silent journal-review -- fail <requestId> "<short reason>" --data <data>` and move on.
4. **Summary.** Print one line per request: reviewed, already reviewed, or failed (with the reason), and the skipped ones.

## Answers to earlier verification questions (Retained)
If this session clearly answers, unaided, a verification question that an earlier review asked (the context lists earlier reviews for overlapping topics), add `"verifies": {"requestId": "<earlier review id>", "question": "<exact question text>"}` to that `understood` finding. The commit script rejects it unless that earlier review exists, predates this request and asked exactly that question. This is the only route to Retained, so never set it on a guess: when the answer is partial or prompted, leave `verifies` out and use `incomplete` instead.
