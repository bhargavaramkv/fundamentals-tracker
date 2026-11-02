"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RadarFeed, RadarListItem } from "@/lib/radar/types";

/**
 * The site is a static export, so stories baked in at build time can only be as new as the last deploy. feed.json is a
 * public, secret-free file the ingest job writes to the radar-data branch; reading it at runtime means a slow or failed
 * deploy doesn't leave readers on old news, and a page left open keeps up. If it can't be fetched, the build's copy is
 * shown and the page says so.
 */
const FEED_URL =
  process.env.NEXT_PUBLIC_RADAR_FEED_URL ?? "https://raw.githubusercontent.com/bhargavaramkv/fundamentals-tracker/radar-data/feed.json";
const RECHECK_MS = 30 * 60_000;

export type LiveStatus = "checking" | "live" | "unavailable";

function isFeed(raw: unknown): raw is RadarFeed {
  const f = raw as Partial<RadarFeed> | null;
  return (
    !!f &&
    f.version === 1 &&
    Array.isArray(f.items) &&
    Array.isArray(f.briefing) &&
    f.items.every((i) => typeof i?.id === "string" && typeof i?.title === "string" && typeof i?.url === "string" && i.url.startsWith("https://"))
  );
}

/** Live stories replace built ones with the same id; stories only the build has (older history) are kept. */
export function mergeFeeds(build: RadarFeed, live: RadarFeed | null): RadarFeed {
  if (!live) return build;
  // A cached or older live file must not roll the page back past what the build already knows.
  if (live.lastSuccessAt && build.lastSuccessAt && live.lastSuccessAt < build.lastSuccessAt) return build;
  const byId = new Map<string, RadarListItem>(build.items.map((i) => [i.id, i]));
  for (const i of live.items) byId.set(i.id, i);
  return { ...live, items: [...byId.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) };
}

// Shared across components on a page, so Today and the feed don't each fetch.
let lastFetch: { at: number; promise: Promise<RadarFeed | null> } | null = null;

function fetchFeed(force: boolean): Promise<RadarFeed | null> {
  if (!force && lastFetch && Date.now() - lastFetch.at < RECHECK_MS) return lastFetch.promise;
  const promise = fetch(FEED_URL, { cache: "no-cache" })
    .then(async (res) => {
      if (!res.ok) return null;
      const raw: unknown = await res.json();
      return isFeed(raw) ? raw : null;
    })
    .catch(() => null);
  lastFetch = { at: Date.now(), promise };
  return promise;
}

export function useLiveRadar(build: RadarFeed) {
  const [live, setLive] = useState<RadarFeed | null>(null);
  const [status, setStatus] = useState<LiveStatus>("checking");

  const load = useCallback((force: boolean) => {
    void fetchFeed(force).then((feed) => {
      setLive((prev) => feed ?? prev);
      setStatus(feed ? "live" : "unavailable");
    });
  }, []);

  useEffect(() => {
    load(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const feed = useMemo(() => mergeFeeds(build, live), [build, live]);
  const refresh = useCallback(() => {
    setStatus("checking");
    load(true);
  }, [load]);
  return { feed, status, refresh };
}
