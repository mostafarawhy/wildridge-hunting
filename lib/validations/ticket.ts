import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.enum([
    "REFUND",
    "RETURN",
    "ORDER_ISSUE",
    "QUOTE_ISSUE",
    "PAYMENT",
    "SHIPPING",
    "GENERAL",
    "B2B",
    "VERIFICATION",
  ]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  contactEmail: z.email().optional(),
  linkId: z.string().min(1).optional(),
  assignedToStaffId: z.string().min(1).nullable().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const transitionTicketSchema = z.object({
  ticketId: z.string().min(1),
  toStatus: z.enum([
    "IN_PROGRESS",
    "WAITING_ON_CUSTOMER",
    "RESOLVED",
    "CLOSED",
  ]),
  note: z.string().max(2000).optional(),
});

export type TransitionTicketInput = z.infer<typeof transitionTicketSchema>;

export const assignTicketSchema = z.object({
  ticketId: z.string().min(1),
  assignedToStaffId: z.string().min(1).nullable(),
});

export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const addTicketCommentSchema = z.object({
  ticketId: z.string().min(1),
  note: z.string().min(1).max(2000),
});

export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>;

export const reopenTicketSchema = z.object({
  ticketId: z.string().min(1),
});

export type ReopenTicketInput = z.infer<typeof reopenTicketSchema>;

export const updateTicketTextSchema = z.object({
  ticketId: z.string().min(1),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

export type UpdateTicketTextInput = z.infer<typeof updateTicketTextSchema>;

export const searchTicketLinksSchema = z.object({
  kind: z.enum(["order", "quote", "b2b", "verification", "customer"]),
  query: z.string().trim().min(2).max(100),
});

export type SearchTicketLinksInput = z.infer<typeof searchTicketLinksSchema>;

export const updateTicketTriageSchema = z.object({
  ticketId: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  category: z.enum([
    "REFUND",
    "RETURN",
    "ORDER_ISSUE",
    "QUOTE_ISSUE",
    "PAYMENT",
    "SHIPPING",
    "GENERAL",
    "B2B",
    "VERIFICATION",
  ]),
});

export type UpdateTicketTriageInput = z.infer<typeof updateTicketTriageSchema>;
