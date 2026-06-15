export function s(tags: string[], summary: string, operationId: string, extra?: Record<string, unknown>) {
  return {
    tags,
    summary,
    operationId,
    ...extra,
  };
}

export const uuidParam = { type: "string", format: "uuid", description: "UUID" } as const;

export const paginationQuery = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100, default: 10 },
  },
} as const;

export const errorResponse = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    issues: {
      type: "array",
      items: { type: "object" },
    },
  },
} as const;
