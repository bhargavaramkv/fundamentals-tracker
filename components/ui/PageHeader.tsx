import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

/** Eyebrow, one title, one plain sentence; `horizon` adds the luminous rule beneath (secondary screens). */
export function PageHeader({ eyebrow, title, subtitle, horizon = false }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; horizon?: boolean }) {
  return (
    <header className="mb-8">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="mt-2 text-[2rem] font-[650] leading-tight tracking-[-0.02em]">{title}</h1>
      {subtitle && <p className="mt-2 max-w-[60ch] text-ink-2">{subtitle}</p>}
      {horizon && <div aria-hidden className="horizon-rule mt-6" />}
    </header>
  );
}
