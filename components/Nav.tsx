"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { useProgress } from "./ProgressProvider";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {children}
    </svg>
  );
}

type NavLink = {
  href: string;
  label: string;
  short: string;
  icon: ReactNode;
  /** tab: always shown, and in the phone bottom bar. wide: top bar on large screens only. header: an icon at the right of the bar, never a labelled tab. */
  place: "tab" | "wide" | "header";
  match?: string[];
};

const LINKS: NavLink[] = [
  {
    href: "/",
    place: "tab",
    label: "Dashboard",
    short: "Home",
    icon: (
      <Icon>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </Icon>
    ),
  },
  {
    href: "/mentor/",
    place: "tab",
    label: "Mentor",
    short: "Mentor",
    icon: (
      <Icon>
        <path d="M4 5h16v11H9l-5 4z" />
        <path d="M8 9h8M8 12h5" />
      </Icon>
    ),
  },
  {
    href: "/learn/",
    place: "tab",
    label: "Learning Path",
    short: "Learn",
    match: ["/learn", "/lessons"],
    icon: (
      <Icon>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 21V5M8 7h7" />
      </Icon>
    ),
  },
  {
    href: "/practice/",
    place: "wide",
    label: "Practice",
    short: "Practice",
    // The baseline assessment and the Fun corner are reached from Practice, so they keep it lit.
    match: ["/practice", "/assess", "/fun"],
    icon: (
      <Icon>
        <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
      </Icon>
    ),
  },
  {
    href: "/coding/",
    place: "tab",
    label: "Coding",
    short: "Coding",
    icon: (
      <Icon>
        <path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />
      </Icon>
    ),
  },
  {
    href: "/radar/",
    place: "tab",
    label: "Radar",
    short: "Radar",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <path d="M12 12 18.4 5.6" />
        <circle cx="16" cy="9.5" r="1" fill="currentColor" />
      </Icon>
    ),
  },
  {
    href: "/settings/",
    place: "header",
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

function isActive(pathname: string, link: NavLink): boolean {
  if (link.href === "/") return pathname === "/";
  return (link.match ?? [link.href.replace(/\/$/, "")]).some((m) => pathname.startsWith(m));
}

/** Top bar everywhere; on phones the links move to a bottom tab bar within thumb reach. */
export function Nav() {
  const pathname = usePathname();
  const { storeKind, syncState } = useProgress();

  const syncLabel = storeKind === "local" ? "Local only" : syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync error" : "Synced";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
          <Link href="/" className="tap -ml-1 px-1 font-semibold tracking-tight sm:ml-0 sm:px-0 sm:py-3" aria-label="Fundamentals, go to the home page">
            <BrandMark />
          </Link>
          <nav aria-label="Main" className="hidden flex-1 gap-1 self-stretch text-sm sm:flex">
            {LINKS.filter((l) => l.place !== "header").map((l) => {
              const active = isActive(pathname, l);
              const shown = l.place === "tab" ? "flex" : "hidden lg:flex";
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative ${shown} items-center whitespace-nowrap px-2.5 transition-colors ${
                    active ? "font-semibold text-ink after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:bg-accent" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <span className="lg:hidden">{l.href === "/" ? l.label : l.short}</span>
                  <span className="hidden lg:inline">{l.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="-mr-1 flex items-center sm:mr-0">
            {LINKS.filter((l) => l.place === "header").map((l) => {
              // The settings icon doubles as the sync indicator on phones.
              const syncIssue = l.href === "/settings/" && syncState === "error";
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-label={syncIssue ? `${l.label} (sync error)` : l.label}
                  aria-current={isActive(pathname, l) ? "page" : undefined}
                  className={`tap flex items-center px-2.5 ${syncIssue ? "text-bad" : isActive(pathname, l) ? "text-accent-text" : "text-ink-3"}`}
                >
                  {l.icon}
                </Link>
              );
            })}
            <Link
              href="/settings/"
              className={`hidden whitespace-nowrap py-1 font-mono text-xs md:inline ${syncState === "error" ? "text-bad" : "text-ink-3"}`}
              title="Where your progress is stored"
            >
              <span aria-hidden>●</span> {syncLabel}
            </Link>
          </div>
        </div>
      </header>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch px-[env(safe-area-inset-left)]">
          {LINKS.filter((l) => l.place === "tab").map((l) => {
            const active = isActive(pathname, l);
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
