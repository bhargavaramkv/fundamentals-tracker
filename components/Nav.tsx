"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { useProgress } from "./ProgressProvider";

const ICON = "h-5 w-5";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={ICON} aria-hidden>
      {children}
    </svg>
  );
}

const FUN_ICON = (
  <Icon>
    <path d="M12 3c-3.9 0-7 3-7 6.8 0 2.4 1.2 4.3 3 5.5V18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.7c1.8-1.2 3-3.1 3-5.5C19 6 15.9 3 12 3z" />
    <path d="M9.5 22h5" />
  </Icon>
);

// `tab: false` links live in the header on phones; the bottom bar keeps the five learning destinations.
const LINKS: { href: string; label: string; short: string; icon: ReactNode; tab: boolean }[] = [
  {
    href: "/",
    tab: true,
    label: "Dashboard",
    short: "Home",
    icon: (
      <Icon>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </Icon>
    ),
  },
  {
    href: "/practice/",
    tab: true,
    label: "Practice",
    short: "Practice",
    icon: (
      <Icon>
        <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
      </Icon>
    ),
  },
  {
    href: "/assess/",
    tab: true,
    label: "Assessment",
    short: "Assess",
    icon: (
      <Icon>
        <path d="M9 4h6M9 4a2 2 0 0 0-2 2H5v15h14V6h-2a2 2 0 0 0-2-2M9 4a2 2 0 0 1 2-1h2a2 2 0 0 1 2 1" />
        <path d="m9 13 2 2 4-4" />
      </Icon>
    ),
  },
  {
    href: "/lessons/",
    tab: true,
    label: "Lessons",
    short: "Lessons",
    icon: (
      <Icon>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 21V5M8 7h7" />
      </Icon>
    ),
  },
  {
    href: "/news/",
    tab: true,
    label: "News",
    short: "News",
    icon: (
      <Icon>
        <path d="M5 4h12v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" />
        <path d="M17 8h2a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3" />
      </Icon>
    ),
  },
  { href: "/fun/", label: "Fun corner", short: "Fun", tab: false, icon: FUN_ICON },
  {
    href: "/settings/",
    tab: false,
    label: "Settings",
    short: "Settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </Icon>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

/** Top bar everywhere; on phones the links move to a bottom tab bar within thumb reach. */
export function Nav() {
  const pathname = usePathname();
  const { storeKind, syncState } = useProgress();

  const syncLabel =
    storeKind === "local" ? "Local only" : syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync error" : "Synced";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
          <Link href="/" className="tap -ml-1 px-1 font-semibold tracking-tight sm:ml-0 sm:px-0 sm:py-3">
            <BrandMark />
          </Link>
          <nav aria-label="Main" className="hidden flex-1 gap-1 self-stretch text-sm sm:flex">
            {LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center px-2.5 transition-colors ${
                    active
                      ? "font-semibold text-ink after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:bg-accent"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="-mr-1 flex items-center sm:mr-0">
            {LINKS.filter((l) => !l.tab).map((l) => {
              // On phones the settings icon doubles as the sync indicator.
              const syncIssue = l.href === "/settings/" && syncState === "error";
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-label={syncIssue ? `${l.label} (sync error)` : l.label}
                  aria-current={isActive(pathname, l.href) ? "page" : undefined}
                  className={`tap px-2.5 sm:hidden ${
                    syncIssue ? "text-bad" : isActive(pathname, l.href) ? "text-accent-text" : "text-ink-3"
                  }`}
                >
                  {l.icon}
                </Link>
              );
            })}
            <Link
              href="/settings/"
              className={`hidden py-1 font-mono text-xs sm:inline ${syncState === "error" ? "text-bad" : "text-ink-3"}`}
              title="Where your progress is stored"
            >
              <span aria-hidden>●</span> {syncLabel}
            </Link>
          </div>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch px-[env(safe-area-inset-left)]">
          {LINKS.filter((l) => l.tab).map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] ${
                    active ? "font-medium text-accent-text before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-accent" : "text-ink-3"
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
