"use client";

import { useEffect, useRef } from "react";
import type { Domain } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

/** Visible time on a lesson before it counts as "read". */
const MIN_READ_MS = 20_000;

/**
 * Logs a lesson read once the page has been visible for long enough. Time only
 * accrues while the tab is visible, and the visit is saved when you leave the
 * page or switch away, so readings sync and can trigger analysis.
 */
export function LessonReadTracker({ domain, topic }: { domain: Domain; topic: string }) {
  const { commitRead, ready } = useProgress();
  const commitRef = useRef(commitRead);

  useEffect(() => {
    commitRef.current = commitRead;
  }, [commitRead]);

  useEffect(() => {
    if (!ready) return;
    const openedAt = new Date().toISOString();
    const id = crypto.randomUUID();
    let visibleMs = 0;
    let since = document.visibilityState === "visible" ? performance.now() : null;
    let saved = false;

    const save = () => {
      if (since !== null) {
        visibleMs += performance.now() - since;
        since = null;
      }
      if (saved || visibleMs < MIN_READ_MS) return;
      saved = true;
      void commitRef.current({ id, domain, topic, openedAt, durationMs: Math.round(visibleMs) });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
      else if (since === null && !saved) since = performance.now();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [ready, domain, topic]);

  return null;
}
