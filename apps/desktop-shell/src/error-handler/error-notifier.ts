import { t } from "../i18n/translate";
import { logger } from "../utils/logger";

export type ErrorLevel = "info" | "warn" | "error";

export type ErrorNotification = {
  id: string;
  title: string;
  message: string;
  level: ErrorLevel;
  timestamp: number;
  dismissed: boolean;
};

type ErrorListener = (notification: ErrorNotification) => void;

const listeners = new Set<ErrorListener>();
const notifications: ErrorNotification[] = [];
const MAX_NOTIFICATIONS = 50;

let counter = 0;

function generateId(): string {
  return `err-${++counter}-${Date.now()}`;
}

export function notifyError(
  title: string,
  message: string,
  level: ErrorLevel = "error",
): ErrorNotification {
  const notification: ErrorNotification = {
    id: generateId(),
    title,
    message,
    level,
    timestamp: Date.now(),
    dismissed: false,
  };

  notifications.push(notification);
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications.shift();
  }

  logger[level](`ErrorNotifier`, `[${level.toUpperCase()}] ${title}: ${message}`);
  listeners.forEach((listener) => listener(notification));

  return notification;
}

export function dismissError(id: string): void {
  const notification = notifications.find((n) => n.id === id);
  if (notification) {
    notification.dismissed = true;
  }
}

export function subscribeToErrors(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentErrors(limit = 10): ErrorNotification[] {
  return notifications.filter((n) => !n.dismissed).slice(-limit);
}

export function attachGlobalErrorHandler(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
    notifyError(t("common.error"), message, "error");
  });

  window.addEventListener("error", (event) => {
    notifyError(t("common.error"), event.message ?? "Unknown error", "error");
  });
}