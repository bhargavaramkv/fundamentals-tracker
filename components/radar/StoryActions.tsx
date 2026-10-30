"use client";

import { useEffect } from "react";
import { useRadarPrefs } from "./prefs";
import { BookmarkIcon } from "./RadarFeed";

/** Opening a story marks it read; the reader can bookmark it or put it back to unread. */
export function StoryActions({ id }: { id: string }) {
  const { prefs, markRead, toggleBookmark } = useRadarPrefs();
  useEffect(() => markRead(id), [id, markRead]);
  const saved = Boolean(prefs.bookmarks[id]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => toggleBookmark(id)} aria-pressed={saved} className="btn btn-secondary">
        <span className={saved ? "text-accent-text" : undefined}>
          <BookmarkIcon filled={saved} />
        </span>
        {saved ? "Bookmarked" : "Bookmark"}
      </button>
      {prefs.read[id] && (
        <button type="button" onClick={() => markRead(id, false)} className="btn btn-ghost btn-muted">
          Mark unread
        </button>
      )}
    </div>
  );
}
