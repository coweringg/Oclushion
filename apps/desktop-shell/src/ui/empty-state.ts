export type EmptyStateOptions = {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    id?: string;
    variant?: "primary" | "secondary" | "danger";
  };
  compact?: boolean;
  panel?: boolean;
  iconVariant?: "default" | "muted" | "success" | "warning";
};

export function renderEmptyState(options: EmptyStateOptions): string {
  const variant = options.iconVariant ?? "default";
  const sizeClass = options.compact ? "empty-state--compact" : options.panel ? "empty-state--panel" : "";
  const actionVariant = options.action?.variant ?? "primary";
  const actionClass = actionVariant === "primary"
    ? "empty-state-action"
    : `empty-state-action empty-state-action--${actionVariant}`;

  return `
    <div class="empty-state ${sizeClass}">
      ${options.icon ? `<div class="empty-state-icon empty-state-icon--${variant}">${options.icon}</div>` : ""}
      <h3 class="empty-state-title">${escapeHtml(options.title)}</h3>
      ${options.description ? `<p class="empty-state-description">${escapeHtml(options.description)}</p>` : ""}
      ${options.action ? `<button type="button" class="${actionClass}"${options.action.id ? ` id="${options.action.id}"` : ""}>${escapeHtml(options.action.label)}</button>` : ""}
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
