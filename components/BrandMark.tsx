/** App wordmark: plain text with an accent dot. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      Fundamentals<span className="text-accent">.</span>
    </span>
  );
}
