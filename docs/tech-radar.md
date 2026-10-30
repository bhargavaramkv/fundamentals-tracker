# Tech Radar

The radar finds important technology developments every day, ranks them, and explains each one through the engineering
fundamentals behind it. It sits next to **News**, which holds hand-written incident deep-dives and works as before.

## Architecture

```text
07:00 IST  .github/workflows/radar.yml (cron 30 1 * * *, or Run workflow)
  ingest job
    checkout main  +  radar-data branch as a worktree at content/radar
    npm run radar -- ingest
      fetch      43 sources (lib/radar/sources.ts): RSS/Atom/RDF, GitHub releases, CISA KEV JSON
                 4 at a time, ≥1.5 s between requests to the same host, 20 s timeout, 8 MB cap,
                 2 retries with backoff (Retry-After honoured) on network errors, 429 and 5xx
      parse      lib/radar/feeds.ts (malformed or non-feed documents fail that source only)
      merge      lib/radar/merge.ts  dedupe · update detection · corroboration
      rank       lib/radar/rank.ts   explainable 0-100 score
      analyse    lib/radar/analyze.ts  Claude (structured JSON output), at most 10 per run
      validate   lib/radar/validate.ts  invalid output is never stored
      store      lib/radar/store.ts  stories/YYYY-MM.json, state.json, runs/YYYY-MM.json
    npm run radar -- check  (validates every stored story)
    commit + push to radar-data
  deploy job  →  deploy.yml (workflow_call): fetches radar-data into content/radar, builds, publishes to Pages

Static site (no server)
  /radar/                  briefing, filters, search, date range, bookmarks, read/unread, freshness, source health
  /radar/<id>/             full story: source facts, company claims, labelled AI analysis, lessons, sources, score
  /radar/weekly/           weekly roundup (top 7 per week, 26 weeks)
  /radar/archive/YYYY-MM/  every story in a month, for history beyond the feed's 180 days
```

Why it's built this way:

- **The data never touches `main`.** It's generated content, written every day. The `radar-data` branch keeps its full
  history in git without daily PRs, and the PR policy for `main` stays as it is. `content/radar/` is gitignored on
  `main`.
- **Same stack and hosting.** The site is still a static export. Story pages are generated at build time, and the radar
  workflow triggers a deploy after each ingest.
- **Two new dev dependencies, used only by the pipeline script:** `fast-xml-parser`, a strict XML parser and validator
  (regex parsing of feeds is fragile), and `@anthropic-ai/sdk` for the analysis calls. Neither ships in the site bundle.

## Data model (`lib/radar/types.ts`)

Each `RadarStory` stores:

- `canonicalUrl` and `sources[]`. The primary source comes first, followed by corroborating reports, each with its own
  original URL, title, date and credibility tier.
- `publishedAt`, the source's original publication date. When a feed gives no date, the time the story was found is
  used instead and `dateEstimated` is set.
- `firstSeenAt` and `lastSeenAt`.
- `updatedAt` and `revisions[]`, a history of edits made by the source.
- `contentHash`, used to detect edits.
- `minor`, set for patch releases and digests.
- `score {total, parts[]}`, the ranking with a reason for every point.
- `importance`.
- `status`: `analysed`, `pending`, `below-threshold` or `failed`.
- `analysis`, an optional `RadarAnalysis` with provenance: `model`, `generatedAt`, `basedOn`.

## Deduplication and updates

| Situation | Result |
|---|---|
| Same canonical URL (https, no `www.`, tracking params stripped, sorted query, no trailing slash) and same text | Unchanged. Only `lastSeenAt` moves, and nothing is republished. |
| Same URL with edited title or text | A revision is recorded, `updatedAt` is set and the story is queued for re-analysis. The old analysis stays visible until the new one is ready. |
| Different URL, same event (shared CVE/GHSA id, or ≥0.6 title similarity within 3 days) | Added as a corroborating source on the existing story, which earns a corroboration bonus. |
| Published more than 7 days before discovery | Ignored, so a new source doesn't flood the feed with backfill. |
| Otherwise | New story. Its id is `YYYY-MM-DD-slug-<6 hex of URL hash>`, which is stable. |

## Ranking (`lib/radar/rank.ts`)

The score is the sum of the parts listed below, clamped to the range 0-100. Every story page shows the breakdown under
**Why it ranks here**.

| Part | Points |
|---|---|
| Baseline | +15 |
| Source credibility | +20 primary (vendor or project), +14 publication or research venue, +8 aggregator |
| Corroboration | +8 per extra independent host, up to +16 |
| Significance | +15 major (launch, GA, open-sourced, acquisition, actively exploited, x.0 release…), +5 incremental |
| Exploitation | +12 if listed in CISA KEV |
| Engineering relevance | +3 per stack or fundamentals term touched, up to +15 |
| Freshness | +5 if published within 36 h of discovery, −5 if more than 4 days before |
| Minor update | −20 for patch releases, release candidates, digests, webinars and similar |
| AI-rated significance | (technical + practical) × 3 − 12, so −6 to +18, after analysis |

