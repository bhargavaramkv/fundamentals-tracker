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

const LINKS: { href: string; label: string; short: string; icon: ReactNode }[] = [
  {
    href: "/",
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
    label: "News",
    short: "News",
    icon: (
      <Icon>
        <path d="M5 4h12v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" />
        <path d="M17 8h2a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3" />
      </Icon>
    ),
  },
  {
    href: "/settings/",
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
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-5 px-[max(1.25rem,env(safe-area-inset-left))] py-2 sm:py-4 sm:pr-[max(1.25rem,env(safe-area-inset-right))]">
          <Link href="/" className="tap -ml-1 px-1 font-semibold tracking-tight sm:ml-0 sm:px-0 sm:py-1">
            <BrandMark />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 pl-6 text-sm sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={`relative rounded-sm px-3 py-2 transition-colors ${
                  isActive(pathname, l.href) ? "font-semibold text-ink after:absolute after:inset-x-3 after:-bottom-4 after:h-0.5 after:bg-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/settings/"
            className={`tap -mr-1 px-1 text-xs sm:mr-0 sm:px-0 sm:py-1 ${syncState === "error" ? "text-bad" : "text-ink-3"}`}
            title="Where your progress is stored"
          >
            ● {syncLabel}
          </Link>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch px-[env(safe-area-inset-left)]">
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] ${
                    active ? "font-semibold text-accent" : "text-ink-3 hover:text-ink"
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
