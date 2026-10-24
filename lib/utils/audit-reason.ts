import type { AuditLogListItem } from "@/lib/db/queries/audit-log";

export const DECISION_VERBS = new Set([
  "approve",
  "override_approve",
  "reject",
  "suspend",
  "expire",
]);

export interface DecisionEvent {
  action: string;
  actorName: string;
  reason: string | null;
  createdAt: string;
}

function firstStringField(
  value: unknown,
  keys: readonly string[],
): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const field = record[key];
    if (typeof field === "string") {
      const trimmed = field.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return null;
}

export function reasonTextOf(row: {
  metadata: unknown;
  after: unknown;
}): string | null {
  return (
    firstStringField(row.metadata, ["reason", "justification", "note"]) ??
    firstStringField(row.after, ["rejectionReason", "reason"])
  );
}

export function latestDecisionOf(
  items: AuditLogListItem[],
): DecisionEvent | null {
  for (const item of items) {
    const verb = item.action.slice(item.action.lastIndexOf(".") + 1);
    if (DECISION_VERBS.has(verb)) {
      return {
        action: item.action,
        actorName: item.actorName,
        reason: reasonTextOf(item),
        createdAt: item.createdAt,
      };
    }
  }

  return null;
}
