import type { ReactNode } from "react";

/** Page body with an optional right rail: beside the content from xl up, stacked below it on smaller screens. */
export function PageShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  if (!right) return <>{children}</>;
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-10">
      <div className="min-w-0">{children}</div>
      <aside className="mt-10 min-w-0 space-y-4 xl:sticky xl:top-8 xl:mt-0 xl:max-h-[calc(100dvh-4rem)] xl:overflow-y-auto">{right}</aside>
    </div>
  );
}
