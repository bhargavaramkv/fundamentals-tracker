"use client";

import { useEffect, useRef, useState } from "react";
import { MEDIA_UPLOAD_ENABLED, UPLOAD_STATUS_TEXT } from "@/lib/journal/attachments";
import type { AttachmentInfo } from "@/lib/journal/types";
import { useJournal } from "../JournalProvider";

/** Camera and gallery pickers. Photos are compressed and kept on this device only. */
export function PhotoButtons({ sessionId }: { sessionId: string }) {
  const { addPhoto } = useJournal();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setSaved(false);
    let ok = true;
    for (const f of Array.from(files)) ok = (await addPhoto(sessionId, f)) && ok;
    setSaved(ok);
    setBusy(false);
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    void pick(files).then(() => (e.target.value = ""));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => camera.current?.click()} className="chip hover:bg-surface-2">
          Take photo
        </button>
        <button type="button" disabled={busy} onClick={() => gallery.current?.click()} className="chip hover:bg-surface-2">
          Choose from gallery
        </button>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label="Photo from camera" onChange={onChange} />
        <input ref={gallery} type="file" accept="image/*" multiple hidden aria-label="Photo from gallery" onChange={onChange} />
      </div>
      {busy && <p className="meta">Processing photo…</p>}
      {saved && !busy && (
        <p role="status" className="meta">
          {MEDIA_UPLOAD_ENABLED ? "Saved." : UPLOAD_STATUS_TEXT}
        </p>
      )}
    </div>
  );
}

const kb = (b: number) => `${Math.max(1, Math.round(b / 1024))} KB`;

/** Thumbnail of a photo stored on this device; click for the full size. */
export function PhotoThumb({ info }: { info: AttachmentInfo }) {
  const { loadPhoto } = useJournal();
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void loadPhoto(info.attachmentId).then((blob) => {
      if (!live) return;
      if (!blob) return setMissing(true);
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [info.attachmentId, loadPhoto]);

  const alt = info.name ? `Photo ${info.name}` : "Photo";
  if (missing) return <p className="meta mt-1">Photo ({info.width}×{info.height}) is stored on another device.</p>;
  if (!url) return <div className="mt-1 h-24 w-24 animate-pulse rounded-md bg-surface-2" aria-hidden />;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(true)} className="block overflow-hidden rounded-md border border-line" aria-label={`Open ${alt}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL, not a remote image */}
        <img src={url} alt={alt} width={info.width} height={info.height} className="h-24 w-auto max-w-full object-cover sm:h-28" />
      </button>
      <p className="meta mt-1">
        {info.width}×{info.height} · {kb(info.bytes)} · on this device
      </p>
      {open && <Viewer url={url} alt={alt} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Viewer({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3" onClick={onClose}>
      <div className="flex justify-end">
        <button ref={close} type="button" onClick={onClose} className="btn btn-secondary">
          Close
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
      <img src={url} alt={alt} className="mx-auto my-auto max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
