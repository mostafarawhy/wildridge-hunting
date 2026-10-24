"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { nextTicketNumber } from "@/lib/db/queries/ticket-sequence";
import {
  searchTicketLinkTargets,
  getTicketLinkTarget,
  type TicketLinkOption,
} from "@/lib/db/queries/ticket";
import { requireStaffAction } from "@/lib/auth-staff";
import { can } from "@/lib/utils/staff-permissions";
import {
  TICKET_TRANSITIONS,
  isTerminalTicketStatus,
  TICKET_LINK_KIND,
  TICKET_STATUS_LABELS,
} from "@/lib/utils/ticket-status";
import {
  createTicketSchema,
  transitionTicketSchema,
  assignTicketSchema,
  addTicketCommentSchema,
  reopenTicketSchema,
  updateTicketTextSchema,
  searchTicketLinksSchema,
  updateTicketTriageSchema,
} from "@/lib/validations/ticket";
import { logAndSendEmail } from "@/lib/services/resend";
import { getSetting } from "@/lib/db/queries/settings";
import { loadTicketEmailData, staffTicketChrome } from "@/lib/email/ticket-email";
import { excerpt } from "@/lib/email/chrome";

export type TicketActionErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_LINK"
  | "LINK_REQUIRED"
  | "LINK_MISMATCH"
  | "INVALID_ASSIGNEE"
  | "ASSIGNEE_INELIGIBLE"
  | "INVALID_TRANSITION"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

// ─── createTicketAction ───────────────────────────────────────────────────────

