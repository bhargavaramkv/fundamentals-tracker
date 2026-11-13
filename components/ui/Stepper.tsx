import type { ReactNode } from "react";

export type Step = { title: ReactNode; detail?: ReactNode; state?: "now" | "due" | "next" };

/** Vertical timeline ("Next up"): the current step glows, a due step is amber. */
export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => {
        const state = s.state ?? "next";
        const last = i === steps.length - 1;
        return (
          <li key={i} className={`relative flex gap-4 ${last ? "" : "pb-6"}`}>
            {!last && <span aria-hidden className="absolute bottom-1 left-[9px] top-6 w-px bg-line-2" />}
            <span
              aria-hidden
              className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] bg-surface ${
                state === "now" ? "border-accent bg-accent/20 shadow-[0_0_14px_rgba(59,155,255,0.55)]" : state === "due" ? "border-warn" : "border-[#2c3d62]"
              }`}
            >
              {state === "now" && <span className="h-1.5 w-1.5 rounded-full bg-[#8cc6ff]" />}
            </span>
            <div>
              <b className="block text-[15px] font-medium leading-snug">{s.title}</b>
              {s.detail && <small className={`mt-0.5 block text-[13px] ${state === "due" ? "text-warn" : "text-muted"}`}>{s.detail}</small>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
