"use client";

import { useMemo } from "react";
import { allKeys, doneTopics, nextLesson } from "@/lib/curriculum";
import type { Curriculum, TopicMeta, WorkspaceSummary } from "@/lib/types";
import { useProgress } from "./ProgressProvider";
import { useNow } from "./useNow";

export interface CourseContext {
  curriculum: Curriculum;
  topics: TopicMeta[];
  workspaces: Record<string, WorkspaceSummary>;
}

/** What's done and what's next, from the learner's progress. Before it loads, nothing is done. */
export function useCourse({ curriculum, topics, workspaces }: CourseContext) {
  const { data, ready } = useProgress();
  const now = useNow();
  return useMemo(() => {
    const done = ready && now !== null ? doneTopics(allKeys(curriculum), data, workspaces, now) : new Set<string>();
    const next = nextLesson(curriculum, data, done);
    const meta = (key: string) => topics.find((t) => `${t.domain}/${t.topic}` === key);
    return { data, now, ready: ready && now !== null, done, next, meta };
  }, [curriculum, topics, workspaces, data, ready, now]);
}
