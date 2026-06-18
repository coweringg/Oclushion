import type { OclSize, OclColor } from "../types";
import "./Badge.css";

export interface BadgeProps {
  variant?: OclColor;
  size?: OclSize;
  dot?: boolean;
  count?: number;
  children?: string;
  className?: string;
}

export function Badge({
  variant = "default",
  size = "md",
  dot = false,
  count,
  children,
  className = "",
}: BadgeProps) {
  const classes = [
    "ocl-badge",
    `ocl-badge--${variant}`,
    dot ? "ocl-badge--dot" : `ocl-badge--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const label = count !== undefined
    ? (count > 99 ? "99+" : String(count))
    : children;

  return <span className={classes}>{label}</span>;
}
