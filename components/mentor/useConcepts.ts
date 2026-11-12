"use client";

import { useMemo } from "react";
import { buildConcepts, type ConceptRow } from "@/lib/mentor/concepts";
import { useNow } from "../useNow";
import { useJournal } from "../JournalProvider";
import { useMentor } from "../MentorProvider";

/** The concept list from stored evidence, reviews of known sessions and journal topics. */
export function useConcepts(): ConceptRow[] {
  const { records } = useJournal();
  const { evidence, reviews } = useMentor();
  const now = useNow();
  return useMemo(() => (now === null ? [] : buildConcepts({ evidence, reviews, sessions: records.map((r) => r.session), now })), [evidence, reviews, records, now]);
}
