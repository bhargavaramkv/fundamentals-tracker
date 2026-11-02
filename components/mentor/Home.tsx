"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { freshnessOf } from "@/lib/mentor/client";
import { PRIMARY_AFTER_NIGHTS } from "@/lib/mentor/types";
import type { Resource } from "@/lib/resources";
import { MentorView } from "./MentorPage";
import { useMentor } from "./useMentor";

/**
 * The home page. The rule-based Today stays until the nightly routine has proven itself on five nights in a row
 * (MentorStatus.primaryEligible), and comes back if the mentor goes quiet for more than three days.
 */
export function Home({ resources, fallback }: { resources: Resource[]; fallback: ReactNode }) {
  const load = useMentor();
  if (load === null) return <p className="meta py-10">Loading your plan…</p>;

  if (load.kind === "ready" && load.status?.primaryEligible && freshnessOf(load.state, new Date()).kind !== "stale") {
    return <MentorView load={load} resources={resources} />;
  }

  return (
    <>
      {load.kind === "ready" && (
        <p className="meta mb-8 border-l-2 border-line pl-4">
          {load.status?.primaryEligible
            ? "This plan is rule-based because your mentor hasn't published in over 3 days. "
            : `Your mentor is on trial: ${load.status?.consecutiveNights ?? 0} of ${PRIMARY_AFTER_NIGHTS} nights in a row before it becomes this page. `}
          <Link href="/mentor/" className="tap text-accent-text hover:underline">
            See what it thinks
          </Link>
          .
        </p>
      )}
      {fallback}
    </>
  );
}
