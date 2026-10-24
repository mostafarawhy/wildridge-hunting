import { useTranslations } from "next-intl";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";

interface Props {
  href: string;
}

export default function AccountHelpLink({ href }: Props) {
  const t = useTranslations("account.support");
  return (
    <LocaleButtonLink
      href={href}
      variant="outline"
      size="sm"
      className="account-help-link"
      style={{ flexShrink: 0, whiteSpace: "nowrap" }}
    >
      {t("needHelp")}
    </LocaleButtonLink>
  );
}
