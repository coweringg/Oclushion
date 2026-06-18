import { useEffect, type ReactNode } from "react";
import type { OclColor } from "../types";
import "./Toast.css";

export interface ToastProps {
  message: string;
  type?: OclColor;
  duration?: number;
  onClose?: () => void;
  icon?: ReactNode;
}

export function Toast({
  message,
  type = "info",
  duration = 4000,
  onClose,
  icon,
}: ToastProps) {
  useEffect(() => {
    if (duration <= 0 || !onClose) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`ocl-toast ocl-toast--${type}`} role="alert">
      {icon && <span className="ocl-toast-icon">{icon}</span>}
      <span className="ocl-toast-message">{message}</span>
      {onClose && (
        <button className="ocl-toast-dismiss" onClick={onClose} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
