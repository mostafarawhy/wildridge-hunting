import { BRAND } from "@/lib/config/brand";
import { Link } from "@/i18n/navigation";
import BrandMark from "@/components/ui/BrandMark";
import { getTranslations } from "next-intl/server";
import NavbarClient from "./NavbarClient";
import MobileNavController from "./MobileNavController";
import LanguageSheet from "./LanguageSheet";
import StickyHeader from "./StickyHeader";
import type { NavItem } from "./nav-types";
import NavDropdown from "./NavDropdown";
import { getCategoryTree } from "@/lib/db/queries/categories";
import { auth } from "@/auth";
import { getCart } from "@/lib/actions/cart";
import CartStoreHydrator from "@/components/cart/CartStoreHydrator";
import WishlistStoreHydrator from "@/components/wishlist/WishlistStoreHydrator";
import { getWishlistSkus } from "@/lib/db/queries/wishlist";
import { getShopMode } from "@/lib/utils/shop-mode";
import { hasActiveTradeAccount } from "@/lib/db/queries/b2b";
import { getCustomerAddresses } from "@/lib/db/queries/account";
import { getServiceableCountries } from "@/lib/db/queries/checkout";
import type { CategoryWithChildren } from "@/types/shop";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { menuPhotoUrl } from "@/lib/settings/site-banners";

const GROUP_ORDER = ["RIFLES", "OPTICS", "AMMO", "ACCESSORIES"] as const;
type NavGroupKey = (typeof GROUP_ORDER)[number];

const GROUP_HREFS: Record<Exclude<NavGroupKey, "AMMO">, string> = {
  RIFLES: "/shop?groups=rifles",
  OPTICS: "/shop?groups=optics",
  ACCESSORIES: "/shop?groups=accessories",
};

function resolveLocaleName(
  category: { nameEn: string; nameAr: string; nameRu: string | null },
  locale: string,
): string {
  if (locale === "ar") return category.nameAr;
  if (locale === "ru") return category.nameRu ?? category.nameEn;
  return category.nameEn;
}

interface NavbarProps {
  locale: string;
}

