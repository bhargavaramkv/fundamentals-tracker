"use client";

import { useState } from "react";
import { mergeProgress, normalizeProgress } from "@/lib/progress";
import { SHARED_TOKEN } from "@/lib/auth";
import { DATA_REPO } from "@/lib/storage";
import { useAuth } from "./AuthGate";
import { useProgress } from "./ProgressProvider";

type Notice = { tone: "ok" | "warn" | "error"; text: string };

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

export function SettingsPanel() {
  const { data, storeKind, syncError, replaceAll } = useProgress();
  const { syncToken, sharedAcrossDevices, connectSync, disconnectSync, signOut } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState<Notice | null>(null);
  const [backupNotice, setBackupNotice] = useState<Notice | null>(null);

  const connect = async () => {
    setBusy(true);
    setSyncNotice(null);
    const { error, warning } = await connectSync(token);
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
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <section className="card p-5">
        <h2 className="font-medium">Storage</h2>
        <p className="mt-1 text-sm text-ink-2">
          Currently:{" "}
          <strong>{storeKind === "github" ? `this browser + ${vault} (private)` : "this browser only"}</strong> ·{" "}
          {data.answers.length} answers, {data.sessions.length} sessions, {Object.keys(data.reviews).length} questions in
          review.
        </p>
        {syncError && <p className="mt-2 text-sm text-bad">Last sync error: {syncError}</p>}
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Sync to GitHub</h2>
        {syncToken ? (
          <>
            <p className="mt-1 text-sm text-ink-2">
              Progress syncs to <code>{vault}/{DATA_REPO.path}</code>, where the daily routine reads it.{" "}
              {sharedAcrossDevices
                ? "Set up for your account: every device you sign in on syncs automatically."
                : "Set up on this device only. Save the token again with access to both repos to enable it everywhere."}{" "}
              If the token expires, paste a new one below. That updates every device.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-2">
            One-time setup for your account; every device you sign in on picks it up automatically. It lets the daily
            improvement routine see your results and keeps devices in sync. Create a{" "}
            <a
              className="text-accent hover:underline"
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              fine-grained token
            </a>{" "}
            with access to only <strong>{DATA_REPO.repo}</strong> and <strong>{SHARED_TOKEN.repo}</strong>, permission{" "}
            <strong>Contents: Read and write</strong>. It&apos;s saved encrypted with your password, so it&apos;s useless to
            anyone without it.
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
            className="tap btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:shadow-none"
          >
            {busy ? "Connecting…" : syncToken ? "Save & resync" : "Test & enable sync"}
          </button>
          {syncToken && (
            <button type="button" onClick={() => void disconnect()} className="tap rounded-lg border border-line px-4 py-2 text-sm">
              Turn off sync
            </button>
          )}
        </div>
        <NoticeLine notice={syncNotice} />
      </section>

      <section className="card p-5">
        <h2 className="font-medium">Backup</h2>
        <p className="mt-1 text-sm text-ink-2">Export everything as JSON, or import a backup. Imports merge, so they never delete answers.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportJson} className="tap rounded-lg border border-line px-4 py-2 text-sm">
            Export JSON
          </button>
          <label className="tap cursor-pointer rounded-lg border border-line px-4 py-2 text-sm">
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

      <section className="card p-5">
        <h2 className="font-medium">Account</h2>
        <p className="mt-1 text-sm text-ink-2">You stay signed in on this device for 30 days.</p>
        <button type="button" onClick={signOut} className="tap mt-4 rounded-lg border border-line px-4 py-2 text-sm text-bad">
          Sign out
        </button>
      </section>
    </div>
  );
}
