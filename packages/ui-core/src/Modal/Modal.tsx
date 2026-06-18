import { useEffect, useCallback, type ReactNode } from "react";
import type { OclSize } from "../types";
import "./Modal.css";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: OclSize | "full";
  closeOnOverlay?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="ocl-modal-overlay"
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`ocl-modal ocl-modal--${size}`}>
        {title && (
          <div className="ocl-modal-header">
            <h2 className="ocl-modal-title">{title}</h2>
            <button
              className="ocl-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        <div className="ocl-modal-body">{children}</div>
        {footer && <div className="ocl-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
