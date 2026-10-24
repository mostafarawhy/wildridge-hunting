import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import { auth } from "@/auth";
import { listStorePagesForAdmin } from "@/lib/db/queries/admin-pages";
import { isPageKey } from "@/lib/utils/page-keys";
import StorePageEditor from "@/components/admin/StorePageEditor";
import AboutSectionsEditor from "@/components/admin/AboutSectionsEditor";
import type { AboutPreviewLabels } from "@/components/admin/AboutPreview";
import { getAboutFigureCounts, getAboutPage } from "@/lib/db/queries/about-page";
import { aboutPhotoKeys, type AboutLocale } from "@/lib/settings/about-page";
import { getContentImageUrl, getImageUrl } from "@/lib/utils/images";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";

interface Props {
  params: Promise<{ key: string }>;
}

const CATALOGS = { en, ar, ru } as const;

function aboutLabels(locale: AboutLocale): AboutPreviewLabels {
  const catalog = CATALOGS[locale];
  return {
    visitEyebrow: catalog.pages.about.visitEyebrow,
    visitTitle: catalog.pages.about.visitTitle,
    contactCta: catalog.pages.about.contactCta,
    previous: catalog.pages.about.photoPrevious,
    next: catalog.pages.about.photoNext,
    photoLabel: catalog.pages.about.photoLabel,
    close: catalog.shop.close,
    englishOnly: catalog.pages.meta.englishOnly,
  };
}

export default async function AdminStorePageDetailPage({ params }: Props) {
  const { key } = await params;
  await requireStaff("content:manage");

  if (!isPageKey(key)) notFound();

  const rows = await listStorePagesForAdmin();
  const row = rows.find((r) => r.key === key);
  if (!row) notFound();

  const session = await auth();
  const staffName = session?.user?.name ?? "You";

  const [about, counts] =
    key === "about"
      ? await Promise.all([getAboutPage(), getAboutFigureCounts()])
      : [null, null];

  return (
    <StorePageEditor
      pageKey={row.key}
      initialRow={row}
      staffName={staffName}
      sectionsSlot={
        about && counts ? (
          <AboutSectionsEditor
            initial={about.value}
            legacy={about.legacy}
            counts={counts}
            initialUrls={Object.fromEntries(
              aboutPhotoKeys(about.value).map((photo) => [photo, getContentImageUrl(photo) ?? getImageUrl(photo)]),
            )}
            labels={{ en: aboutLabels("en"), ar: aboutLabels("ar"), ru: aboutLabels("ru") }}
          />
        ) : undefined
      }
    />
  );
}