export async function createTicketAction(
  input: unknown,
): Promise<
  | { success: true; data: { ticketId: string; ticketNumber: string } }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  const staff = await requireStaffAction("ticket:manage");

  try {
    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const {
      subject,
      description,
      category,
      priority,
      contactEmail,
      linkId,
      assignedToStaffId,
    } = parsed.data;

    const kind = TICKET_LINK_KIND[category];

    if (kind !== "customer" && !linkId) {
      return {
        success: false,
        error: "Select the linked record for this category.",
        errorCode: "LINK_REQUIRED",
      };
    }

    let target: TicketLinkOption | null = null;
    if (linkId) {
      target = await getTicketLinkTarget(kind, linkId);
      if (!target) {
        return {
          success: false,
          error: "Linked record not found.",
          errorCode: "INVALID_LINK",
        };
      }
    }

    const customerId = target?.customerId ?? null;
    const resolvedContactEmail = target?.customerEmail ?? contactEmail;
    if (!resolvedContactEmail) {
      return {
        success: false,
        error: "Customer email is required.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const creator = await db.staff.findUnique({
      where: { id: staff.id },
      select: { name: true },
    });
    const creatorName = creator?.name ?? "a team member";

    let assigneeName: string | null = null;
    let assigneeEmail: string | null = null;
    if (assignedToStaffId) {
      const assignee = await db.staff.findUnique({
        where: { id: assignedToStaffId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      if (!assignee) {
        return {
          success: false,
          error: "Assignee not found.",
          errorCode: "INVALID_ASSIGNEE",
        };
      }
      if (!assignee.isActive || !can(assignee.role, "ticket:manage")) {
        return {
          success: false,
          error: "This staff member cannot be assigned tickets.",
          errorCode: "ASSIGNEE_INELIGIBLE",
        };
      }
      assigneeName = assignee.name;
      assigneeEmail = assignee.email;
    }

    const now = new Date();

    const { ticketId, ticketNumber } = await db.$transaction(
      async (tx) => {
        const ticketNumber = await nextTicketNumber(tx, now);
        const created = await tx.ticket.create({
          data: {
            ticketNumber,
            subject,
            description,
            category,
            priority,
            status: "OPEN",
            orderId: kind === "order" ? (linkId ?? null) : null,
            quoteRequestId: kind === "quote" ? (linkId ?? null) : null,
            b2bAccountId: kind === "b2b" ? (linkId ?? null) : null,
            verificationEventId: kind === "verification" ? (linkId ?? null) : null,
            customerId,
            contactEmail: resolvedContactEmail,
            assignedToStaffId: assignedToStaffId ?? null,
            createdByStaffId: staff.id,
          },
          select: { id: true, ticketNumber: true },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: created.id,
            type: "STATUS_CHANGE",
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: null,
            toStatus: "OPEN",
            note: null,
          },
        });
        if (assignedToStaffId) {
          await tx.ticketEvent.create({
            data: {
              ticketId: created.id,
              type: "ASSIGNMENT",
              actor: "STAFF",
              staffId: staff.id,
              fromStatus: null,
              toStatus: null,
              note: assigneeName,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "ticket.created",
            entityType: "Ticket",
            entityId: created.id,
            metadata: {
              ticketNumber: created.ticketNumber,
              category,
              priority,
              assignedToStaffId: assignedToStaffId ?? null,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return { ticketId: created.id, ticketNumber: created.ticketNumber };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/tickets");

    after(async () => {
      const { support: supportRecipients } = await getSetting("email_recipients");
      const data = await loadTicketEmailData(ticketId);
      if (!data) return;
      for (const toEmail of supportRecipients) {
        await logAndSendEmail({
          templateKey: "ticket.created",
          toEmail,
          payload: { ticketNumber, subject },
          chromeOptions: staffTicketChrome(data, {
            excerpt: { label: "Message", text: excerpt(data.description) },
          }),
        });
      }
    });

    if (assignedToStaffId && assignedToStaffId !== staff.id && assigneeEmail) {
      const toEmail = assigneeEmail;
      const recipientName = assigneeName ?? undefined;
      after(async () => {
        const data = await loadTicketEmailData(ticketId);
        if (!data) return;
        await logAndSendEmail({
          templateKey: "ticket.assigned",
          toEmail,
          payload: {
            ticketNumber,
            subject,
            assignedByName: creatorName,
          },
          chromeOptions: staffTicketChrome(data, {
            recipientName,
            extraRows: [{ label: "Assigned by", value: creatorName }],
            excerpt: { label: "Message", text: excerpt(data.description) },
            transparencyNote:
              "You are receiving this because you were assigned this ticket.",
          }),
        });
      });
    }

    return { success: true, data: { ticketId, ticketNumber } };
  } catch (err) {
    console.error("[createTicketAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── transitionTicketAction ───────────────────────────────────────────────────

export async function transitionTicketAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  const staff = await requireStaffAction("ticket:manage");

  try {
    const parsed = transitionTicketSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { ticketId, toStatus, note } = parsed.data;

    const {
      fromStatus,
      ticketNumber,
      subject,
      assignedToStaffId,
      assigneeEmail,
      assigneeName,
      assigneeStaffId,
    } = await db.$transaction(
      async (tx) => {
        const current = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            ticketNumber: true,
            subject: true,
            assignedToStaffId: true,
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        });

        if (!current) throw new Error("NOT_FOUND");

        const allowed = TICKET_TRANSITIONS[current.status];
        if (
          isTerminalTicketStatus(current.status) ||
          !allowed.includes(toStatus)
        ) {
          throw new Error("INVALID_TRANSITION");
        }

        const fromStatus = current.status;

        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: toStatus,
            ...(toStatus === "RESOLVED" ? { resolvedAt: new Date() } : {}),
            ...(toStatus === "CLOSED" ? { closedAt: new Date() } : {}),
          },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId,
            type: "STATUS_CHANGE",
            actor: "STAFF",
            staffId: staff.id,
            fromStatus,
            toStatus,
            note: note?.trim() ?? null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "ticket.status_changed",
            entityType: "Ticket",
            entityId: ticketId,
            metadata: {
              ticketNumber: current.ticketNumber,
              fromStatus,
              toStatus,
              hasNote: Boolean(note?.trim()),
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return {
          fromStatus,
          ticketNumber: current.ticketNumber,
          subject: current.subject,
          assignedToStaffId: current.assignedToStaffId,
          assigneeEmail: current.assignedTo?.email ?? null,
          assigneeName: current.assignedTo?.name ?? null,
          assigneeStaffId: current.assignedTo?.id ?? null,
        };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/tickets");
    revalidatePath(`/admin/tickets/${ticketId}`);

    const fromStatusLabel = TICKET_STATUS_LABELS[fromStatus];
    const toStatusLabel = TICKET_STATUS_LABELS[toStatus];
    const trimmedNote = note?.trim() || null;
    after(async () => {
      const { support: supportRecipients } = await getSetting("email_recipients");

      const assigneeRecipient =
        assignedToStaffId && assigneeStaffId !== staff.id
          ? { email: assigneeEmail, name: assigneeName }
          : null;

      const seen = new Set<string>();
      const recipients: { email: string; name: string | null }[] = [];
      for (const candidate of [
        assigneeRecipient,
        ...supportRecipients.map((email) => ({ email, name: null as string | null })),
      ]) {
        if (!candidate) continue;
        const trimmedEmail = candidate.email?.trim();
        if (!trimmedEmail) continue;
        const key = trimmedEmail.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push({ email: trimmedEmail, name: candidate.name });
      }

      const data = await loadTicketEmailData(ticketId);
      if (!data) return;
      for (const { email: toEmail, name } of recipients) {
        await logAndSendEmail({
          templateKey: "ticket.status_changed",
          toEmail,
          payload: {
            ticketNumber,
            subject,
            fromStatus: fromStatusLabel,
            toStatus: toStatusLabel,
          },
          chromeOptions: staffTicketChrome(data, {
            recipientName: name ?? undefined,
            badges: [{ text: data.statusLabel, tone: data.statusTone }],
            extraRows: [
              { label: "Status", value: `${fromStatusLabel} → ${toStatusLabel}` },
            ],
            ...(trimmedNote
              ? { excerpt: { label: "Note", text: excerpt(trimmedNote) } }
              : {}),
            transparencyNote: name
              ? "You are receiving this because you are assigned to this ticket."
              : undefined,
          }),
        });
      }
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Ticket not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This status transition is not allowed.",
          errorCode: "INVALID_TRANSITION",
        };
      }
    }
    console.error("[transitionTicketAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── assignTicketAction ───────────────────────────────────────────────────────

export async function assignTicketAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  const staff = await requireStaffAction("ticket:manage");

  try {
    const assigner = await db.staff.findUnique({
      where: { id: staff.id },
      select: { name: true },
    });
    const assignerName = assigner?.name ?? "a team member";

    const parsed = assignTicketSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { ticketId, assignedToStaffId } = parsed.data;

    let assigneeName: string | null = null;
    let assigneeEmail: string | null = null;
    if (assignedToStaffId !== null) {
      const assignee = await db.staff.findUnique({
        where: { id: assignedToStaffId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      if (!assignee) {
        return {
          success: false,
          error: "Assignee not found.",
          errorCode: "INVALID_ASSIGNEE",
        };
      }
      if (!assignee.isActive || !can(assignee.role, "ticket:manage")) {
        return {
          success: false,
          error: "This staff member cannot be assigned tickets.",
          errorCode: "ASSIGNEE_INELIGIBLE",
        };
      }
      assigneeName = assignee.name;
      assigneeEmail = assignee.email;
    }

    const { ticketNumber, subject } = await db.$transaction(
      async (tx) => {
        const current = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: { status: true, ticketNumber: true, subject: true },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (isTerminalTicketStatus(current.status))
          throw new Error("INVALID_TRANSITION");

        await tx.ticket.update({
          where: { id: ticketId },
          data: { assignedToStaffId },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId,
            type: "ASSIGNMENT",
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: null,
            toStatus: null,
            note: assignedToStaffId ? assigneeName : "Unassigned",
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "ticket.assigned",
            entityType: "Ticket",
            entityId: ticketId,
            metadata: {
              ticketNumber: current.ticketNumber,
              assignedToStaffId,
              unassigned: assignedToStaffId === null,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return { ticketNumber: current.ticketNumber, subject: current.subject };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/tickets");
    revalidatePath(`/admin/tickets/${ticketId}`);

    if (assignedToStaffId !== null && assignedToStaffId !== staff.id && assigneeEmail) {
      const toEmail = assigneeEmail;
      const recipientName = assigneeName ?? undefined;
      after(async () => {
        const data = await loadTicketEmailData(ticketId);
        if (!data) return;
        await logAndSendEmail({
          templateKey: "ticket.assigned",
          toEmail,
          payload: {
            ticketNumber,
            subject,
            assignedByName: assignerName,
          },
          chromeOptions: staffTicketChrome(data, {
            recipientName,
            extraRows: [{ label: "Assigned by", value: assignerName }],
            excerpt: { label: "Message", text: excerpt(data.description) },
            transparencyNote:
              "You are receiving this because you were assigned this ticket.",
          }),
        });
      });
    }

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Ticket not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This ticket is closed and cannot be modified.",
          errorCode: "INVALID_TRANSITION",
        };
      }
    }
    console.error("[assignTicketAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── addTicketCommentAction ───────────────────────────────────────────────────

export async function addTicketCommentAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  const staff = await requireStaffAction("ticket:manage");

  try {
    const parsed = addTicketCommentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { ticketId, note } = parsed.data;

    const {
      ticketNumber,
      subject,
      assignedToStaffId,
      assigneeEmail,
      assigneeName,
      assigneeStaffId,
    } = await db.$transaction(
      async (tx) => {
        const current = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: {
            id: true,
            status: true,
            ticketNumber: true,
            subject: true,
            assignedToStaffId: true,
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (isTerminalTicketStatus(current.status))
          throw new Error("INVALID_TRANSITION");

        await tx.ticketEvent.create({
          data: {
            ticketId,
            type: "COMMENT",
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: null,
            toStatus: null,
            note: note.trim(),
          },
        });

        return {
          ticketNumber: current.ticketNumber,
          subject: current.subject,
          assignedToStaffId: current.assignedToStaffId,
          assigneeEmail: current.assignedTo?.email ?? null,
          assigneeName: current.assignedTo?.name ?? null,
          assigneeStaffId: current.assignedTo?.id ?? null,
        };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/tickets");
    revalidatePath(`/admin/tickets/${ticketId}`);

    const preview = excerpt(note.trim());
    after(async () => {
      const { support: supportRecipients } = await getSetting("email_recipients");

      const assigneeRecipient =
        assignedToStaffId && assigneeStaffId !== staff.id
          ? { email: assigneeEmail, name: assigneeName }
          : null;

      const seen = new Set<string>();
      const recipients: { email: string; name: string | null }[] = [];
      for (const candidate of [
        assigneeRecipient,
        ...supportRecipients.map((email) => ({ email, name: null as string | null })),
      ]) {
        if (!candidate) continue;
        const trimmedEmail = candidate.email?.trim();
        if (!trimmedEmail) continue;
        const key = trimmedEmail.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push({ email: trimmedEmail, name: candidate.name });
      }

      const data = await loadTicketEmailData(ticketId);
      if (!data) return;
      for (const { email: toEmail, name } of recipients) {
        await logAndSendEmail({
          templateKey: "ticket.comment",
          toEmail,
          payload: { ticketNumber, subject, preview },
          chromeOptions: staffTicketChrome(data, {
            recipientName: name ?? undefined,
            badges: [{ text: "New comment", tone: "info" }],
            excerpt: { label: "Comment", text: preview },
            transparencyNote: name
              ? "You are receiving this because you are assigned to this ticket."
              : undefined,
          }),
        });
      }
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Ticket not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This ticket is closed and cannot receive comments.",
          errorCode: "INVALID_TRANSITION",
        };
      }
    }
    console.error("[addTicketCommentAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── reopenTicketAction ───────────────────────────────────────────────────────

export async function reopenTicketAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  const staff = await requireStaffAction("ticket:manage");

  try {
    const parsed = reopenTicketSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { ticketId } = parsed.data;

    const {
      fromStatus,
      ticketNumber,
      subject,
      assignedToStaffId,
      assigneeEmail,
      assigneeName,
      assigneeStaffId,
    } = await db.$transaction(
      async (tx) => {
        const current = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            ticketNumber: true,
            subject: true,
            assignedToStaffId: true,
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (!isTerminalTicketStatus(current.status))
          throw new Error("INVALID_TRANSITION");

        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: "OPEN", resolvedAt: null, closedAt: null },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId,
            type: "STATUS_CHANGE",
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: current.status,
            toStatus: "OPEN",
            note: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "ticket.status_changed",
            entityType: "Ticket",
            entityId: ticketId,
            metadata: {
              ticketNumber: current.ticketNumber,
              fromStatus: current.status,
              toStatus: "OPEN",
              hasNote: false,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return {
          fromStatus: current.status,
          ticketNumber: current.ticketNumber,
          subject: current.subject,
          assignedToStaffId: current.assignedToStaffId,
          assigneeEmail: current.assignedTo?.email ?? null,
          assigneeName: current.assignedTo?.name ?? null,
          assigneeStaffId: current.assignedTo?.id ?? null,
        };
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/tickets");
    revalidatePath(`/admin/tickets/${ticketId}`);

    const fromStatusLabel = TICKET_STATUS_LABELS[fromStatus];
    const toStatusLabel = TICKET_STATUS_LABELS.OPEN;
    after(async () => {
      const { support: supportRecipients } = await getSetting("email_recipients");

      const assigneeRecipient =
        assignedToStaffId && assigneeStaffId !== staff.id
          ? { email: assigneeEmail, name: assigneeName }
          : null;

      const seen = new Set<string>();
      const recipients: { email: string; name: string | null }[] = [];
      for (const candidate of [
        assigneeRecipient,
        ...supportRecipients.map((email) => ({ email, name: null as string | null })),
      ]) {
        if (!candidate) continue;
        const trimmedEmail = candidate.email?.trim();
        if (!trimmedEmail) continue;
        const key = trimmedEmail.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push({ email: trimmedEmail, name: candidate.name });
      }

      const data = await loadTicketEmailData(ticketId);
      if (!data) return;
      for (const { email: toEmail, name } of recipients) {
        await logAndSendEmail({
          templateKey: "ticket.status_changed",
          toEmail,
          payload: {
            ticketNumber,
            subject,
            fromStatus: fromStatusLabel,
            toStatus: toStatusLabel,
          },
          chromeOptions: staffTicketChrome(data, {
            recipientName: name ?? undefined,
            badges: [{ text: data.statusLabel, tone: data.statusTone }],
            extraRows: [
              { label: "Status", value: `${fromStatusLabel} → ${toStatusLabel}` },
            ],
            transparencyNote: name
              ? "You are receiving this because you are assigned to this ticket."
              : undefined,
          }),
        });
      }
    });

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Ticket not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This ticket is not closed.",
          errorCode: "INVALID_TRANSITION",
        };
      }
    }
    console.error("[reopenTicketAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── updateTicketTextAction ───────────────────────────────────────────────────

export async function updateTicketTextAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  const staff = await requireStaffAction("ticket:manage");

  try {
    const parsed = updateTicketTextSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { ticketId, subject, description } = parsed.data;

    await db.$transaction(
      async (tx) => {
        const current = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            ticketNumber: true,
            subject: true,
            description: true,
            createdByStaffId: true,
          },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (isTerminalTicketStatus(current.status))
          throw new Error("INVALID_TRANSITION");
        if (current.createdByStaffId === null) throw new Error("FORBIDDEN");

        const subjectChanged = subject !== current.subject;
        const descriptionChanged = description !== current.description;

        if (!subjectChanged && !descriptionChanged) return;

        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            ...(subjectChanged ? { subject } : {}),
            ...(descriptionChanged ? { description } : {}),
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "ticket.updated",
            entityType: "Ticket",
            entityId: ticketId,
            metadata: {
              ticketNumber: current.ticketNumber,
              subjectChanged,
              descriptionChanged,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/tickets");
    revalidatePath(`/admin/tickets/${ticketId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Ticket not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This ticket is closed and cannot be edited.",
          errorCode: "INVALID_TRANSITION",
        };
      }
      if (err.message === "FORBIDDEN") {
        return {
          success: false,
          error:
            "Customer-submitted tickets cannot be edited. Add a comment instead.",
          errorCode: "FORBIDDEN",
        };
      }
    }
    console.error("[updateTicketTextAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── searchTicketLinkTargetsAction ────────────────────────────────────────────

export async function searchTicketLinkTargetsAction(
  input: unknown,
): Promise<
  | { success: true; data: TicketLinkOption[] }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  await requireStaffAction("ticket:manage");

  try {
    const parsed = searchTicketLinksSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { kind, query } = parsed.data;
    const data = await searchTicketLinkTargets(kind, query);
    return { success: true, data };
  } catch (err) {
    console.error("[searchTicketLinkTargetsAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ─── updateTicketTriageAction ─────────────────────────────────────────────────

export async function updateTicketTriageAction(
  input: unknown,
): Promise<
  | { success: true }
  | { success: false; error: string; errorCode: TicketActionErrorCode }
> {
  const staff = await requireStaffAction("ticket:manage");

  try {
    const parsed = updateTicketTriageSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { ticketId, priority, category } = parsed.data;

    await db.$transaction(
      async (tx) => {
        const current = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            ticketNumber: true,
            priority: true,
            category: true,
            orderId: true,
            quoteRequestId: true,
            b2bAccountId: true,
            verificationEventId: true,
          },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (isTerminalTicketStatus(current.status))
          throw new Error("INVALID_TRANSITION");

        const currentKind = current.orderId
          ? "order"
          : current.quoteRequestId
            ? "quote"
            : current.b2bAccountId
              ? "b2b"
              : current.verificationEventId
                ? "verification"
                : "customer";

        const categoryChanged = category !== current.category;
        const priorityChanged = priority !== current.priority;

        if (categoryChanged && TICKET_LINK_KIND[category] !== currentKind) {
          throw new Error("LINK_MISMATCH");
        }

        if (!categoryChanged && !priorityChanged) return;

        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            ...(priorityChanged ? { priority } : {}),
            ...(categoryChanged ? { category } : {}),
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "ticket.updated",
            entityType: "Ticket",
            entityId: ticketId,
            metadata: {
              ticketNumber: current.ticketNumber,
              priorityChanged,
              categoryChanged,
              fromPriority: current.priority,
              toPriority: priority,
              fromCategory: current.category,
              toCategory: category,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/tickets");
    revalidatePath(`/admin/tickets/${ticketId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Ticket not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "INVALID_TRANSITION") {
        return {
          success: false,
          error: "This ticket is closed and cannot be edited.",
          errorCode: "INVALID_TRANSITION",
        };
      }
      if (err.message === "LINK_MISMATCH") {
        return {
          success: false,
          error: "This category needs a different linked record.",
          errorCode: "LINK_MISMATCH",
        };
      }
    }
    console.error("[updateTicketTriageAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
