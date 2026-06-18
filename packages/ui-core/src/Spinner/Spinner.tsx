import type { OclSize } from "../types";
import "./Spinner.css";

export interface SpinnerProps {
  size?: OclSize;
  variant?: "primary" | "success" | "danger" | "muted";
  className?: string;
}

export function Spinner({
  size = "md",
  variant = "primary",
  className = "",
}: SpinnerProps) {
  return (
    <span
      className={`ocl-spinner ocl-spinner--${size} ocl-spinner--${variant} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
