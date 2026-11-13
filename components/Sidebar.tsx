"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { describeSync, type SyncKind } from "@/lib/journal/status";
import { BrandMark } from "./BrandMark";
import { useJournal } from "./JournalProvider";
import { PRIMARY, isActive } from "./Nav";
import { useProgress } from "./ProgressProvider";
import { CloudIcon, SlidersIcon, SparklesIcon } from "./ui/icons";

const TITLE: Record<SyncKind, string> = {
  local: "Local only",
  synced: "Synced",
  saving: "Saving…",
  offline: "Offline",
  retrying: "Retrying",
  error: "Sync problem",
  conflict: "Needs attention",
};
const TONE: Record<SyncKind, string> = {
  local: "text-ink-3",
  synced: "text-good",
  saving: "text-accent",
  offline: "text-warn",
  retrying: "text-warn",
  error: "text-bad",
  conflict: "text-bad",
};

/** Desktop: a 240 px sidebar. Tablet: a 72 px icon rail (labels move to aria-label and title). Hidden on phones, where Nav takes over. */
export function Sidebar() {
  const pathname = usePathname();
  const { syncState: progressSync } = useProgress();
  const { hasToken, syncState, online, queue } = useJournal();
  const summary = describeSync({ hasToken, online, state: syncState, queue });
  const syncError = progressSync === "error";
  const detail = summary.kind === "local" ? "On this device only" : summary.label;

  const item = (href: string, label: string, icon: ReactNode, active: boolean, small = false) => (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`nav-link justify-center lg:justify-start ${small ? "min-h-10 text-sm" : ""}`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg-2 px-3 pb-4 pt-7 md:flex lg:px-4">
      <Link href="/" className="mb-9 block text-center text-lg font-semibold tracking-tight lg:px-3 lg:text-left lg:text-[22px]" aria-label="Fundamentals, go to the home page">
        <span className="lg:hidden" aria-hidden>
          F<span className="text-accent">.</span>
        </span>
        <span className="hidden lg:inline">
          <BrandMark />
        </span>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {PRIMARY.map((l) => (
          <span key={l.href} className="contents">
            {item(l.href, l.label, l.icon, isActive(pathname, l))}
          </span>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        {item("/mentor/", "Mentor", <SparklesIcon />, pathname.startsWith("/mentor"), true)}
        {item("/settings/", syncError ? "Settings (sync error)" : "Settings", <SlidersIcon />, pathname.startsWith("/settings"), true)}
        <div
          role="status"
          title={summary.label}
          className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--hl)] lg:justify-start"
        >
          <span className={`relative grid place-items-center ${TONE[summary.kind]}`}>
            <CloudIcon />
            <span aria-hidden className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-surface bg-current" />
          </span>
          <span className="hidden min-w-0 lg:block">
            <b className="block text-[13px] font-medium leading-snug">{TITLE[summary.kind]}</b>
            <small className="block text-xs leading-snug text-muted">{detail}</small>
          </span>
        </div>
      </div>
    </aside>
  );
}
