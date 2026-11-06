import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { listStorePagesForAdmin } from "@/lib/db/queries/admin-pages";
import { AdminPageHeader } from "@/components/admin";
import StorePagesTable from "@/components/admin/StorePagesTable";

const ELSEWHERE: { title: string; body: string; href?: string; link?: string }[] = [
  {
    title: "Store Profile",
    body: "Phone, WhatsApp, email and social links on Contact and the footer",
    href: "/admin/store-profile",
    link: "Edit Store Profile",
  },
  {
    title: "Store Locations",
    body: "Showrooms, maps and hours on Contact, Our Stores and About",
    href: "/admin/stores",
    link: "Edit Store Locations",
  },
  {
    title: "Header photo",
    body: "One photo behind the title of every store page. It is part of the site design and is not edited here.",
  },
];

export default async function AdminStorePagesPage() {
  await requireStaff("content:manage");

  const rows = await listStorePagesForAdmin();
  const publishedCount = rows.filter((r) => r.published).length;
  const unpublished = rows.filter((r) => !r.published);

  return (
    <>
      <AdminPageHeader
        title="Store Pages"
        subtitle="The pages linked from the storefront footer. Open one to edit what customers read there."
        actions={
          <span
            style={{
              display: "inline-flex",
              backgroundColor: "#ffffff",
              border: "1px solid #e8e8e8",
              padding: "8px 14px",
              fontSize: "14px",
              color: "#0b0b0b",
            }}
          >
            {publishedCount} of {rows.length} published
          </span>
        }
      />

      {unpublished.length > 0 && (
        <div
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            fontSize: "var(--text-body-sm)",
            color: "#92400e",
          }}
        >
          These footer links lead to a not-found page until published:{" "}
          {unpublished.map((r) => r.label).join(", ")}
        </div>
      )}

      <StorePagesTable rows={rows} />

      <p style={{ fontSize: "13px", color: "#6b6b6b", marginTop: "1rem" }}>
        Language chips turn blue once that language has a title and content. Visitors see
        English where their language is not written yet.
      </p>

      <p
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "#6b6b6b",
          marginTop: "2rem",
          marginBottom: "0.75rem",
        }}
      >
        ALSO SHOWN ON THESE PAGES, EDITED ELSEWHERE
      </p>
      <div
        className="grid grid-cols-1 sm:grid-cols-3"
        style={{
          gap: "1rem",
        }}
      >
        {ELSEWHERE.map((card) => (
          <div
            key={card.title}
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e8e8e8",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "#0b0b0b",
                margin: 0,
              }}
            >
              {card.title}
            </p>
            <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b", margin: 0 }}>
              {card.body}
            </p>
            {card.href && (
              <Link
                href={card.href}
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  textDecoration: "underline",
                  marginTop: "0.25rem",
                }}
              >
                {card.link}
              </Link>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
