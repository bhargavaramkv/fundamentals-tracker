"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { allKeys, doneTopics, streak, trackKeys } from "@/lib/curriculum";
import type { Curriculum, WorkspaceSummary } from "@/lib/types";
import { BrandMark } from "./BrandMark";
import { DomainIcon, domainColor } from "./DomainIcon";
import { Icon, PRIMARY, isActive } from "./Nav";
import { Flame } from "./ProgressRing";
import { useProgress } from "./ProgressProvider";
import { useNow } from "./useNow";

/** Left sidebar from lg up: the three destinations, every track with its progress, streak and settings. */
export function Sidebar({ curriculum, workspaces }: { curriculum: Curriculum; workspaces: Record<string, WorkspaceSummary> }) {
  const pathname = usePathname();
  const { data, ready, syncState } = useProgress();
  const now = useNow();
  const loaded = ready && now !== null;
  const done = loaded ? doneTopics(allKeys(curriculum), data, workspaces, now) : new Set<string>();
  const days = loaded ? streak(data, now) : null;
  const settingsActive = pathname.startsWith("/settings");
  const syncError = syncState === "error";

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg pt-[env(safe-area-inset-top)] lg:flex">
      <Link href="/" className="px-6 pb-4 pt-6 font-semibold tracking-tight" aria-label="Fundamentals, go to the home page">
        <BrandMark />
      </Link>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <nav aria-label="Main" className="space-y-1 text-sm">
          {PRIMARY.map((l) => {
            const active = isActive(pathname, l);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 font-bold transition-colors ${active ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
              >
                {l.icon}
                {l.label}
              </Link>
            );
          })}
        </nav>
        <nav aria-label="Tracks">
          <p className="eyebrow px-3 pb-2">Tracks</p>
          <ul className="space-y-0.5">
            {curriculum.tracks.map((t) => {
              const keys = trackKeys(t);
              const k = keys.filter((x) => done.has(x)).length;
              const active = pathname.startsWith(`/learn/${t.domain}`);
              return (
                <li key={t.domain}>
                  <Link
                    href={`/learn/${t.domain}/`}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-xl px-3 py-2 transition-colors ${active ? "bg-surface-2" : "hover:bg-surface-2"}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <DomainIcon domain={t.domain} size={24} />
                      <span className={`min-w-0 flex-1 text-[13px] font-bold leading-tight ${active ? "text-ink" : "text-ink-2"}`}>{t.title}</span>
                      <span className="meta tabular-nums">
                        {k}/{keys.length}
                      </span>
                    </span>
                    <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full" style={{ width: `${keys.length ? (k / keys.length) * 100 : 0}%`, background: domainColor(t.domain) }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {days !== null ? (
          <span className="flex items-center gap-1 text-sm font-extrabold tabular-nums" title={`${days}-day streak`}>
            <Flame lit={days > 0} />
            <span className={days > 0 ? "text-accent-2" : "text-ink-3"}>{days}</span>
            <span className="sr-only">day streak</span>
          </span>
        ) : (
          <span />
        )}
        <Link
          href="/settings/"
          aria-label={syncError ? "Settings (sync error)" : "Settings"}
          aria-current={settingsActive ? "page" : undefined}
          className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${settingsActive ? "text-ink" : "text-ink-3 hover:text-ink"}`}
        >
          <Icon>
            <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
          </Icon>
          {syncError && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-bad" />}
        </Link>
      </div>
    </aside>
  );
}
