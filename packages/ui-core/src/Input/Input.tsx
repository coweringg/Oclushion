import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import type { OclSize } from "../types";
import "./Input.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  inputSize?: OclSize;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      inputSize = "md",
      fullWidth = false,
      className = "",
      disabled,
      ...rest
    },
    ref,
  ) => {
    const containerClasses = [
      "ocl-input-container",
      error ? "ocl-input-container--error" : "",
      disabled ? "ocl-input-container--disabled" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        className="ocl-input-wrapper"
        style={fullWidth ? { width: "100%" } : undefined}
      >
        {label && <label className="ocl-input-label">{label}</label>}
        <div className={containerClasses}>
          {icon && <span className="ocl-input-icon">{icon}</span>}
          <input
            ref={ref}
            className={`ocl-input ocl-input--${inputSize}`}
            disabled={disabled}
            {...rest}
          />
        </div>
        {error && <span className="ocl-input-error">{error}</span>}
        {helperText && !error && (
          <span className="ocl-input-helper">{helperText}</span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
