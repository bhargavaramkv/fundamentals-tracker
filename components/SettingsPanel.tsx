"use client";

import { useState } from "react";
import { mergeProgress, normalizeProgress } from "@/lib/progress";
import { DATA_REPO } from "@/lib/storage";
import { useAuth } from "./AuthGate";
import { useProgress } from "./ProgressProvider";

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
  const { data, storeKind, syncError, replaceAll } = useProgress();
  const { syncToken, connectSync, disconnectSync, signOut } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState<Notice | null>(null);
  const [backupNotice, setBackupNotice] = useState<Notice | null>(null);

  const connect = async () => {
    setBusy(true);
    setSyncNotice(null);
    const error = await connectSync(token);
    setBusy(false);
    if (error) {
      setSyncNotice({ tone: "error", text: `Couldn't enable sync. ${error}` });
      return;
    }
    setToken("");
    setSyncNotice({ tone: "ok", text: "Sync enabled. Progress is now saved to the data repo." });
  };

  const disconnect = async () => {
    await disconnectSync();
    setSyncNotice({ tone: "ok", text: "Sync disabled on this device. The remote copy is untouched." });
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

  const vault = `${DATA_REPO.owner}/${DATA_REPO.repo}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Storage</h2>
        <p className="mt-1 text-sm text-ink-2">
          Currently:{" "}
          <strong>{storeKind === "github" ? `this browser + ${vault} (private)` : "this browser only"}</strong> ·{" "}
          {data.answers.length} answers, {data.sessions.length} sessions, {Object.keys(data.reviews).length} questions in
          review.
        </p>
        {syncError && <p className="mt-2 text-sm text-bad">Last sync error: {syncError}</p>}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Sync to GitHub</h2>
        {syncToken ? (
          <>
            <p className="mt-1 text-sm text-ink-2">
              Progress syncs to <code>{vault}/{DATA_REPO.path}</code>, where the daily routine reads it. If the token expires,
              paste a new one below.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-2">
            One-time setup per device. It lets the daily improvement routine see your results and keeps devices in sync. Create
            a{" "}
            <a
              className="text-accent hover:underline"
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              fine-grained token
            </a>{" "}
            with access to only <strong>{DATA_REPO.repo}</strong> and <strong>Contents: Read and write</strong>. It&apos;s stored
            encrypted with your password, so it can&apos;t be used from this browser after you sign out.
          </p>
        )}
        <label className="mt-4 block text-sm">
          <span className="text-ink-2">{syncToken ? "Replace token" : "Token"}</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy || token.trim().length < 20}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            {busy ? "Connecting…" : syncToken ? "Save & resync" : "Test & enable sync"}
          </button>
          {syncToken && (
            <button type="button" onClick={() => void disconnect()} className="rounded-lg border border-line px-4 py-2 text-sm">
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

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Account</h2>
        <p className="mt-1 text-sm text-ink-2">You stay signed in on this device for 30 days.</p>
        <button type="button" onClick={signOut} className="mt-4 rounded-lg border border-line px-4 py-2 text-sm text-bad">
          Sign out
        </button>
      </section>
    </div>
  );
}
