"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProgress } from "./ProgressProvider";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/practice/", label: "Practice" },
  { href: "/assess/", label: "Assessment" },
  { href: "/lessons/", label: "Lessons" },
  { href: "/settings/", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function Nav() {
  const pathname = usePathname();
  const { storeKind, syncState } = useProgress();

  const syncLabel =
    storeKind === "local" ? "Local only" : syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync error" : "Synced";

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Fundamentals<span className="text-accent">.</span>
        </Link>
        <nav className="-mx-1 order-last flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-md px-2.5 py-1.5 ${
                isActive(pathname, l.href) ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/settings/"
          className={`text-xs ${syncState === "error" ? "text-bad" : "text-ink-3"}`}
          title="Where your progress is stored"
        >
          ● {syncLabel}
        </Link>
      </div>
    </header>
  );
}
