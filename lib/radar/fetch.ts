export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface FetcherOptions {
  userAgent: string;
  /** Minimum gap between requests to the same host. */
  minIntervalMs: number;
  timeoutMs: number;
  /** Extra attempts after the first, for network errors, 429 and 5xx. */
  retries: number;
  /** Sent only to api.github.com (raises the anonymous 60/hour limit). */
  githubToken?: string;
  maxBytes: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export type FetchText = (url: string, accept?: string) => Promise<string>;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** HTTP GET with per-host rate limiting, timeouts, size cap and exponential backoff that honours Retry-After. */
export function createFetcher(opts: FetcherOptions): FetchText {
  const sleep = opts.sleep ?? defaultSleep;
  const doFetch = opts.fetchImpl ?? fetch;
  const nextSlot = new Map<string, number>();

  async function throttle(host: string) {
    const now = Date.now();
    const at = Math.max(now, nextSlot.get(host) ?? 0);
    nextSlot.set(host, at + opts.minIntervalMs);
    if (at > now) await sleep(at - now);
  }

  return async (url, accept = "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8, */*;q=0.5") => {
    const host = new URL(url).hostname;
    let lastErr: HttpError = new HttpError("not attempted");
    for (let attempt = 0; attempt <= opts.retries; attempt++) {
      await throttle(host);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
      try {
        const headers: Record<string, string> = { "User-Agent": opts.userAgent, Accept: accept };
        if (host === "api.github.com") {
          headers.Accept = "application/vnd.github+json";
          if (opts.githubToken) headers.Authorization = `Bearer ${opts.githubToken}`;
        }
        const res = await doFetch(url, { headers, signal: ctrl.signal, redirect: "follow" });
        if (res.ok) {
          const body = await res.text();
          if (body.length > opts.maxBytes) throw new HttpError(`response larger than ${opts.maxBytes} bytes`);
          return body;
        }
        lastErr = new HttpError(`HTTP ${res.status}`, res.status);
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt === opts.retries) throw lastErr;
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : 1000 * 3 ** attempt);
      } catch (err) {
        if (err instanceof HttpError && (err.status === undefined ? err.message.startsWith("response larger") : !(err.status === 429 || err.status >= 500))) throw err;
        lastErr = err instanceof HttpError ? err : new HttpError((err as Error).name === "AbortError" ? `timed out after ${opts.timeoutMs}ms` : `network error: ${(err as Error).message}`);
        if (attempt === opts.retries) throw lastErr;
        await sleep(1000 * 3 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  };
}
