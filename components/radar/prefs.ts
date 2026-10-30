"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Bookmarks and read state for Tech Radar stories. Kept in this browser's localStorage, separate from the synced
 * progress file so the progress schema and its merge rules stay untouched.
 */
const KEY = "ft.radar.v1";

interface Prefs {
  read: Record<string, string>;
  bookmarks: Record<string, string>;
}

const EMPTY: Prefs = { read: {}, bookmarks: {} };
let snapshot: Prefs | null = null;
const listeners = new Set<() => void>();

function load(): Prefs {
  if (snapshot) return snapshot;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    snapshot = { read: raw?.read ?? {}, bookmarks: raw?.bookmarks ?? {} };
  } catch {
    snapshot = { ...EMPTY };
  }
  return snapshot;
}

function save(next: Prefs) {
  snapshot = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory state for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRadarPrefs() {
  const prefs = useSyncExternalStore(subscribe, load, () => EMPTY);
  const markRead = useCallback((id: string, read = true) => {
    const cur = load();
    if (Boolean(cur.read[id]) === read) return;
    const nextRead = { ...cur.read };
    if (read) nextRead[id] = new Date().toISOString();
    else delete nextRead[id];
    save({ ...cur, read: nextRead });
  }, []);
  const toggleBookmark = useCallback((id: string) => {
    const cur = load();
    const bookmarks = { ...cur.bookmarks };
    if (bookmarks[id]) delete bookmarks[id];
    else bookmarks[id] = new Date().toISOString();
    save({ ...cur, bookmarks });
  }, []);
  return { prefs, markRead, toggleBookmark };
}
