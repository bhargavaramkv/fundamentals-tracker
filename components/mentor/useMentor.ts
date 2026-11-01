"use client";

import { useEffect, useState } from "react";
import { loadMentor, type MentorLoad } from "@/lib/mentor/client";
import { useAuth } from "../AuthGate";

/** What the nightly routine last published. Null until the first read finishes. */
export function useMentor(): MentorLoad | null {
  const { syncToken } = useAuth();
  const [load, setLoad] = useState<MentorLoad | null>(null);
  useEffect(() => {
    let live = true;
    void loadMentor(syncToken).then((r) => {
      if (live) setLoad(r);
    });
    return () => {
      live = false;
    };
  }, [syncToken]);
  return load;
}
