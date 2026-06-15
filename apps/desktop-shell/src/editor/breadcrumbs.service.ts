export type BreadcrumbItem = {
  readonly label: string;
  readonly path: string;
  readonly isLast: boolean;
};

export class BreadcrumbsService {
  parse(filePath: string | null): BreadcrumbItem[] {
    if (!filePath) return [];
    const isWindows = filePath.includes("\\");
    const separator = isWindows ? "\\" : "/";
    const segments = filePath.split(separator).filter(Boolean);
    return segments.map((segment, index) => ({
      label: segment,
      path: segments.slice(0, index + 1).join("/"),
      isLast: index === segments.length - 1,
    }));
  }

  render(items: BreadcrumbItem[]): string {
    if (items.length === 0) return "";
    return items
      .map((item) => {
        if (item.isLast) {
          return `<span class="breadcrumb-current">${escapeHtml(item.label)}</span>`;
        }
        return `<button class="breadcrumb-segment" data-breadcrumb-path="${escapeHtml(item.path)}" type="button">${escapeHtml(item.label)}</button>`;
      })
      .join('<span class="breadcrumb-separator">›</span>');
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
