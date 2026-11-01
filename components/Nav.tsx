"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { useProgress } from "./ProgressProvider";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {children}
    </svg>
  );
}

const SETTINGS_ICON = (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);

/** The sections. Everything else (practice rounds, the baseline, the fun corner) lives under one of them. */
const LINKS: { href: string; label: string; short: string; match: string[]; icon: ReactNode }[] = [
  {
    href: "/mentor/",
    label: "Mentor",
    short: "Mentor",
    match: ["/mentor"],
    icon: (
      <Icon>
        <path d="M4 5h16v11H9l-5 4z" />
        <path d="M8 9h8M8 12h5" />
      </Icon>
    ),
  },
  {
    href: "/",
    label: "Today",
    short: "Today",
    match: ["/fun"],
    icon: (
      <Icon>
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </Icon>
    ),
  },
  {
    href: "/learn/",
    label: "Learning Path",
    short: "Learn",
    match: ["/learn", "/lessons", "/practice", "/assess"],
    icon: (
      <Icon>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 21V5M8 7h7" />
      </Icon>
    ),
  },
  {
    href: "/coding/",
    label: "Coding",
    short: "Coding",
    match: ["/coding"],
    icon: (
      <Icon>
        <path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />
      </Icon>
    ),
  },
  {
    href: "/radar/",
    label: "Tech Radar",
    short: "Radar",
    match: ["/radar"],
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <path d="M12 12 18.4 5.6" />
      </Icon>
    ),
  },
];

function isActive(pathname: string, link: (typeof LINKS)[number]): boolean {
  if (link.href === "/" && pathname === "/") return true;
  return link.match.some((m) => pathname.startsWith(m));
}

/** Top bar everywhere; on phones the sections move to a bottom bar within thumb reach. */
export function Nav() {
  const pathname = usePathname();
  const { storeKind, syncState } = useProgress();
  const syncLabel = storeKind === "local" ? "Local only" : syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync error" : "Synced";
  const settingsActive = pathname.startsWith("/settings");
  const syncIssue = syncState === "error";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-8 px-[max(1rem,env(safe-area-inset-left))] sm:px-6">
          <Link href="/" className="text-lg" aria-label="Fundamentals, go to Today">
            <BrandMark />
          </Link>
          <nav aria-label="Main" className="hidden flex-1 items-stretch gap-6 self-stretch text-[15px] sm:flex">
            {LINKS.map((l) => {
              const active = isActive(pathname, l);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center transition-colors ${
                    active ? "font-medium text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className={`meta hidden sm:inline ${syncIssue ? "text-bad" : ""}`} title="Where your progress is stored" role="status">
              {syncLabel}
            </span>
            <Link
              href="/settings/"
              aria-label={syncIssue ? "Settings (sync error)" : "Settings"}
              aria-current={settingsActive ? "page" : undefined}
              className={`-mr-2 flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-2 ${
                syncIssue ? "text-bad" : settingsActive ? "text-ink" : "text-ink-3"
              }`}
            >
              {SETTINGS_ICON}
            </Link>
          </div>
        </div>
      </header>

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] sm:hidden">
        <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch px-[env(safe-area-inset-left)]">
          {LINKS.map((l) => {
            const active = isActive(pathname, l);
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-xs ${
                    active ? "font-medium text-ink before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:bg-ink" : "text-ink-3"
                  }`}
                >
                  {l.icon}
                  {l.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
