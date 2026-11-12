"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { streak } from "@/lib/curriculum";
import { BrandMark } from "./BrandMark";
import { Flame } from "./ProgressRing";
import { useProgress } from "./ProgressProvider";
import { useNow } from "./useNow";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {children}
    </svg>
  );
}

type NavLink = { href: string; label: string; icon: ReactNode; match?: string[] };

/** The three destinations; Settings is the gear in the top bar. */
const PRIMARY: NavLink[] = [
  {
    href: "/",
    label: "Today",
    icon: (
      <Icon>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      </Icon>
    ),
  },
  {
    href: "/learn/",
    label: "Learn",
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
    label: "Practice",
    // The baseline assessment is reached from Practice, so it keeps it lit.
    match: ["/practice", "/assess"],
    icon: (
      <Icon>
        <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
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
  const { syncState, data, ready } = useProgress();
  const now = useNow();
  const days = ready && now !== null ? streak(data, now) : null;
  const syncError = syncState === "error";
  const settingsActive = pathname.startsWith("/settings");


  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-6 px-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
          <Link href="/" className="tap -ml-1 px-1 font-semibold tracking-tight sm:ml-0 sm:px-0 sm:py-3" aria-label="Fundamentals, go to the home page">
            <BrandMark />
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            <nav aria-label="Main" className="flex items-center gap-1 text-sm">
              {PRIMARY.map((l) => {
                const active = isActive(pathname, l);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 font-bold transition-colors ${active ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            {days !== null && (
              <span className="flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-extrabold tabular-nums" title={`${days}-day streak`}>
                <Flame lit={days > 0} />
                <span className={days > 0 ? "text-accent-2" : "text-ink-3"}>{days}</span>
                <span className="sr-only">day streak</span>
              </span>
            )}
            <Link
              href="/settings/"
              aria-label={syncError ? "Settings (sync error)" : "Settings"}
              aria-current={settingsActive ? "page" : undefined}
              className={`relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${settingsActive ? "text-ink" : "text-ink-3 hover:text-ink"}`}
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
          {PRIMARY.map((l) => {
            const active = isActive(pathname, l);
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${active ? "text-accent-text" : "text-ink-3"}`}
                >
                  {l.icon}
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
