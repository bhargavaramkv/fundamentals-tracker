"use client";

import { useState } from "react";
import { mergeProgress, normalizeProgress } from "@/lib/progress";
import {
  DEFAULT_SYNC,
  GitHubStore,
  GitHubSyncError,
  LocalStore,
  readSyncConfig,
  writeSyncConfig,
  type SyncConfig,
} from "@/lib/storage";
import { useProgress } from "./ProgressProvider";

/** Turns a sync failure into the specific token setting to fix. */
function explainSyncError(err: unknown, repo: string): string {
  if (err instanceof GitHubSyncError) {
    switch (err.status) {
      case 401:
        return "GitHub rejected the token (401). It's invalid, expired, or was copied incompletely. Generate a new one.";
      case 403:
        return `The token can see ${repo} but can't write to it (403). Set Repository permissions → Contents to "Read and write".`;
      case 404:
        return `The token can't see ${repo} (404). Under Repository access choose "Only select repositories" and add ${repo}, make sure Resource owner is your account, and check the owner/repo fields above.`;
    }
    return err.message;
  }
  if (err instanceof TypeError) {
    return "Couldn't reach api.github.com. Check your connection or any extension blocking requests.";
  }
  return err instanceof Error ? err.message : String(err);
}

type Notice = { tone: "ok" | "error"; text: string };

function NoticeLine({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-lg px-4 py-3 text-sm ${notice.tone === "ok" ? "bg-good-bg text-good" : "bg-bad-bg text-bad"}`}
    >
      {notice.text}
    </p>
  );
}

export function SettingsPanel() {
  const { data, storeKind, syncError, reload, replaceAll } = useProgress();
  const existing = typeof window === "undefined" ? null : readSyncConfig();
  const [form, setForm] = useState<SyncConfig>(() => existing ?? { ...DEFAULT_SYNC, token: "" });
  const [syncNotice, setSyncNotice] = useState<Notice | null>(null);
  const [backupNotice, setBackupNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const field = (key: keyof SyncConfig, label: string, type = "text") => (
    <label className="block text-sm">
      <span className="text-ink-2">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value.trim() })}
        autoComplete="off"
        spellCheck={false}
        className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm"
      />
    </label>
  );

  const enableSync = async () => {
    setBusy(true);
    setSyncNotice(null);
    try {
      const store = new GitHubStore(form);
      const remote = await store.fetchRemote();
      const local = await new LocalStore().load();
      // First sync pushes the merged copy, which also creates the file if it doesn't exist.
      await store.save(mergeProgress(local, remote.data));
      writeSyncConfig(form);
      await reload();
      setSyncNotice({
        tone: "ok",
        text: `Sync enabled. ${remote.sha ? "Merged with existing remote data." : "Created progress.json in the data repo."}`,
      });
    } catch (err) {
      setSyncNotice({ tone: "error", text: `Couldn't enable sync. ${explainSyncError(err, form.repo)}` });
    } finally {
      setBusy(false);
    }
  };

  const disableSync = async () => {
    writeSyncConfig(null);
    await reload();
    setForm({ ...form, token: "" });
    setSyncNotice({ tone: "ok", text: "Sync disabled. Progress stays in this browser, and the remote copy is untouched." });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fundamentals-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const incoming = normalizeProgress(JSON.parse(await file.text()));
      await replaceAll(mergeProgress(data, incoming));
      setBackupNotice({ tone: "ok", text: `Imported ${incoming.answers.length} answers (merged; nothing was removed).` });
    } catch {
      setBackupNotice({ tone: "error", text: "That file isn't valid progress JSON." });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Storage</h2>
        <p className="mt-1 text-sm text-ink-2">
          Currently: <strong>{storeKind === "github" ? "this browser + private GitHub repo" : "this browser only (localStorage)"}</strong>
          {" · "}
          {data.answers.length} answers, {data.sessions.length} sessions, {Object.keys(data.reviews).length} questions in review.
        </p>
        {syncError && <p className="mt-2 text-sm text-bad">Last sync error: {syncError}</p>}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Sync to a private GitHub repo</h2>
        <p className="mt-1 text-sm text-ink-2">
          Syncing lets you use several devices and lets the daily improvement routine read your results. Create a{" "}
          <a
            className="text-accent hover:underline"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >
            fine-grained token
          </a>{" "}
          with access to <strong>only</strong> the data repo and <strong>Contents: Read and write</strong>. The token is
          stored only in this browser&apos;s localStorage and is sent only to api.github.com.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("owner", "Owner")}
          {field("repo", "Data repo")}
          {field("branch", "Branch")}
          {field("path", "File path")}
        </div>
        <div className="mt-3">{field("token", "Fine-grained token", "password")}</div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void enableSync()}
            disabled={busy || !form.token}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            {busy ? "Connecting…" : storeKind === "github" ? "Save & resync" : "Test & enable sync"}
          </button>
          {storeKind === "github" && (
            <button type="button" onClick={() => void disableSync()} className="rounded-lg border border-line px-4 py-2 text-sm">
              Disable sync on this device
            </button>
          )}
        </div>
        <NoticeLine notice={syncNotice} />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Backup</h2>
        <p className="mt-1 text-sm text-ink-2">Export everything as JSON, or import a backup. Imports merge, so they never delete answers.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportJson} className="rounded-lg border border-line px-4 py-2 text-sm">
            Export JSON
          </button>
          <label className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <NoticeLine notice={backupNotice} />
      </section>
    </div>
  );
}
