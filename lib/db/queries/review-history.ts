import "server-only";

import { db } from "@/lib/db/client";
import { toISOString } from "@/lib/utils/date";

export type ReviewHistoryKind =
  | "submitted"
  | "renewalSubmitted"
  | "documentsRequested"
  | "detailsRequested"
  | "documentsProvided"
  | "detailsUpdated"
  | "approved"
  | "rejected"
  | "suspended"
  | "expired";

export interface ReviewHistoryEntry {
  id: string;
  kind: ReviewHistoryKind;
  at: string;
  message: string | null;
  reason: string | null;
  items: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
}

function stringArrayField(value: unknown, key: string): string[] {
  if (!isRecord(value)) return [];
  const field = value[key];
  if (!Array.isArray(field)) return [];
  return field.filter((v): v is string => typeof v === "string");
}

function itemsFromObjectArray(
  value: unknown,
  key: string,
  itemKey: string,
): string[] {
  if (!isRecord(value)) return [];
  const field = value[key];
  if (!Array.isArray(field)) return [];
  const items: string[] = [];
  for (const entry of field) {
    if (!isRecord(entry)) continue;
    const item = entry[itemKey];
    if (typeof item === "string") items.push(item);
  }
  return items;
}

export async function getOwnVerificationHistory(
  customerId: string,
): Promise<ReviewHistoryEntry[]> {
  const [events, customer] = await Promise.all([
    db.verificationEvent.findMany({
      where: { customerId },
      select: { id: true },
    }),
    db.customer.findUnique({
      where: { id: customerId },
      select: { verificationExpiresAt: true },
    }),
  ]);

  const eventIds = events.map((e) => e.id);
  if (eventIds.length === 0) return [];

  const rows = await db.auditLog.findMany({
    where: {
      entityType: "VerificationEvent",
      entityId: { in: eventIds },
      action: {
        in: [
          "verification.submit",
          "verification.documents_requested",
          "verification.details_requested",
          "verification.documents_provided",
          "verification.details_updated",
          "verification.approve",
          "verification.override_approve",
          "verification.reject",
          "verification.expire",
          "verification.request_cancelled",
        ],
      },
    },
    select: {
      id: true,
      action: true,
      entityId: true,
      createdAt: true,
      after: true,
      metadata: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const cancelledRequestIds = new Set<string>();
  for (const row of rows) {
    if (row.action === "verification.request_cancelled") {
      const requestId = stringField(row.metadata, "requestId");
      if (requestId) cancelledRequestIds.add(requestId);
    }
  }

  const entries: ReviewHistoryEntry[] = [];
  for (const row of rows) {
    switch (row.action) {
      case "verification.submit": {
        entries.push({
          id: row.id,
          kind: "submitted",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      case "verification.documents_requested": {
        const requestId = isRecord(row.after)
          ? row.after.requestId
          : undefined;
        if (
          typeof requestId === "string" &&
          cancelledRequestIds.has(requestId)
        ) {
          break;
        }
        entries.push({
          id: row.id,
          kind: "documentsRequested",
          at: toISOString(row.createdAt),
          message: stringField(row.metadata, "note"),
          reason: null,
          items: stringArrayField(row.after, "roles"),
        });
        break;
      }
      case "verification.details_requested": {
        const requestId = isRecord(row.after)
          ? row.after.requestId
          : undefined;
        if (
          typeof requestId === "string" &&
          cancelledRequestIds.has(requestId)
        ) {
          break;
        }
        entries.push({
          id: row.id,
          kind: "detailsRequested",
          at: toISOString(row.createdAt),
          message: stringField(row.metadata, "note"),
          reason: null,
          items: [],
        });
        break;
      }
      case "verification.details_updated": {
        entries.push({
          id: row.id,
          kind: "detailsUpdated",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      case "verification.documents_provided": {
        entries.push({
          id: row.id,
          kind: "documentsProvided",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: itemsFromObjectArray(row.after, "documents", "role"),
        });
        break;
      }
      case "verification.approve":
      case "verification.override_approve": {
        entries.push({
          id: row.id,
          kind: "approved",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      case "verification.reject": {
        entries.push({
          id: row.id,
          kind: "rejected",
          at: toISOString(row.createdAt),
          message: null,
          reason: stringField(row.after, "rejectionReason"),
          items: [],
        });
        break;
      }
      case "verification.expire": {
        entries.push({
          id: row.id,
          kind: "expired",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      default:
        break;
    }
  }

  const decisionRow = rows.find((row) =>
    [
      "verification.approve",
      "verification.override_approve",
      "verification.reject",
      "verification.expire",
    ].includes(row.action),
  );
  const expiresAt = customer?.verificationExpiresAt ?? null;
  if (
    expiresAt &&
    expiresAt.getTime() <= Date.now() &&
    decisionRow &&
    (decisionRow.action === "verification.approve" ||
      decisionRow.action === "verification.override_approve")
  ) {
    entries.push({
      id: "derived-expiry",
      kind: "expired",
      at: toISOString(expiresAt),
      message: null,
      reason: null,
      items: [],
    });
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return entries;
}

export async function getOwnB2BHistory(
  customerId: string,
): Promise<ReviewHistoryEntry[]> {
  const accounts = await db.b2BAccount.findMany({
    where: { customerId },
    select: { id: true, status: true, expiresAt: true },
  });

  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  const rows = await db.auditLog.findMany({
    where: {
      entityType: "B2BAccount",
      entityId: { in: accountIds },
      action: {
        in: [
          "b2b.registration_submitted",
          "b2b.renewal_requested",
          "b2b.documents_requested",
          "b2b.details_requested",
          "b2b.documents_provided",
          "b2b.details_updated",
          "b2b.approve",
          "b2b.override_approve",
          "b2b.reject",
          "b2b.suspend",
          "b2b.expire",
          "b2b.request_cancelled",
        ],
      },
    },
    select: {
      id: true,
      action: true,
      entityId: true,
      createdAt: true,
      after: true,
      metadata: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const cancelledRequestIds = new Set<string>();
  for (const row of rows) {
    if (row.action === "b2b.request_cancelled") {
      const requestId = stringField(row.metadata, "requestId");
      if (requestId) cancelledRequestIds.add(requestId);
    }
  }

  const entries: ReviewHistoryEntry[] = [];
  for (const row of rows) {
    switch (row.action) {
      case "b2b.registration_submitted": {
        entries.push({
          id: row.id,
          kind: "submitted",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      case "b2b.renewal_requested": {
        entries.push({
          id: row.id,
          kind: "renewalSubmitted",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      case "b2b.documents_requested": {
        const requestId = isRecord(row.after)
          ? row.after.requestId
          : undefined;
        if (
          typeof requestId === "string" &&
          cancelledRequestIds.has(requestId)
        ) {
          break;
        }
        entries.push({
          id: row.id,
          kind: "documentsRequested",
          at: toISOString(row.createdAt),
          message: stringField(row.metadata, "note"),
          reason: null,
          items: [],
        });
        break;
      }
      case "b2b.details_requested": {
        const requestId = isRecord(row.after)
          ? row.after.requestId
          : undefined;
        if (
          typeof requestId === "string" &&
          cancelledRequestIds.has(requestId)
        ) {
          break;
        }
        entries.push({
          id: row.id,
          kind: "detailsRequested",
          at: toISOString(row.createdAt),
          message: stringField(row.metadata, "note"),
          reason: null,
          items: [],
        });
        break;
      }
      case "b2b.documents_provided": {
        entries.push({
          id: row.id,
          kind: "documentsProvided",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: itemsFromObjectArray(row.after, "documents", "type"),
        });
        break;
      }
      case "b2b.details_updated": {
        entries.push({
          id: row.id,
          kind: "detailsUpdated",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      case "b2b.approve":
      case "b2b.override_approve": {
        entries.push({
          id: row.id,
          kind: "approved",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      case "b2b.reject": {
        entries.push({
          id: row.id,
          kind: "rejected",
          at: toISOString(row.createdAt),
          message: null,
          reason: stringField(row.metadata, "reason"),
          items: [],
        });
        break;
      }
      case "b2b.suspend": {
        entries.push({
          id: row.id,
          kind: "suspended",
          at: toISOString(row.createdAt),
          message: null,
          reason: stringField(row.metadata, "reason"),
          items: [],
        });
        break;
      }
      case "b2b.expire": {
        entries.push({
          id: row.id,
          kind: "expired",
          at: toISOString(row.createdAt),
          message: null,
          reason: null,
          items: [],
        });
        break;
      }
      default:
        break;
    }
  }

  for (const account of accounts) {
    const accountRows = rows.filter(
      (row) =>
        row.entityId === account.id &&
        [
          "b2b.approve",
          "b2b.override_approve",
          "b2b.reject",
          "b2b.suspend",
          "b2b.expire",
        ].includes(row.action),
    );
    const decisionRow = accountRows[0];
    if (
      account.status === "APPROVED" &&
      account.expiresAt &&
      account.expiresAt.getTime() <= Date.now() &&
      decisionRow &&
      (decisionRow.action === "b2b.approve" ||
        decisionRow.action === "b2b.override_approve")
    ) {
      entries.push({
        id: `derived-expiry-${account.id}`,
        kind: "expired",
        at: toISOString(account.expiresAt),
        message: null,
        reason: null,
        items: [],
      });
    }
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return entries;
}
