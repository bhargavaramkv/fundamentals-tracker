/** A new practice question stays read-only this long, so options get read before they are picked. */
export const READ_LOCK_MS = 2000;
/** A wrong answer given faster than this earns a gentle "read every option" nudge. */
export const QUICK_MISS_MS = 3000;

export const isQuickMiss = (ms: number, correct: boolean): boolean => !correct && ms < QUICK_MISS_MS;
