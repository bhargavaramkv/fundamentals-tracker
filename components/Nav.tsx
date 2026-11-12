"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { useProgress } from "./ProgressProvider";

export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {children}
    </svg>
  );
}

export type NavLink = { href: string; label: string; icon: ReactNode; match?: string[] };

/** The four destinations; Settings is the gear in the top bar. */
export const PRIMARY: NavLink[] = [
  {
    href: "/",
    label: "Today",
    // Review rounds and the baseline assessment start from Today, so they keep it lit.
    match: ["/practice", "/assess"],
    icon: (
      <Icon>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </Icon>
    ),
  },
  {
    href: "/journal/",
    label: "Journal",
    icon: (
      <Icon>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 21V5M8 7h7M8 11h7" />
      </Icon>
    ),
  },
  {
    href: "/knowledge/",
    label: "Knowledge",
    // Lessons are optional resources reached from Knowledge.
    match: ["/knowledge", "/learn", "/lessons"],
    icon: (
      <Icon>
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z" />
      </Icon>
    ),
  },
  {
    href: "/coding/",
    label: "Coding",
    icon: (
      <Icon>
        <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
      </Icon>
    ),
  },
];

export function isActive(pathname: string, link: NavLink): boolean {
  if (link.href === "/") return pathname === "/" || (link.match ?? []).some((m) => pathname.startsWith(m));
  return (link.match ?? [link.href.replace(/\/$/, "")]).some((m) => pathname.startsWith(m));
}

/** Top bar below lg (the sidebar takes over from lg up); on phones the links move to a bottom tab bar within thumb reach. */
export function Nav() {
  const pathname = usePathname();
  const { syncState } = useProgress();
  const syncError = syncState === "error";
  const settingsActive = pathname.startsWith("/settings");

  return (
    <>
      <header className="sticky top-0 z-30 lg:hidden border-b border-line bg-bg pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-6 px-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
          <Link href="/" className="tap -ml-1 px-1 text-lg font-semibold tracking-tight sm:ml-0 sm:px-0 sm:py-3" aria-label="Fundamentals, go to the home page">
            <BrandMark />
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            <nav aria-label="Main" className="flex items-center gap-1">
              {PRIMARY.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(pathname, l) ? "page" : undefined}
                  className="nav-link whitespace-nowrap px-3.5 before:hidden"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
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
        </div>
      </header>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] sm:hidden">
        <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch px-[env(safe-area-inset-left)]">
          {PRIMARY.map((l) => (
            <li key={l.href} className="flex-1">
              <Link href={l.href} aria-current={isActive(pathname, l) ? "page" : undefined} className="tab-link">
                {l.icon}
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
