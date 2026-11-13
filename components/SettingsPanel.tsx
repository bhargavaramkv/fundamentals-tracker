"use client";

import { useState, type ReactNode } from "react";
import { mergeProgress, normalizeProgress } from "@/lib/progress";
import { SHARED_TOKEN } from "@/lib/auth";
import { DATA_REPO } from "@/lib/storage";
import { useAuth } from "./AuthGate";
import { useProgress } from "./ProgressProvider";
import { PageHeader } from "./ui/PageHeader";
import { Panel } from "./ui/Panel";
import { StatusPill } from "./ui/StatusPill";

type Notice = { tone: "ok" | "warn" | "error"; text: string };

const SECTIONS = [
  { id: "storage", label: "Storage" },
  { id: "sync", label: "Sync" },
  { id: "backup", label: "Backup" },
  { id: "account", label: "Account" },
] as const;

function NoticeLine({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-lg px-4 py-3 text-sm ${
        notice.tone === "ok" ? "bg-good-bg text-good" : notice.tone === "warn" ? "bg-warn-bg text-warn" : "bg-bad-bg text-bad"
      }`}
    >
      {notice.text}
    </p>
  );
}

function Section({ id, title, description, status, children }: { id: string; title: string; description: string; status?: ReactNode; children: ReactNode }) {
  return (
    <Panel as="section" className="scroll-mt-8 p-5 sm:p-6">
      <span id={id} className="absolute -top-8" aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg">{title}</h2>
          <p className="mt-1 text-sm text-ink-2">{description}</p>
        </div>
        {status}
      </div>
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

const SM_SPAN = ["", "sm:col-span-1", "sm:col-span-2", "sm:col-span-3"];

/** The last plain cell stretches to fill its row, so the hairline grid never shows an empty cell. */
function lastSpan(items: { wide?: boolean }[]): string {
  let n = 0;
  for (const i of items) n = i.wide ? 0 : n + 1;
  if (n === 0) return "";
  const two = n % 2 === 1 ? "col-span-2" : "";
  const r3 = n % 3;
  return `${two} ${SM_SPAN[r3 === 0 ? 1 : 4 - r3]}`;
}

function Facts({ items }: { items: { label: string; value: ReactNode; wide?: boolean }[] }) {
  const fill = lastSpan(items);
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
      {items.map((i, k) => (
        <div key={i.label} className={`min-w-0 bg-surface px-4 py-3 ${i.wide ? "col-span-2 sm:col-span-3" : k === items.length - 1 ? fill : ""}`}>
          <dt className="text-xs text-ink-3">{i.label}</dt>
          <dd className="mono mt-0.5 break-words text-sm text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Learn({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-4 text-sm text-ink-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-accent-text">
        Learn more{" "}
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="mt-2 max-w-[68ch] space-y-2">{children}</div>
    </details>
  );
}

export function SettingsPanel() {
  const { data, raw, archivedCount, storeKind, syncState, syncError, replaceAll } = useProgress();
  const { syncToken, sharedAcrossDevices, canShareToken, remembered, connectSync, disconnectSync, signOut } = useAuth();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState<Notice | null>(null);
  const [backupNotice, setBackupNotice] = useState<Notice | null>(null);

  const connect = async () => {
    setBusy(true);
    setSyncNotice(null);
    const { error, warning } = await connectSync(token, password || undefined);
    setPassword("");
    setBusy(false);
    if (error) {
      setSyncNotice({ tone: "error", text: `Couldn't enable sync. ${error}` });
      return;
    }
    setToken("");
    setSyncNotice(
      warning
        ? { tone: "warn", text: warning }
        : { tone: "ok", text: "Sync enabled for your account. Every device picks it up automatically when you sign in." },
    );
  };

  const disconnect = async () => {
    await disconnectSync();
    setSyncNotice({ tone: "ok", text: "Sync turned off for your account. Your progress file in the data repo is untouched." });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fundamentals-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const incoming = normalizeProgress(JSON.parse(await file.text()));
      await replaceAll(mergeProgress(raw, incoming));
      setBackupNotice({ tone: "ok", text: `Imported ${incoming.answers.length} answers (merged; nothing was removed).` });
    } catch {
      setBackupNotice({ tone: "error", text: "That file isn't valid progress JSON." });
    }
  };

  const vault = `${DATA_REPO.owner}/${DATA_REPO.repo}`;
  const stateLabel = storeKind === "local" ? "Local only" : syncState === "syncing" ? "Syncing…" : syncState === "error" ? "Sync error" : "Synced";
  const stateTone = storeKind === "local" ? "neutral" : syncState === "syncing" ? "info" : syncState === "error" ? "bad" : "good";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Account and data" title="Settings" subtitle="Where your progress is stored, how it syncs, and your account." horizon />

      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Settings sections" className="mb-6 lg:sticky lg:top-8 lg:mb-0 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-lg border border-line px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:border-transparent">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section
            id="storage"
            title="Storage"
            description="Where your answers, sessions and exercises live right now."
            status={
              <span role="status">
                <StatusPill tone={stateTone}>{stateLabel}</StatusPill>
              </span>
            }
          >
            <Facts
              items={[
                { label: "Stored in", wide: true, value: storeKind === "github" ? `this browser + ${vault} (private)` : "this browser only" },
                { label: "Answers", value: data.answers.length },
                { label: "Sessions", value: data.sessions.length },
                { label: "Questions in review", value: Object.keys(data.reviews).length },
                { label: "Exercises and readings", value: data.activities.length },
                { label: "In-app coding attempts", value: data.codingAttempts.length },
              ]}
            />
            {syncError && <p className="mt-3 text-sm text-bad">Last sync error: {syncError}</p>}
            <Learn>
              <p>Your LeetCode history is stored separately and shown on the Coding page.</p>
              {archivedCount > 0 && (
                <p>
                  {archivedCount} earlier answer{archivedCount === 1 ? " was" : "s were"} given before the question rewrite on 28 Oct and {archivedCount === 1 ? "is" : "are"} archived: kept in your file and exports, but not counted in scores.
                </p>
              )}
            </Learn>
          </Section>

          <Section
            id="sync"
            title="Sync to GitHub"
            description="Keeps your devices in step and lets the daily routine see your results."
            status={<StatusPill tone={syncToken ? "good" : "neutral"}>{syncToken ? "Token saved" : "Not set up"}</StatusPill>}
          >
            <Facts
              items={[
                { label: "Repo", value: vault },
                { label: "File", value: DATA_REPO.path },
                { label: "Scope", value: !syncToken ? "none yet" : sharedAcrossDevices ? "every device on your account" : "this device only" },
              ]}
            />
            <label className="mt-5 block text-sm">
              <span className="text-ink-2">{syncToken ? "Replace token" : "Token"}</span>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} className="field mt-1 font-mono text-sm" />
            </label>
            {!canShareToken && (
              <label className="mt-3 block text-sm">
                <span className="text-ink-2">Password (to save the token for your other devices too; optional)</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="field mt-1 text-sm" />
              </label>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {syncToken && (
                <button type="button" onClick={() => void disconnect()} className="btn btn-secondary">
                  Turn off sync
                </button>
              )}
              <button type="button" onClick={() => void connect()} disabled={busy || token.trim().length < 20} className="btn btn-primary">
                {busy ? "Connecting…" : syncToken ? "Save & resync" : "Test & enable sync"}
              </button>
            </div>
            <NoticeLine notice={syncNotice} />
            <Learn>
              {syncToken ? (
                <p>
                  Progress syncs to <code>{vault}/{DATA_REPO.path}</code>, where the daily routine reads it.{" "}
                  {sharedAcrossDevices
                    ? "Set up for your account: every device you sign in on syncs automatically."
                    : "Set up on this device only. Save the token again with access to both repos to enable it everywhere."}{" "}
                  If the token expires, paste a new one above. That updates every device.
                </p>
              ) : (
                <p>
                  One-time setup for your account; every device you sign in on picks it up automatically. It lets the daily improvement routine see your results and keeps devices in sync. Create a{" "}
                  <a className="text-accent-text hover:underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                    fine-grained token
                  </a>{" "}
                  with access to only <strong>{DATA_REPO.repo}</strong> and <strong>{SHARED_TOKEN.repo}</strong>, permission <strong>Contents: Read and write</strong>. It&apos;s saved encrypted with your password, so it&apos;s useless to anyone without it.
                </p>
              )}
            </Learn>
          </Section>

          <Section id="backup" title="Backup" description="Export everything as JSON, or import a backup.">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={exportJson} className="btn btn-secondary">
                Export JSON
              </button>
              <label className="btn btn-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
                Import JSON
                <input
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importJson(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <NoticeLine notice={backupNotice} />
            <Learn>
              <p>The export includes exercises and coding history. Imports merge, so they never delete anything.</p>
            </Learn>
          </Section>

          <Section
            id="account"
            title="Account"
            description="Signing in on this device."
            status={<StatusPill tone={remembered ? "good" : "warn"}>{remembered ? "Signed in for 30 days" : "Signs in each visit"}</StatusPill>}
          >
            <p className="text-sm text-ink-2">
              {remembered
                ? "You stay signed in on this device for 30 days. The sign-in uses a key that only this browser holds; your password isn't stored."
                : "This browser can't keep a sign-in (private mode or storage blocked), so you'll sign in on each visit."}
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={signOut} className="btn btn-secondary btn-danger">
                Sign out
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
