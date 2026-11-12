# Recovery

What to do when something goes wrong. Nothing here deletes journal data. See [ARCHITECTURE.md](ARCHITECTURE.md) for the design.

`<data>` is a checkout of the private data repo (`../fundamentals-tracker-data`).

## A review failed or is missing

A request with no review file is pending. The Mentor page lists pending requests and any failures.

1. Look at `journal/review-failures/<requestId>.json` in the data repo. It is a list of `{at, error}` entries.
2. Do nothing else: the request stays pending, and the next run of the review routine retries it.
3. To retry now, run the routine by hand in Claude Code. The Mentor page's "Review now" button copies the prompt. It runs `npm run --silent journal-review -- context <requestId> --data <data>` and then follows `docs/review-routine.md`.
4. If it fails again, read the errors. They name the field or quote that was rejected. Nothing is written until a review passes validation.
5. A request is skipped, not failed, when its session is discarded or missing. A request is created only when a session ends; the app has no separate "request review" button.

## A sync conflict

A session shows "needs attention" when its GitHub copy cannot be merged safely (unreadable file, or events without a valid id, time or device). The local copy is intact and nothing was overwritten.

1. Open the session in Journal and open the conflict panel. It shows the local and GitHub copies and which events exist on only one side. It writes nothing.
2. Pick **Retry sync** if you fixed the GitHub file by hand. The app re-reads and re-merges it.
3. Pick **Keep both and repair** otherwise. The app:
   - copies the current GitHub file to `journal/conflicts/<sessionId>/<sha>.json` in the data repo (`<sha>` is that file's blob sha), then
   - overwrites the original with your events plus every parseable event from GitHub.
4. If the backup step fails, nothing else changes. If the overwrite fails, the backup stays and the conflict stays flagged; try again.
5. To get the old file back, copy `journal/conflicts/<sessionId>/<sha>.json` over the session file, or read it for the events that could not be merged.

## A lost device key

The device key lives in IndexedDB (`ft-secure`) and cannot be exported. If site data was cleared, the browser changed, or the 30 days ran out, the device is signed out.

1. Sign in again with the username and password. This creates a new key and re-seals the sync token.
2. The journal is in a different IndexedDB database (`ft-journal`). Sign-in does not touch it. If site data was cleared too, sessions that had synced come back on the next pull. Sessions that had not synced, and all photos, were only on that device and are lost.
3. If the token was rejected, paste a new one in Settings. Changing it for all devices asks for the password.
4. If sign-in fails everywhere after a password reset, that is expected: a reset signs every device out. Use the new password.

## Roll back a release

The V1 app is tagged `v1-legacy`.

1. Find the merge commit of the release on `main` (`git log --merges main`).
2. Create a branch, run `git revert -m 1 <merge-sha>`, and open a PR. Merge it when CI is green.
3. The deploy workflow runs on every push to `main`, so Pages redeploys. Confirm the run succeeded and load the site.
4. To go back to the full V1 app instead, branch from `v1-legacy` and merge that through a PR the same way. The data repo is not affected: V1 ignores `journal/**`, `knowledge/**` and the other V2 files.

Reverting the app never changes data repo files. Reviews, weekly reports and evidence stay where they are.

## Re-run the knowledge migration

`npm run --silent knowledge-migrate -- --data <data>` is a dry run. It prints counts and writes nothing. `npm run --silent knowledge-migrate -- commit --data <data>` writes `knowledge/evidence.json`.

It is idempotent. Item ids come from their sources (`mig:mcq:<answerId>`, `mig:mentor:<entryId>`). Existing items are never changed, new ids are appended, and with unchanged sources the commit writes nothing and reports `unchanged`. It is safe to re-run after a failure or after new source data arrives.

## Resume the V2 work

Paste this in Claude Code, in the app repo:

```
Continue Fundamentals V2 from progress.md. Read execution-log.md, verify the latest checkpoint and continue with the next unfinished task.
```

`progress.md` has the checklist and the architecture decisions. `execution-log.md` has what was done at each checkpoint.
