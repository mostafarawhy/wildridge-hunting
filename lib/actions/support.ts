"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import { createSupportRequestSchema } from "@/lib/validations/support";
import { nextTicketNumber } from "@/lib/db/queries/ticket-sequence";
import { getSetting } from "@/lib/db/queries/settings";
import { logAndSendEmail } from "@/lib/services/resend";
import {
  loadTicketEmailData,
  staffTicketChrome,
  customerTicketChrome,
} from "@/lib/email/ticket-email";
import { excerpt } from "@/lib/email/chrome";
import type { TicketCategory } from "@/app/generated/prisma/client";

export type CreateSupportRequestErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "RECORD_REQUIRED"
  | "NOT_OWNER"
  | "TOPIC_UNAVAILABLE"
  | "ALREADY_OPEN"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type CreateSupportRequestResult =
  | { success: true; data: { ticketNumber: string } }
  | {
      success: false;
      error: string;
      errorCode: CreateSupportRequestErrorCode;
      existingTicketNumber?: string;
      fieldErrors?: Partial<Record<"subject" | "message", "invalid">>;
    };

class SupportRequestRefusal extends Error {
  readonly errorCode: "ALREADY_OPEN" | "RATE_LIMITED";
  readonly existingTicketNumber?: string;

  constructor(
    errorCode: "ALREADY_OPEN" | "RATE_LIMITED",
    existingTicketNumber?: string,
  ) {
    super(errorCode);
    this.name = "SupportRequestRefusal";
    this.errorCode = errorCode;
    this.existingTicketNumber = existingTicketNumber;
  }
}

