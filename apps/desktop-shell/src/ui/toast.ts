import { t } from "../i18n/translate";
import { playSuccessSound, playErrorSound } from "../notifications/notification-sound";

export type ToastSeverity = "success" | "error" | "warning" | "info";

export type ToastOptions = {
  severity: ToastSeverity;
  message: string;
  durationMs?: number;
  sound?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
};

const icons: Record<ToastSeverity, string> = {
  success: "OK",
  error: "ERR",
  warning: "WARN",
  info: "INFO",
};

export function showToast(options: ToastOptions): void {
  const { severity, message, durationMs = 4_000, sound = true, action } = options;
  if (sound) {
    if (severity === "success") playSuccessSound();
    else if (severity === "error") playErrorSound();
  }
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `ocl-toast ocl-toast--${severity}`;
  toast.setAttribute("role", severity === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", severity === "error" ? "assertive" : "polite");

  const icon = document.createElement("span");
  icon.className = "ocl-toast__icon";
  icon.textContent = icons[severity];
  toast.append(icon);

  const body = document.createElement("span");
  body.className = "ocl-toast__message";
  body.textContent = message;
  toast.append(body);

  if (action) {
    const actionButton = document.createElement("button");
    actionButton.className = "ocl-toast__action";
    actionButton.type = "button";
    actionButton.textContent = action.label;
    actionButton.addEventListener("click", () => {
      action.onClick();
      toast.remove();
    });
    toast.append(actionButton);
  }

  const close = document.createElement("button");
  close.className = "ocl-toast__close";
  close.type = "button";
  close.setAttribute("aria-label", t("toasts.closeNotification"));
  close.textContent = "x";
  close.addEventListener("click", () => toast.remove());
  toast.append(close);

  container.append(toast);
  if (durationMs > 0) {
    window.setTimeout(() => toast.remove(), durationMs);
  }
}

function ensureToastContainer(): HTMLElement {
  let container = document.querySelector<HTMLElement>("#toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "ocl-toast-container";
    document.body.append(container);
  }
  return container;
}