Importance bands: **High** ≥65, **Notable** ≥45, otherwise Routine. Only stories that are not minor and score ≥40 are
analysed, at most 10 per run, highest score first. The rest are kept for history (`below-threshold`). Minor updates are
hidden from the feed unless **Include minor updates** is ticked.

## Analysis and truthfulness

- **Model:** `claude-opus-5-5` with structured JSON output, using the schema in `lib/radar/analyze.ts`. Server-side
  fallback is enabled for refusals, and effort is `medium`.
- **Input:** the model receives only the feed excerpt, the fetched article text (when the page could be fetched) and the
  corroborating headlines. It is told not to add facts beyond that text and to explain any gaps under `limitations`.
- **Facts and claims are separated:** `sourceFacts` are things the source states, and `companyClaims` are vendor
  assertions. The story page shows both under **From the source**. The rest appears under **Analysis**, labelled
  "AI-generated" with the model name.
- **Lesson links:** `relatedTopics` may only use existing lesson keys. Invented keys are dropped.
- **Validation:** if output is missing sections, has out-of-range ratings, has no facts, gets refused or is truncated, it
  is rejected. The story stays `pending` and is retried on the next run, up to 3 attempts, after which it becomes
  `failed`. A partial analysis is never published.
- **Without an API key:** stories are still ingested, ranked and published with **Analysis pending**. The run log and a
  workflow warning say why.

## Reliability and visibility

- A failing source affects only itself. Its error, consecutive-failure count and last success are kept in `state.json`
  and shown on `/radar/` under **N sources failing**.
- **Exit codes:**
  - **0:** at least half the sources succeeded.
  - **1:** more than half failed. The data is still committed, but the job goes red and the deploy is skipped.
  - **2:** every source failed. Nothing is written.
- Every error becomes a `::warning` annotation, and each run writes a summary table to the Actions run page and appends
  an entry to `runs/YYYY-MM.json`.
- **Freshness:** `/radar/` shows the last successful update. It turns amber and says *stale* when that is more than 30
  hours old, and shows a failed last attempt in red.

## Operating it

One-time setup (owner):

1. **Settings → Secrets and variables → Actions → New repository secret:** add `ANTHROPIC_API_KEY`. Without it the radar
   runs but doesn't analyse. Cost is roughly 10 analyses a day at about 6k input and 3k output tokens each, around
   $0.80 per day at Opus 5.5 rates. Lower it with the `max_analyses` input or the `RADAR_MAX_ANALYSES` default in the
   workflow.
2. **Settings → Actions → General:** make sure Actions may run, and that workflows have **Read and write permissions**.
   The ingest job pushes to `radar-data`.
3. **Actions → Tech Radar → Run workflow** for the first run. After that it runs daily at 07:00 IST.

Commands:

```bash
npm run radar -- ingest --data content/radar                    # full run (needs network; ANTHROPIC_API_KEY optional)
npm run radar -- ingest --data /tmp/r --fixtures tests/fixtures/radar --sources openai,go-blog --now 2026-10-30T01:30:00Z
npm run radar -- check  --data content/radar                    # validate stored stories
npm run radar -- pending --data content/radar --limit 5         # analysis queue + prompts as JSON
npm run radar -- apply  --data content/radar --file a.json      # store analyses written elsewhere (validated the same way)
```

To preview locally with real data:
`git fetch origin radar-data && mkdir -p content/radar && git archive origin/radar-data | tar -x -C content/radar`.

Adding a source is a single entry in `lib/radar/sources.ts`. Mixed-topic publications go in `MIXED_SOURCES` so that each
story is categorised by its own text.

## Reader state

Bookmarks and read/unread live in this browser's `localStorage` (`ft.radar.v1`). They are deliberately kept out of the
synced progress file, so its schema and append-only merge are unchanged. They don't sync across devices.

## Tests

`tests/radar.test.ts` covers:

- feed parsing: RSS, Atom, GitHub releases, KEV, malformed and future-dated input;
- URL canonicalisation and deduplication;
- update detection and corroboration;
- the lookback window;
- score explainability;
- analysis validation, including dropped invented lesson links;
- the pipeline end-to-end on fixtures: partial source failure, no republishing on a second run, analysis provenance and
  retry limits;
- the fetcher: retry, backoff, Retry-After, size cap and per-host spacing;
- storage round-trip.
