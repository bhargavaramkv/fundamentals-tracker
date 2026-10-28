/** App logo: gradient tile with a spark, plus the wordmark. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      <span
        className="inline-flex items-center justify-center rounded-lg text-white shadow-sm"
        style={{ width: size, height: size, backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="currentColor">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      </span>
      Fundamentals
    </span>
  );
}