export default async function Navbar({ locale }: NavbarProps) {
  const tNav = await getTranslations("nav");
  const [categoryTree, session, initialCart, siteBanners] = await Promise.all([
    getCategoryTree(),
    auth(),
    getCart(locale as "en" | "ar" | "ru"),
    getSiteBanners(),
  ]);
  const wishlistSkus =
    session?.user?.principal === "customer" && session.user.id
      ? await getWishlistSkus(session.user.id)
      : [];
  const shopAllLabel = tNav("shop_all");

  const GROUP_LABELS: Record<NavGroupKey, string> = {
    RIFLES: tNav("rifles_pistols"),
    OPTICS: tNav("optics"),
    AMMO: tNav("ammo"),
    ACCESSORIES: tNav("accessories"),
  };

  const isCustomer = session?.user?.principal === "customer";
  const canUseBusinessMode =
    isCustomer && session?.user?.id
      ? await hasActiveTradeAccount(session.user.id)
      : false;
  const initialAddresses =
    canUseBusinessMode && session?.user?.id
      ? await getCustomerAddresses(session.user.id)
      : [];
  const initialServiceableCountries =
    canUseBusinessMode && session?.user?.id
      ? await getServiceableCountries()
      : [];
  const shopMode = await getShopMode();
  const sessionUser =
    isCustomer && session?.user?.email
      ? {
          id: session.user.id ?? "",
          name: session.user.name ?? null,
          email: session.user.email,
        }
      : null;

  // Partition into nav groups (keyed by navGroup value) and ungrouped standalones
  const groupedCats = new Map<NavGroupKey, CategoryWithChildren[]>();
  const standaloneCats: CategoryWithChildren[] = [];
  for (const cat of categoryTree) {
    if (cat.navGroup !== null) {
      const g = cat.navGroup;
      const bucket = groupedCats.get(g) ?? [];
      bucket.push(cat);
      groupedCats.set(g, bucket);
    } else {
      standaloneCats.push(cat);
    }
  }

  const navItems: NavItem[] = [];
  navItems.push({ label: tNav("shop_all"), href: "/shop" });

  for (const group of GROUP_ORDER) {
    const members = groupedCats.get(group) ?? [];
    if (members.length === 0) continue;

    const columns = members.map((cat) => ({
      label: resolveLocaleName(cat, locale),
      href: `/shop/${cat.slug}`,
      links: cat.children.map((child) => ({
        label: resolveLocaleName(child, locale),
        href: `/shop/${child.slug}`,
      })),
    }));

    navItems.push({
      label: GROUP_LABELS[group],
      href:
        group === "AMMO" ? `/shop/${members[0].slug}` : GROUP_HREFS[group],
      columns,
      ...(group === "RIFLES"
        ? {
            megaImage: menuPhotoUrl(siteBanners.value),
            megaFocus: siteBanners.value.focus.menuPhoto,
          }
        : {}),
    });
  }

  for (const cat of standaloneCats) {
    if (cat.children.length > 0) {
      navItems.push({
        label: resolveLocaleName(cat, locale),
        href: `/shop/${cat.slug}`,
        columns: [
          {
            label: resolveLocaleName(cat, locale),
            href: `/shop/${cat.slug}`,
            links: cat.children.map((child) => ({
              label: resolveLocaleName(child, locale),
              href: `/shop/${child.slug}`,
            })),
          },
        ],
      });
    } else {
      navItems.push({
        label: resolveLocaleName(cat, locale),
        href: `/shop/${cat.slug}`,
      });
    }
  }

  navItems.push({ label: tNav("b2b"), href: "/b2b" });

  return (
    <StickyHeader
      className="sticky top-0 w-full relative"
      style={{
        backgroundColor: "var(--color-surface-sunken)",
        borderBottom: "1px solid var(--color-border-default)",
        zIndex: "var(--z-sticky)",
      }}
    >
      <nav
        className="mx-auto flex h-14 lg:h-[75px] max-w-[1440px] items-center px-2 lg:px-10"
        aria-label="Main navigation"
      >
        <MobileNavController items={navItems} sessionUser={sessionUser} />
        <Link
          href="/"
          className="flex shrink-0 items-center gap-[10px]"
          aria-label={tNav("aria_home")}
        >
          <BrandMark size={64} priority className="h-9 w-auto lg:h-16" />
          <span
            dir="ltr"
            className="brand-wordmark brand-wordmark--nav"
            style={{ color: "var(--color-content-primary)" }}
          >
            {BRAND.wordmark}
          </span>
        </Link>

        <ul className="hidden lg:flex items-center gap-7 mx-auto" role="list">
          {navItems.map((item) =>
            item.columns && item.columns.length > 0 ? (
              <NavDropdown
                key={item.href}
                label={item.label}
                href={item.href}
                columns={item.columns}
                megaImage={item.megaImage}
                megaFocus={item.megaFocus}
                allLabel={shopAllLabel}
              />
            ) : (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="shop-nav-link flex items-center gap-1 text-label tracking-widest uppercase transition-colors duration-150"
                  style={{ color: "var(--color-content-secondary)" }}
                >
                  {item.label}
                </Link>
              </li>
            ),
          )}
        </ul>

        <div className="flex shrink-0 items-center gap-5 ms-auto lg:ms-0">
          <NavbarClient
            locale={locale}
            sessionUser={sessionUser}
            canUseBusinessMode={canUseBusinessMode}
            shopMode={shopMode}
            addresses={initialAddresses}
            serviceableCountries={initialServiceableCountries}
          />
          <LanguageSheet />
        </div>
      </nav>

      <CartStoreHydrator
        initialCart={initialCart}
        isAuthenticated={!!sessionUser}
      />
      <WishlistStoreHydrator
        initialSkus={wishlistSkus}
        isAuthenticated={!!sessionUser}
      />
    </StickyHeader>
  );
}