export async function createSupportRequestAction(
  input: unknown,
): Promise<CreateSupportRequestResult> {
  try {
    const session = await auth();
    const sessionCustomerId = await getSessionCustomerId();
    if (!sessionCustomerId || session?.user?.principal !== "customer") {
      return {
        success: false,
        error: "You must be signed in to send a support request.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    const parsed = createSupportRequestSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<"subject" | "message", "invalid">> =
        {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "subject" || field === "message") {
          fieldErrors[field] = "invalid";
        }
      }
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
        fieldErrors,
      };
    }

    const { topic, orderId, quoteId, subject, message } = parsed.data;

    const customer = await db.customer.findFirst({
      where: { id: sessionCustomerId, isActive: true, deletedAt: null },
      select: { id: true, email: true, role: true },
    });

    if (!customer) {
      return {
        success: false,
        error: "Your session has ended. Sign in again to send a request.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    let category: TicketCategory;
    let link:
      | { orderId: string }
      | { quoteRequestId: string }
      | { b2bAccountId: string }
      | { verificationEventId: string }
      | null = null;
    let linkedOrder: { id: string; orderNumber: string } | null = null;
    let linkedQuote: { id: string; quoteNumber: string } | null = null;

    if (topic === "ORDER") {
      if (!orderId) {
        return {
          success: false,
          error: "Choose the order or quote this is about.",
          errorCode: "RECORD_REQUIRED",
        };
      }
      linkedOrder = await db.order.findFirst({
        where: { id: orderId, customerId: customer.id },
        select: { id: true, orderNumber: true },
      });
      if (!linkedOrder) {
        return {
          success: false,
          error: "We couldn't find that record in your account.",
          errorCode: "NOT_OWNER",
        };
      }
      category = "ORDER_ISSUE";
      link = { orderId: linkedOrder.id };
    } else if (topic === "QUOTE") {
      if (customer.role !== "B2B") {
        return {
          success: false,
          error:
            "That topic isn't available for your account. Choose another.",
          errorCode: "TOPIC_UNAVAILABLE",
        };
      }
      if (!quoteId) {
        return {
          success: false,
          error: "Choose the order or quote this is about.",
          errorCode: "RECORD_REQUIRED",
        };
      }
      linkedQuote = await db.quoteRequest.findFirst({
        where: { id: quoteId, customerId: customer.id },
        select: { id: true, quoteNumber: true },
      });
      if (!linkedQuote) {
        return {
          success: false,
          error: "We couldn't find that record in your account.",
          errorCode: "NOT_OWNER",
        };
      }
      category = "QUOTE_ISSUE";
      link = { quoteRequestId: linkedQuote.id };
    } else if (topic === "BUSINESS") {
      const b2bAccount = await db.b2BAccount.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!b2bAccount) {
        return {
          success: false,
          error:
            "That topic isn't available for your account. Choose another.",
          errorCode: "TOPIC_UNAVAILABLE",
        };
      }
      category = "B2B";
      link = { b2bAccountId: b2bAccount.id };
    } else if (topic === "ACCOUNT") {
      const verificationEvent = await db.verificationEvent.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (verificationEvent) {
        category = "VERIFICATION";
        link = { verificationEventId: verificationEvent.id };
      } else {
        category = "GENERAL";
      }
    } else {
      category = "GENERAL";
    }

    const now = new Date();
    const rateWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let ticketId: string;
    let ticketNumber: string;

    try {
      const result = await db.$transaction(
        async (tx) => {
          if (link) {
            const existing = await tx.ticket.findFirst({
              where: {
                ...link,
                createdByCustomerId: customer.id,
                status: {
                  in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"],
                },
              },
              select: { ticketNumber: true },
            });
            if (existing) {
              throw new SupportRequestRefusal(
                "ALREADY_OPEN",
                existing.ticketNumber,
              );
            }
          }

          const recentCount = await tx.ticket.count({
            where: {
              createdByCustomerId: customer.id,
              createdAt: { gt: rateWindowStart },
            },
          });
          if (recentCount >= 5) {
            throw new SupportRequestRefusal("RATE_LIMITED");
          }

          const generatedTicketNumber = await nextTicketNumber(tx, now);
          const created = await tx.ticket.create({
            data: {
              ticketNumber: generatedTicketNumber,
              subject,
              description: message,
              category,
              priority: "NORMAL",
              status: "OPEN",
              ...link,
              customerId: customer.id,
              contactEmail: customer.email,
              createdByCustomerId: customer.id,
            },
            select: { id: true, ticketNumber: true },
          });
          await tx.ticketEvent.create({
            data: {
              ticketId: created.id,
              type: "STATUS_CHANGE",
              actor: "CUSTOMER",
              fromStatus: null,
              toStatus: "OPEN",
              note: null,
            },
          });
          return { ticketId: created.id, ticketNumber: created.ticketNumber };
        },
        { isolationLevel: "Serializable" },
      );
      ticketId = result.ticketId;
      ticketNumber = result.ticketNumber;
    } catch (err) {
      if (err instanceof SupportRequestRefusal) {
        if (err.errorCode === "ALREADY_OPEN") {
          return {
            success: false,
            error:
              "You already have an open request about this. We'll reply to it soon.",
            errorCode: "ALREADY_OPEN",
            existingTicketNumber: err.existingTicketNumber,
          };
        }
        return {
          success: false,
          error:
            "You've sent several requests today. To reach us sooner, call or message us on WhatsApp.",
          errorCode: "RATE_LIMITED",
        };
      }
      throw err;
    }

    revalidatePath("/admin/tickets");
    revalidatePath("/[locale]/account/support", "page");

    const topicWord =
      topic === "ORDER"
        ? "order"
        : topic === "QUOTE"
          ? "quote"
          : topic === "BUSINESS"
            ? "business account"
            : topic === "ACCOUNT"
              ? "account"
              : topic === "PRODUCT"
                ? "product"
                : "other";

    const detail =
      topic === "ORDER" && linkedOrder
        ? `Topic: order ${linkedOrder.orderNumber}`
        : topic === "QUOTE" && linkedQuote
          ? `Topic: quote ${linkedQuote.quoteNumber}`
          : topic === "BUSINESS"
            ? "Topic: business account"
            : topic === "ACCOUNT"
              ? "Topic: account and verification"
              : topic === "PRODUCT"
                ? "Topic: product question"
                : "Topic: other";

    after(async () => {
      const { support: supportRecipients } =
        await getSetting("email_recipients");
      const data = await loadTicketEmailData(ticketId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "ticket.created_customer",
        toEmail: customer.email,
        payload: { ticketNumber },
        chromeOptions: customerTicketChrome(data, {
          excerpt: { label: "Your message", text: excerpt(data.description) },
        }),
      });
      for (const toEmail of supportRecipients) {
        await logAndSendEmail({
          templateKey: "ticket.created",
          toEmail,
          payload: {
            ticketNumber,
            subject: `support request (${topicWord})`,
            detail,
          },
          chromeOptions: staffTicketChrome(data, {
            excerpt: { label: "Message", text: excerpt(data.description) },
          }),
        });
      }
    });

    return { success: true, data: { ticketNumber } };
  } catch (err) {
    console.error("[createSupportRequestAction]", err);
    return {
      success: false,
      error: "Something went wrong. Try again in a moment.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
