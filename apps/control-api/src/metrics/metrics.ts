const counters = new Map<string, number>();
const labelsMap = new Map<string, Map<string, number>>();

export function inc(name: string, labels?: Record<string, string>, value = 1): void {
  if (!labels || Object.keys(labels).length === 0) {
    counters.set(name, (counters.get(name) ?? 0) + value);
    return;
  }
  const key = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
    .join(",");
  const inner = labelsMap.get(name) ?? new Map();
  inner.set(key, (inner.get(key) ?? 0) + value);
  labelsMap.set(name, inner);
}

export function set(name: string, value: number): void {
  counters.set(name, value);
}

export function render(): string {
  const lines: string[] = [];
  lines.push("# HELP oclushion_built_info Build info");
  lines.push("# TYPE oclushion_built_info gauge");
  lines.push(`oclushion_built_info{version="1.0.0",commit="unknown"} 1`);

  for (const [name, value] of counters) {
    lines.push(`# HELP ${name} ${name}`);
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name} ${value}`);
  }

  for (const [name, inner] of labelsMap) {
    lines.push(`# HELP ${name} ${name}`);
    lines.push(`# TYPE ${name} counter`);
    for (const [labels, value] of inner) {
      lines.push(`${name}{${labels}} ${value}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
