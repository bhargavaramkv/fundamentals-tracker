"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProgress } from "./ProgressProvider";

const LINKS = [
  { href: "/", label: "Command" },
  { href: "/practice/", label: "Training" },
  { href: "/assess/", label: "Power scan" },
  { href: "/lessons/", label: "Intel files" },
  { href: "/settings/", label: "Systems" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function Nav() {
  const pathname = usePathname();
  const { syncState } = useProgress();

  const status =
    syncState === "syncing"
      ? { label: "SYNCING", dot: "bg-warn animate-pulse", text: "text-warn" }
      : syncState === "error"
        ? { label: "SYNC FAULT", dot: "bg-bad", text: "text-bad" }
        : { label: "SYSTEM: ONLINE", dot: "bg-good animate-pulse", text: "text-accent/70" };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="rounded-lg border border-line-strong bg-accent/10 px-3 py-1.5 font-comic text-xl text-accent shadow-glow transition-shadow hover:shadow-neon"
        >
          BHARGAVA.DEV
        </Link>
        <nav className="-mx-1 order-last flex w-full gap-1 overflow-x-auto text-xs font-bold tracking-widest uppercase sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:justify-center">
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`group relative shrink-0 px-2.5 py-2 transition-colors ${active ? "text-white" : "text-ink-3 hover:text-white"}`}
              >
                {l.label}
                <span
                  className={`absolute bottom-0 left-2.5 right-2.5 h-0.5 origin-left bg-accent transition-transform duration-300 ${
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings/"
          className={`flex items-center gap-2 rounded border border-line bg-black/40 px-2 py-1 font-mono text-[10px] ${status.text}`}
          title="Sync status"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </Link>
      </div>
    </header>
  );
}
