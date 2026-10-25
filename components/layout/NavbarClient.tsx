"use client";

import { Suspense } from "react";
import { SearchIcon } from "@/components/ui";
import NavSearch from "./NavSearch";
import MobileTabBar from "./MobileTabBar";
import { useSearchStore } from "@/lib/stores/search-store";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/home/LanguageSwitcher";
import WishlistNavIcon from "@/components/wishlist/WishlistNavIcon";
import AccountMenu from "@/components/auth/AccountMenu";
import LoginModalController from "@/components/auth/LoginModalController";
import RegisterModalController from "@/components/auth/RegisterModalController";
import CartIconBadge from "@/components/cart/CartIconBadge";
import CartDrawer from "@/components/cart/CartDrawer";
import QuoteIconBadge from "@/components/quote/QuoteIconBadge";
import QuoteDrawer from "@/components/quote/QuoteDrawer";
import type { ShopMode } from "@/lib/utils/shop-mode";
import type { CustomerAddressProjection } from "@/lib/db/queries/account";

interface SessionUser {
  id: string;
  name: string | null;
  email: string;
}

interface NavbarClientProps {
  locale: string;
  sessionUser: SessionUser | null;
  canUseBusinessMode: boolean;
  shopMode: ShopMode;
  addresses: CustomerAddressProjection[];
  serviceableCountries: { code: string; name: string }[];
}

export default function NavbarClient({
  locale,
  sessionUser,
  canUseBusinessMode,
  shopMode,
  addresses,
  serviceableCountries,
}: NavbarClientProps) {
  const tNav = useTranslations("nav");
  const searchOpen = useSearchStore((s) => s.open);
  const setSearchOpen = useSearchStore((s) => s.setOpen);
  const toggleSearch = useSearchStore((s) => s.toggle);

  const isBusinessMode = canUseBusinessMode && shopMode === "BUSINESS";

  return (
    <>
      <div className="hidden lg:flex">
        <button
          type="button"
          aria-label={tNav("search")}
          aria-expanded={searchOpen}
          onClick={toggleSearch}
          className="cursor-pointer transition-opacity duration-150 hover:opacity-70 p-[11px] -m-[11px]"
          style={{ color: "var(--color-content-primary)" }}
        >
          <SearchIcon />
        </button>
      </div>

      <div className="hidden lg:flex">
        <LanguageSwitcher />
      </div>

      <div className="hidden lg:flex">
        <AccountMenu
          session={sessionUser}
          canUseBusinessMode={canUseBusinessMode}
          shopMode={shopMode}
        />
      </div>

      <div className="hidden lg:flex">
        <WishlistNavIcon />
      </div>

      <div className="hidden lg:flex">
        {isBusinessMode ? <QuoteIconBadge /> : <CartIconBadge />}
      </div>

      <Suspense fallback={null}>
        <LoginModalController signedIn={sessionUser !== null} />
      </Suspense>
      <Suspense fallback={null}>
        <RegisterModalController />
      </Suspense>

      <MobileTabBar
        signedIn={sessionUser !== null}
        isBusinessMode={isBusinessMode}
      />

      <NavSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        locale={locale}
      />

      {isBusinessMode ? (
        <QuoteDrawer
          addresses={addresses}
          serviceableCountries={serviceableCountries}
        />
      ) : (
        <CartDrawer />
      )}
    </>
  );
}
