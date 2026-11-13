"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { useProgress } from "./ProgressProvider";
import { BookIcon, BulbIcon, CodeIcon, HomeIcon, SlidersIcon, SparklesIcon } from "./ui/icons";

export type NavLink = { href: string; label: string; icon: ReactNode; match?: string[] };

/** The four destinations; Mentor and Settings are utilities. */
export const PRIMARY: NavLink[] = [
  {
    href: "/",
    label: "Today",
    // Review rounds and the baseline assessment start from Today, so they keep it lit.
    match: ["/practice", "/assess"],
    icon: <HomeIcon />,
  },
  { href: "/journal/", label: "Journal", icon: <BookIcon /> },
  {
    href: "/knowledge/",
    label: "Knowledge",
    // Lessons are optional resources reached from Knowledge.
    match: ["/knowledge", "/learn", "/lessons"],
    icon: <BulbIcon />,
  },
  { href: "/coding/", label: "Coding", icon: <CodeIcon /> },
];

export function isActive(pathname: string, link: NavLink): boolean {
  if (link.href === "/") return pathname === "/" || (link.match ?? []).some((m) => pathname.startsWith(m));
  return (link.match ?? [link.href.replace(/\/$/, "")]).some((m) => pathname.startsWith(m));
}

/** Phones only (below 768): a top bar with the wordmark, Mentor and Settings, and a bottom tab bar with the four destinations. */
export function Nav() {
  const pathname = usePathname();
  const { syncState } = useProgress();
  const syncError = syncState === "error";
  const utility = (href: string, label: string, icon: ReactNode, active: boolean, dot = false) => (
    <Link
      href={href}
      aria-label={dot ? `${label} (sync error)` : label}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${active ? "text-accent-text" : "text-ink-2 hover:text-ink"}`}
    >
      {icon}
      {dot && <span aria-hidden className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-bad" />}
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg-2 pt-[env(safe-area-inset-top)] md:hidden">
        <div className="flex items-center justify-between px-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
          <Link href="/" className="tap -ml-1 px-1 text-lg font-semibold tracking-tight" aria-label="Fundamentals, go to the home page">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-1">
            {utility("/mentor/", "Mentor", <SparklesIcon />, pathname.startsWith("/mentor"))}
            {utility("/settings/", "Settings", <SlidersIcon />, pathname.startsWith("/settings"), syncError)}
          </div>
        </div>
      </header>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-line-2 bg-bg-2 pb-[env(safe-area-inset-bottom)] md:hidden">
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
