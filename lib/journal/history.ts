import { deriveSession, type DerivedSession } from "./events";
import type { SessionRecord } from "./local";
import type { SourceKind } from "./types";

export interface HistoryFilter {
  /** Derived subject, matched case-insensitively. "" = any. */
  subject: string;
  source: SourceKind | "";
  query: string;
  showDiscarded: boolean;
}

export const EMPTY_FILTER: HistoryFilter = { subject: "", source: "", query: "", showDiscarded: false };

export interface HistoryItem {
  record: SessionRecord;
  derived: DerivedSession;
}

const isOpen = (d: DerivedSession) => d.status === "active" || d.status === "paused";

/** Past (not running) sessions with their derived state, in the order given (newest first). */
export function historyItems(records: SessionRecord[]): HistoryItem[] {
  return records.map((record) => ({ record, derived: deriveSession(record.session) })).filter((i) => !isOpen(i.derived));
}

/** Distinct derived subjects of the given items, case-insensitive, sorted by name. */
export function subjectsOf(items: HistoryItem[]): string[] {
  const seen = new Map<string, string>();
  for (const { derived } of items) if (derived.subject && !seen.has(derived.subject.toLowerCase())) seen.set(derived.subject.toLowerCase(), derived.subject);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Everything the text search looks at, lower-cased: subject, objective, source title, notes, topics, difficulties, bookmarks and reflections. */
function haystack({ derived }: HistoryItem): string {
  const parts: string[] = [derived.subject, derived.objective ?? "", derived.source.title ?? "", ...derived.topics];
  for (const t of derived.timeline) parts.push(t.text);
  for (const r of derived.reflections) parts.push(r.learned ?? "", r.difficult ?? "", r.unclear ?? "");
  return parts.join("\n").toLowerCase();
}

export function filterHistory(items: HistoryItem[], f: HistoryFilter): HistoryItem[] {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (!f.showDiscarded && i.derived.status === "discarded") return false;
    if (f.subject && i.derived.subject.toLowerCase() !== f.subject.toLowerCase()) return false;
    if (f.source && i.derived.source.kind !== f.source) return false;
    if (terms.length === 0) return true;
    const h = haystack(i);
    return terms.every((t) => h.includes(t));
  });
}

export type DateGroup = "Today" | "This week" | "Earlier";

/** Calendar-day buckets in the viewer's time zone: today, the previous 6 days, and anything older. */
export function dateGroup(iso: string, now: number = Date.now()): DateGroup {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(Date.parse(iso))) / 86_400_000);
  return days <= 0 ? "Today" : days < 7 ? "This week" : "Earlier";
}

/** Groups in display order, keeping the items' order inside each group and dropping empty groups. */
export function groupByDate(items: HistoryItem[], now: number = Date.now()): { label: DateGroup; items: HistoryItem[] }[] {
  const groups: { label: DateGroup; items: HistoryItem[] }[] = (["Today", "This week", "Earlier"] as const).map((label) => ({ label, items: [] }));
  for (const i of items) groups.find((g) => g.label === dateGroup(i.derived.startedAt, now))!.items.push(i);
  return groups.filter((g) => g.items.length > 0);
}
