"use client";

import { useEffect, useMemo, useState } from "react";
import { loadGeneratedQuestions } from "@/lib/mentor/client";
import { mergeQuestionPools, type GeneratedQuestion } from "@/lib/mentor/questions";
import type { Question } from "@/lib/types";
import { useAuth } from "./AuthGate";

// One fetch per token per page load, shared by every component that asks.
let cache: { token: string; promise: Promise<GeneratedQuestion[]> } | null = null;

/** Generated questions the nightly mentor published. Empty until loaded, or without a sync token. */
export function useGeneratedQuestions(): GeneratedQuestion[] {
  const { syncToken } = useAuth();
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  useEffect(() => {
    if (!syncToken) return;
    if (cache?.token !== syncToken) cache = { token: syncToken, promise: loadGeneratedQuestions(syncToken) };
    let live = true;
    void cache.promise.then((q) => {
      if (live) setQuestions(q);
    });
    return () => {
      live = false;
    };
  }, [syncToken]);
  return questions;
}

/** The static bank plus what the mentor wrote, optionally narrowed (e.g. to one topic). */
export function useQuestionPool(base: Question[], keep: (q: Question) => boolean = () => true): Question[] {
  const generated = useGeneratedQuestions();
  // `keep` is usually an inline closure; the pool only needs to change when the inputs do.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => mergeQuestionPools(base, generated.filter(keep)), [base, generated]);
}
