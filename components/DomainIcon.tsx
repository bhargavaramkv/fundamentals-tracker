import type { CSSProperties } from "react";
import type { Domain } from "@/lib/types";

export const domainColor = (domain: Domain) => `var(--d-${domain})`;

const PATHS: Record<Domain, React.ReactNode> = {
  // Graph of nodes
  dsa: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M8 6.5h8M7.2 7.9l3.6 8.2M16.8 7.9l-3.6 8.2" />
    </>
  ),
  // Cube
  oop: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  // Cylinder
  databases: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  // Connected boxes
  "system-design": (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-2h12v2" />
    </>
  ),
  // Globe
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" />
    </>
  ),
};

/** Domain glyph on a tinted tile, so color is always paired with a shape. */
export function DomainIcon({ domain, size = 36 }: { domain: Domain; size?: number }) {
  const color = domainColor(domain);
  const style: CSSProperties = {
    width: size,
    height: size,
    color,
    background: `color-mix(in oklab, ${color} 14%, transparent)`,
  };
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl" style={style} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        width={size * 0.58}
        height={size * 0.58}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[domain]}
      </svg>
    </span>
  );
}
