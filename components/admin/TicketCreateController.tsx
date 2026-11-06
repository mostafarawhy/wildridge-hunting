"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import RecordLookup from "@/components/admin/RecordLookup";
import StaffAssignPicker from "@/components/admin/StaffAssignPicker";
import { createTicketAction } from "@/lib/actions/tickets";
import type { TicketLinkOption } from "@/lib/db/queries/ticket";
import type { TicketLinkKind } from "@/lib/utils/ticket-status";
import type { StaffRole, TicketCategory } from "@/app/generated/prisma/client";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_LINK_KIND,
  TICKET_LINK_KIND_LABELS,
} from "@/lib/utils/ticket-status";

interface AssignableStaffOption {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

interface Props {
  prefill: TicketLinkOption | null;
  autoOpen: boolean;
  assignableStaff: AssignableStaffOption[];
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  backgroundColor: "#ffffff",
  border: "1.5px solid var(--color-shop-divider)",
  borderRadius: "0",
  outline: "none",
  boxSizing: "border-box",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  color: "#6b6b6b",
  marginBottom: "0.375rem",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
};

const CATEGORY_ENTRIES = Object.entries(TICKET_CATEGORY_LABELS) as [
  TicketCategory,
  string,
][];

const LINKED_HINT: Record<TicketLinkKind, string> = {
  order: "order",
  quote: "quote",
  b2b: "B2B account",
  verification: "verification case",
  customer: "customer",
};

export default function TicketCreateController({
  prefill,
  autoOpen,
  assignableStaff,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [categoryOptions] = useState(() =>
    prefill
      ? CATEGORY_ENTRIES.filter(
          ([val]) => TICKET_LINK_KIND[val] === prefill.kind,
        )
      : CATEGORY_ENTRIES,
  );
  const [category, setCategory] = useState<TicketCategory | "">(
    prefill ? (categoryOptions[0]?.[0] ?? "") : "",
  );
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [link, setLink] = useState<TicketLinkOption | null>(prefill);
  const [contactEmail, setContactEmail] = useState("");
  const [assignee, setAssignee] = useState("");

  const kind = category ? TICKET_LINK_KIND[category] : null;
  const linkRequired = kind !== null && kind !== "customer";

  function handleClose() {
    setOpen(false);
    setError(null);
    setErrorCode(null);
  }

  function handleCategoryChange(next: TicketCategory) {
    setCategory(next);
    if (!prefill && TICKET_LINK_KIND[next] !== kind) {
      setLink(null);
    }
  }

  function handleSubmit() {
    if (!category) return;
    setError(null);
    setErrorCode(null);
    startTransition(async () => {
      const result = await createTicketAction({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        linkId: link?.id,
        contactEmail: link?.customerEmail
          ? undefined
          : contactEmail.trim(),
        assignedToStaffId: assignee || null,
      });
      if (result.success) {
        const href = `/admin/tickets/${result.data.ticketId}`;
        startNavigationProgress(href);
        router.push(href);
      } else {
        setError(result.error);
        setErrorCode(result.errorCode);
      }
    });
  }

  const hasEmail = Boolean(link?.customerEmail || contactEmail.trim());
  const canSubmit =
    Boolean(category) &&
    Boolean(subject.trim()) &&
    Boolean(description.trim()) &&
    (!linkRequired || Boolean(link)) &&
    hasEmail;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...btnBase,
          backgroundColor: "#0b0b0b",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        New Ticket
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        ariaLabel="Create ticket"
        maxWidth={600}
      >
        <div style={{ padding: "2rem" }}>
          <h2
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "var(--font-bold)",
              color: "#0b0b0b",
              marginBottom: "1.25rem",
              paddingInlineEnd: "2rem",
            }}
          >
            New Ticket
          </h2>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <Select
              label="Category"
              id="tc-category"
              value={category}
              required
              onChange={(e) =>
                handleCategoryChange(e.target.value as TicketCategory)
              }
            >
              <option value="" disabled>
                Select a category…
              </option>
              {categoryOptions.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>

            {kind && (
              <RecordLookup
                id="tc-link"
                label={
                  kind === "customer"
                    ? "Customer"
                    : `Linked ${TICKET_LINK_KIND_LABELS[kind]}`
                }
                kind={kind}
                value={link}
                onChange={setLink}
                required={linkRequired}
                locked={Boolean(prefill)}
              />
            )}

            {link?.customerEmail ? (
              <div>
                <p style={fieldLabelStyle}>Customer email</p>
                <p
                  dir="ltr"
                  style={{
                    fontSize: "var(--text-body)",
                    color: "#0b0b0b",
                    margin: 0,
                  }}
                >
                  {link.customerEmail}
                </p>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                    marginTop: "0.25rem",
                  }}
                >
                  {kind && `From the linked ${LINKED_HINT[kind]}`}
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="tc-email" style={fieldLabelStyle}>
                  Customer email
                </label>
                <input
                  id="tc-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label htmlFor="tc-subject" style={fieldLabelStyle}>
                Subject
              </label>
              <input
                id="tc-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="tc-description" style={fieldLabelStyle}>
                Description
              </label>
              <textarea
                id="tc-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={4}
                required
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]"
              style={{
                gap: "1rem",
              }}
            >
              <Select
                label="Priority"
                id="tc-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {(
                  Object.entries(TICKET_PRIORITY_LABELS) as [string, string][]
                ).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </Select>

              <StaffAssignPicker
                id="tc-assign"
                label="Assign to"
                staff={assignableStaff}
                value={assignee}
                onChange={setAssignee}
              />
            </div>
          </div>

          {error && (
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#991b1b",
                marginTop: "0.75rem",
              }}
            >
              {error}
              {errorCode && (
                <span style={{ color: "#6b6b6b" }}> ({errorCode})</span>
              )}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              style={{
                ...btnBase,
                backgroundColor: "var(--color-action-primary)",
                color: "#ffffff",
                cursor: isPending || !canSubmit ? "not-allowed" : "pointer",
                opacity: isPending || !canSubmit ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
            >
              {isPending && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "0.875em",
                    height: "0.875em",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    marginInlineEnd: "0.5rem",
                    flexShrink: 0,
                  }}
                />
              )}
              Create Ticket
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                textDecoration: "underline",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
