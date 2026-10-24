import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
}

export default async function B2BProvideDocumentsPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();

  if (session?.user?.principal !== "customer") {
    return redirect({ href: "/auth/login", locale });
  }

  return redirect({ href: "/account/b2b", locale });
}
