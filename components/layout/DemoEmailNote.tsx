import { useTranslations } from "next-intl";
import { isDemoMode } from "@/lib/config/demo";

export default function DemoEmailNote() {
  const t = useTranslations("demo");
  if (!isDemoMode()) return null;
  return (
    <p
      role="note"
      style={{
        margin: "0.5rem 0 0",
        fontSize: "0.75rem",
        lineHeight: 1.4,
        color: "inherit",
        opacity: 0.75,
      }}
    >
      {t("emailNote")}
    </p>
  );
}
