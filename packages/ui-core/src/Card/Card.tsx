import { type ReactNode, type HTMLAttributes } from "react";
import "./Card.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  title,
  children,
  footer,
  hoverable = false,
  padding = "md",
  className = "",
  ...rest
}: CardProps) {
  const classes = [
    "ocl-card",
    hoverable ? "ocl-card--hoverable" : "",
    padding !== "md" ? `ocl-card--padding-${padding}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {title && <div className="ocl-card-header">{title}</div>}
      <div className="ocl-card-body" style={{ padding: `0 ${padding === "none" ? 0 : "16px"} ${padding === "none" ? 0 : "16px"} ${padding === "none" ? 0 : "16px"}` }}>
        {children}
      </div>
      {footer && <div className="ocl-card-footer">{footer}</div>}
    </div>
  );
}
