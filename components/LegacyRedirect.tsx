"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Keeps old links and bookmarks working. A static export can't send server redirects, so this happens in the browser. */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${to}${window.location.hash}`);
  }, [router, to]);
  return (
    <p className="text-ink-2">
      This page has moved.{" "}
      <Link href={to} className="text-accent-text hover:underline">
        Go to its new home
      </Link>
      .
    </p>
  );
}
