import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/mentor/markdown";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) =>
        x.t === "bold" ? (
          <strong key={i} className="font-semibold text-ink">
            {x.text}
          </strong>
        ) : x.t === "code" ? (
          <code key={i} className="mono rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">
            {x.text}
          </code>
        ) : (
          <Fragment key={i}>{x.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Read-only markdown. Renders tokens as React elements, so every string is escaped; there is no raw HTML path. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">
      {parseMarkdown(source).map((b, i) => {
        if (b.t === "heading") {
          return (
            <h3 key={i} className={b.level === 1 ? "text-lg text-ink" : "pt-2 text-base text-ink"}>
              <Inlines items={b.inline} />
            </h3>
          );
        }
        if (b.t === "list") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j} className="break-words">
                  <Inlines items={it} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.t === "code") {
          return (
            <pre key={i} className="mono overflow-x-auto rounded-lg bg-surface-2 p-3 text-[13px]">
              {b.text}
            </pre>
          );
        }
        return (
          <p key={i} className="break-words">
            <Inlines items={b.inline} />
          </p>
        );
      })}
    </div>
  );
}
