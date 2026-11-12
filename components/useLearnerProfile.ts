"use client";

import { useEffect, useState } from "react";
import { validateLearnerProfile, type LearnerProfile } from "@/lib/learner";
import { readFile } from "@/lib/storage";
import { useAuth } from "./AuthGate";

/** The learner profile from the private data repo. Null without sync, when missing, or when it doesn't validate. */
export function useLearnerProfile(): LearnerProfile | null {
  const { syncToken } = useAuth();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);

  useEffect(() => {
    if (!syncToken) return;
    let live = true;
    readFile<LearnerProfile>(syncToken, "learner/profile.json")
      .then((raw) => {
        // The routine already checked the lesson keys against the content, so here only the shape matters.
        const named = raw ? [...raw.struggles ?? [], ...raw.nextUp ?? [], ...raw.adaptations ?? []].map((x) => x?.topic) : [];
        if (live && raw && validateLearnerProfile(raw, new Set(named)).length === 0) setProfile(raw);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [syncToken]);

  return syncToken ? profile : null;
}
