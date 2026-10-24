import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getCustomerAddresses } from "@/lib/db/queries/account";
import { getServiceableCountries } from "@/lib/db/queries/checkout";
import AddressesManager from "@/components/account/AddressesManager";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountAddressesPage({ params }: Props) {
  const { locale } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";

  const session = await auth();
if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const [addresses, serviceableCountries] = await Promise.all([
    getCustomerAddresses(session.user.id),
    getServiceableCountries(),
  ]);

  return (
    <AddressesManager
      addresses={addresses}
      locale={safeLocale}
      serviceableCountries={serviceableCountries}
    />
  );
}
