import { requireStaff } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import VerificationContentForm from "@/components/admin/VerificationContentForm";
import B2BContentForm from "@/components/admin/B2BContentForm";
import QuoteConsentContentForm from "@/components/admin/QuoteConsentContentForm";

export default async function Page() {
  await requireStaff("content:manage");
  const content = await getSetting("verification_content");
  const b2bContent = await getSetting("b2b_content");
  const quoteLegalTerms = await getSetting("quote_legal_terms");
  const quoteRules = await getSetting("quote_rules");

  return (
    <div>
      <AdminPageHeader
        title="Forms & Terms"
        subtitle="Instructions and terms customers read when they verify their identity, apply for a business account, or request a quote"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <VerificationContentForm initial={content} />
        <B2BContentForm initial={b2bContent} />
        <QuoteConsentContentForm variant="terms" initial={quoteLegalTerms} />
        <QuoteConsentContentForm variant="rules" initial={quoteRules} />
      </div>
    </div>
  );
}
