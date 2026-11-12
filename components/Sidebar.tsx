"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { Icon, PRIMARY, isActive } from "./Nav";
import { useProgress } from "./ProgressProvider";

/** Left sidebar from lg up: the four destinations, sync status and settings. */
export function Sidebar() {
  const pathname = usePathname();
  const { syncState, storeKind } = useProgress();
  const settingsActive = pathname.startsWith("/settings");
  const syncError = syncState === "error";
  const label = storeKind === "local" ? "Local only" : syncState === "syncing" ? "Syncing…" : syncError ? "Sync error" : "Synced";
  const dot = storeKind === "local" ? "bg-ink-3" : syncError ? "bg-bad" : syncState === "syncing" ? "bg-accent" : "bg-good";

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg pt-[env(safe-area-inset-top)] lg:flex">
      <Link href="/" className="px-6 pb-5 pt-7 text-lg font-semibold tracking-tight" aria-label="Fundamentals, go to the home page">
        <BrandMark />
      </Link>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <nav aria-label="Main" className="space-y-1">
          {PRIMARY.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(pathname, l) ? "page" : undefined} className="nav-link">
              {l.icon}
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <span className="meta flex items-center gap-2" role="status">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {label}
        </span>
        <Link
          href="/settings/"
          aria-label={syncError ? "Settings (sync error)" : "Settings"}
          aria-current={settingsActive ? "page" : undefined}
          className={`relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${settingsActive ? "text-accent-text" : "text-ink-3 hover:text-ink"}`}
        >
          <Icon>
            <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
          </Icon>
          {syncError && <span aria-hidden className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-bad" />}
        </Link>
      </div>
    </aside>
  );
}
