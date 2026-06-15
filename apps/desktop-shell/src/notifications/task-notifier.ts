import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { t } from "../i18n/translate";

export type TaskCompletionPayload = {
  taskTitle: string;
  agentRole: string;
  durationSeconds: number;
  status: "success" | "error" | "partial";
};

export async function notifyTaskCompleted(payload: TaskCompletionPayload): Promise<void> {
  if (!isTauriRuntime() || !isAppInBackground()) {
    return;
  }
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    permissionGranted = (await requestPermission()) === "granted";
  }
  if (!permissionGranted) {
    return;
  }
  const icon = payload.status === "success" ? t("common.ok") : payload.status === "error" ? t("common.err") : t("common.warn");
  sendNotification({
    title: `${icon} ${t("notifications.taskComplete")}`,
    body: t("notifications.taskFinished", { role: payload.agentRole, title: payload.taskTitle, duration: Math.round(payload.durationSeconds) }),
  });
}

export function emitTaskCompletedEvent(payload: TaskCompletionPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<TaskCompletionPayload>("agent:task:completed", { detail: payload }));
}

function isAppInBackground(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return document.visibilityState !== "visible";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
