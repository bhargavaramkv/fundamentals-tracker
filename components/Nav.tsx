"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { useProgress } from "./ProgressProvider";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {children}
    </svg>
  );
}

type NavLink = { href: string; label: string; icon: ReactNode; match?: string[] };

/** The three primary destinations; "More" follows them. */
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

const MORE: NavLink[] = [
  { href: "/coding/", label: "Coding", icon: null },
  { href: "/mentor/", label: "Mentor", icon: null },
  { href: "/radar/", label: "Radar", icon: null },
  { href: "/fun/", label: "Fun corner", icon: null },
  { href: "/settings/", label: "Settings", icon: null },
];

const MORE_ICON = (
  <Icon>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Icon>
);

function isActive(pathname: string, link: NavLink): boolean {
  if (link.href === "/") return pathname === "/";
  return (link.match ?? [link.href.replace(/\/$/, "")]).some((m) => pathname.startsWith(m));
}

/** "More" disclosure: a dropdown on wide screens, a sheet above the tab bar on phones. */
function MoreMenu({ variant, syncError }: { variant: "dropdown" | "sheet"; syncError: boolean }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const active = MORE.some((l) => isActive(pathname, l));

  const close = (returnFocus: boolean) => {
    setOpenOn(null);
    if (returnFocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const sheet = variant === "sheet";
  const triggerClass = sheet
    ? `relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] ${active || open ? "font-semibold text-accent-text" : "text-ink-3"}`
    : `flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${active || open ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`;

  return (
    <div
      ref={root}
      className={sheet ? "h-full w-full" : "relative"}
      onBlur={(e) => {
        // Tabbing out of the menu closes it.
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null) && e.relatedTarget) setOpenOn(null);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={syncError ? "More (sync error)" : undefined}
        onClick={() => setOpenOn(open ? null : pathname)}
        className={triggerClass}
      >
        {sheet && MORE_ICON}
        <span className="relative">
          More
          {syncError && <span aria-hidden className="absolute -right-2 -top-0.5 h-1.5 w-1.5 rounded-full bg-bad" />}
        </span>
        {!sheet && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>
      {open && (
        <ul
          id={listId}
          className={
            sheet
              ? "page-enter fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-t-2xl border border-b-0 border-line bg-surface p-2 shadow-card"
              : "page-enter absolute right-0 top-full z-40 mt-2 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-card"
          }
        >
          {MORE.map((l) => {
            const current = isActive(pathname, l);
            const issue = l.href === "/settings/" && syncError;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => close(false)}
                  className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-[15px] transition-colors hover:bg-surface-2 ${
                    current ? "font-semibold text-accent-text" : "text-ink"
                  }`}
                >
                  {l.label}
                  {issue && <span className="text-xs font-medium text-bad">Sync error</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Top bar everywhere; on phones the links move to a bottom tab bar within thumb reach. */
export function Nav() {
  const pathname = usePathname();
  const { storeKind, syncState } = useProgress();
  const syncError = syncState === "error";

  const syncLabel = storeKind === "local" ? "Local only" : syncState === "syncing" ? "Syncing…" : syncError ? "Sync error" : "Synced";

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
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}
                  >
                    {l.label}
                  </Link>
                );
              })}
              <MoreMenu variant="dropdown" syncError={syncError} />
            </nav>
          </div>
          <Link
            href="/settings/"
            className={`hidden whitespace-nowrap py-1 text-xs md:inline ${syncError ? "text-bad" : "text-ink-3"}`}
            title="Where your progress is stored"
          >
            <span aria-hidden>●</span> {syncLabel}
          </Link>
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
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-semibold text-accent-text" : "text-ink-3"}`}
                >
                  {l.icon}
                  {l.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <MoreMenu variant="sheet" syncError={syncError} />
          </li>
        </ul>
      </nav>
    </>
  );
}
