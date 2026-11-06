import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import { getOwnStaffAccount } from "@/lib/db/queries/staff";
import { AdminPageHeader } from "@/components/admin";
import {
  canPerform,
  STAFF_PERMISSION_LABELS,
  STAFF_ROLE_LABELS,
} from "@/lib/utils/staff-permissions";
import type { StaffPermission } from "@/lib/utils/staff-permissions";
import { PERMISSION_AREA, PERMISSION_AREA_ORDER } from "@/lib/utils/permission-areas";
import { formatDateTime, formatDisplayDate } from "@/lib/utils/date";
import { staffLogoutAction } from "@/lib/actions/staff-auth";
import ChangePasswordForm from "./ChangePasswordForm";
import SignOutEverywhereButton from "./SignOutEverywhereButton";

const sectionStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const sectionHeadStyle: React.CSSProperties = {
  padding: "1.25rem 1.5rem",
  borderBottom: "1px solid var(--color-shop-divider)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-semibold)",
  color: "#0b0b0b",
};

const mutedStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
};

const rowStyle: React.CSSProperties = {
  padding: "0.75rem 0",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  margin: 0,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const filledBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "1px solid #0b0b0b",
  borderRadius: "0",
  cursor: "pointer",
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeadStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <p style={{ ...mutedStyle, marginTop: "0.25rem" }}>{hint}</p>
      </div>
      <div style={{ padding: "0.5rem 1.5rem 1.25rem" }}>{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl style={{ margin: 0 }}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className="grid grid-cols-1 gap-[0.25rem] sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-[1rem]"
          style={{
            ...rowStyle,
            borderTop: i === 0 ? "none" : "1px solid var(--color-shop-divider)",
          }}
        >
          <dt style={mutedStyle}>{row.label}</dt>
          <dd style={valueStyle}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AccountPage() {
  const { id } = await requireStaff();
  const account = await getOwnStaffAccount(id);

  if (!account) redirect("/admin/login");

  const permissions = Object.keys(STAFF_PERMISSION_LABELS) as StaffPermission[];
  const access = PERMISSION_AREA_ORDER.map((area) => ({
    label: area,
    value: permissions
      .filter((p) => PERMISSION_AREA[p] === area && canPerform(account.role, p))
      .map((p) => STAFF_PERMISSION_LABELS[p])
      .join(" · "),
  })).filter((row) => row.value !== "");

  return (
    <div style={{ maxWidth: "52rem" }}>
      <AdminPageHeader
        title="Account Settings"
        subtitle="Your profile, what your role can do, and how you sign in"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Section title="Profile" hint="The account you're signed in with.">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.75rem 0 1rem",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "3rem",
                height: "3rem",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0b0b0b",
                color: "#ffffff",
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
              }}
            >
              {initialsOf(account.name)}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={titleStyle}>{account.name}</p>
              <p dir="ltr" style={{ ...mutedStyle, overflowWrap: "anywhere" }}>
                {account.email}
              </p>
            </div>
          </div>
          <Rows
            rows={[
              { label: "Role", value: STAFF_ROLE_LABELS[account.role] },
              { label: "Member since", value: formatDisplayDate(account.createdAt, "en") },
              {
                label: "Latest sign-in",
                value: account.lastLoginAt ? formatDateTime(account.lastLoginAt, "en") : "—",
              },
              {
                label: "Previous sign-in",
                value: account.previousLoginAt ? formatDateTime(account.previousLoginAt, "en") : "—",
              },
            ]}
          />
          <p
            style={{
              ...mutedStyle,
              borderInlineStart: "3px solid var(--color-shop-divider)",
              paddingInlineStart: "0.75rem",
              marginTop: "0.75rem",
            }}
          >
            Your name, email and role are changed on the Staff page by someone with Manage staff access.
          </p>
        </Section>

        <Section
          title="Access"
          hint={`What you can do as ${STAFF_ROLE_LABELS[account.role]}. The sidebar shows only the pages your role opens.`}
        >
          <Rows rows={access} />
        </Section>

        <Section title="Security" hint="Your password and where you're signed in.">
          <div
            style={{
              padding: "0.75rem 0 1.25rem",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <p style={titleStyle}>Password</p>
            <p style={{ ...mutedStyle, marginTop: "0.25rem", marginBottom: "1rem" }}>
              At least 8 characters, with at least one letter and one number. Changing it signs you out on every device.
            </p>
            <div style={{ maxWidth: "24rem" }}>
              <ChangePasswordForm />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              paddingTop: "1.25rem",
            }}
          >
            <div>
              <p style={titleStyle}>Sign out</p>
              <p style={{ ...mutedStyle, marginTop: "0.25rem" }}>
                End your session in this browser.
              </p>
            </div>
            <form action={staffLogoutAction}>
              <button type="submit" style={filledBtn}>
                Sign out
              </button>
            </form>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              paddingTop: "1.25rem",
              marginTop: "1.25rem",
              borderTop: "1px solid var(--color-shop-divider)",
            }}
          >
            <div>
              <p style={titleStyle}>Sign out everywhere</p>
              <p style={{ ...mutedStyle, marginTop: "0.25rem" }}>
                End your session on every device, including this one.
              </p>
            </div>
            <SignOutEverywhereButton style={filledBtn} />
          </div>
        </Section>
      </div>
    </div>
  );
}
