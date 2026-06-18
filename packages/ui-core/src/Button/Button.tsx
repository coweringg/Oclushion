import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { OclSize, OclVariant } from "../types";
import "./Button.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: OclVariant;
  size?: OclSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      icon,
      children,
      className = "",
      disabled,
      ...rest
    },
    ref,
  ) => {
    const classes = [
      "ocl-btn",
      `ocl-btn--${variant}`,
      `ocl-btn--${size}`,
      fullWidth ? "ocl-btn--full" : "",
      loading ? "ocl-btn--loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...rest}
      >
        {loading && (
          <span className="ocl-btn__spinner">
            <span className="ocl-spinner ocl-spinner--sm" />
          </span>
        )}
        <span className="ocl-btn__content">
          {icon && <span className="ocl-btn__icon">{icon}</span>}
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
