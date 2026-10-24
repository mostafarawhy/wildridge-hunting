import "server-only";
import { db } from "@/lib/db/client";

export async function getEmailTemplateOverride(
  templateKey: string,
  locale: string,
) {
  return db.emailTemplate.findUnique({
    where: { templateKey_locale: { templateKey, locale } },
  });
}
