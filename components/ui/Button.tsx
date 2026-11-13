import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Common = {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
};
type AsLink = Common & { href: string };
type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

/** A button, or a Link when given `href`. Uses the shared .btn classes. */
export function Button(props: AsLink | AsButton) {
  const { variant = "secondary", size = "md", className = "", children } = props;
  const cls = `btn btn-${variant} ${variant === "ghost" ? "btn-muted" : ""} ${size === "lg" ? "btn-lg" : ""} ${className}`;
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }
  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, ...rest } = props;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
