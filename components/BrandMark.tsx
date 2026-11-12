/** App wordmark: plain text with an accent dot, always in Geist (the body font changed; the logo didn't). */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`} style={{ fontFamily: "var(--font-geist-sans)" }}>
      Fundamentals<span className="text-accent">.</span>
    </span>
  );
}
