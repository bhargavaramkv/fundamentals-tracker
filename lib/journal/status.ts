import type { SyncState } from "./sync";

export type SyncKind = "local" | "synced" | "saving" | "offline" | "retrying" | "error" | "conflict";

export interface QueueInfo {
  /** Sessions and review requests waiting to be pushed. */
  queued: number;
  /** Epoch ms of the earliest scheduled retry among failed entries, or null. */
  nextAttemptAt: number | null;
  conflicts: number;
}

export interface SyncSummary {
  kind: SyncKind;
  label: string;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** One line for the whole journal, in order of urgency: conflict, offline, saving, retrying, error, synced. */
export function describeSync(input: { hasToken: boolean; online: boolean; state: SyncState; queue: QueueInfo }): SyncSummary {
  const { hasToken, online, state, queue } = input;
  if (!hasToken) return { kind: "local", label: "Saved on this device only" };
  if (queue.conflicts > 0)
    return { kind: "conflict", label: `${queue.conflicts} ${queue.conflicts === 1 ? "session needs" : "sessions need"} attention. Your local copy is safe.` };
  if (!online) return { kind: "offline", label: `Offline. ${queue.queued} ${queue.queued === 1 ? "change" : "changes"} queued; they sync when you are back online.` };
  if (state.state === "syncing") return { kind: "saving", label: "Saving…" };
  if (queue.nextAttemptAt !== null) return { kind: "retrying", label: `Retrying at ${clock(queue.nextAttemptAt)}${state.message ? `: ${state.message}` : ""}` };
  if (state.state === "error") return { kind: "error", label: `Sync problem: ${state.message ?? "unknown"}` };
  if (queue.queued > 0) return { kind: "saving", label: `${queue.queued} ${queue.queued === 1 ? "change" : "changes"} waiting to sync` };
  return { kind: "synced", label: state.lastSyncedAt ? `Synced at ${clock(Date.parse(state.lastSyncedAt))}` : "Sync on" };
}
