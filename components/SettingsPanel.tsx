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
  const { data, syncState, syncError, reload, replaceAll } = useProgress();
  const { signIn, signOut } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessNotice, setAccessNotice] = useState<Notice | null>(null);
  const [backupNotice, setBackupNotice] = useState<Notice | null>(null);

  const replaceToken = async () => {
    setBusy(true);
    setAccessNotice(null);
    const error = await signIn(token);
    setBusy(false);
    if (error) {
      setAccessNotice({ tone: "error", text: error });
      return;
    }
    setToken("");
    await reload();
    setAccessNotice({ tone: "ok", text: "Credential updated and progress resynced." });
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
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-3">SYSTEMS</p>
        <h1 className="font-comic text-4xl text-white">Control panel</h1>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-comic text-2xl text-white">Data vault</h2>
        <p className="mt-1 text-sm text-ink-2">
          Progress syncs to <code className="font-mono text-accent">{vault}/{DATA_REPO.path}</code> (private). The daily
          improvement routine reads it from there.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          {data.answers.length} answers · {data.sessions.length} sessions · {Object.keys(data.reviews).length} questions in
          review ·{" "}
          <span className={syncState === "error" ? "text-bad" : "text-good"}>
            {syncState === "syncing" ? "syncing…" : syncState === "error" ? "sync error" : "in sync"}
          </span>
        </p>
        {syncError && <p className="mt-2 text-sm text-bad">Last sync error: {syncError}</p>}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-comic text-2xl text-white">Access credential</h2>
        <p className="mt-1 text-sm text-ink-2">
          Signed in on this device. The token lives only in this browser and is only sent to api.github.com. When it
          expires you&apos;ll be returned to the sign-in screen. Paste a new one here first to avoid that.
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-mono text-xs tracking-wider text-ink-3 uppercase">Replacement token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="github_pat_…"
            className="mt-1 w-full rounded-md border border-line bg-black/60 px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void replaceToken()}
            disabled={busy || token.trim().length < 20}
            className="rounded bg-accent px-4 py-2 text-sm font-bold text-accent-ink uppercase hover:bg-white disabled:opacity-40"
          >
            {busy ? "Verifying…" : "Replace token"}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded border border-bad/50 px-4 py-2 text-sm font-bold text-bad uppercase hover:bg-bad-bg"
          >
            Sign out on this device
          </button>
        </div>
        <NoticeLine notice={accessNotice} />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-comic text-2xl text-white">Backup</h2>
        <p className="mt-1 text-sm text-ink-2">Export everything as JSON, or import a backup. Imports merge, so they never delete answers.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportJson} className="rounded border border-line px-4 py-2 text-sm hover:border-accent">
            Export JSON
          </button>
          <label className="cursor-pointer rounded border border-line px-4 py-2 text-sm hover:border-accent">
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
