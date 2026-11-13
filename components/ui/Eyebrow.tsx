import type { ReactNode } from "react";

/** Small uppercase label above a title. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs font-medium uppercase tracking-[0.14em] text-cyan ${className}`}>{children}</p>;
}
