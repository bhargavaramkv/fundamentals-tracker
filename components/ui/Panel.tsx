import type { ElementType, ReactNode } from "react";

/** A surface. `hero` adds the atmosphere (glows and the horizon arc) for a page's focal block. */
export function Panel({
  as: Tag = "div",
  variant = "default",
  className = "",
  children,
}: {
  as?: ElementType;
  variant?: "default" | "hero";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`panel ${variant === "hero" ? "panel-hero" : ""} ${className}`}>{children}</Tag>;
}
