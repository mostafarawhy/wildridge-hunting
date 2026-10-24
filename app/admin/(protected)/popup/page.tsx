import { requireStaff } from "@/lib/auth-staff";
import { getHomePopupStyle, getPopupBanner } from "@/lib/db/queries/banners";
import { popupSignupLabels } from "@/components/admin/store-preview-labels";
import { dubaiDayFromIso } from "@/lib/utils/coupon-display";
import { getContentImageUrl, getImageUrl } from "@/lib/utils/images";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import HomePopupForm, {
  type PopupStatus,
} from "@/components/admin/HomePopupForm";

export default async function Page() {
  await requireStaff("content:manage");
  const [banner, style] = await Promise.all([
    getPopupBanner(),
    getHomePopupStyle(),
  ]);

  const now = new Date();
  let status: PopupStatus = "Live";
  if (!banner?.isActive) status = "Off";
  else if (banner.startsAt && now < banner.startsAt) status = "Scheduled";
  else if (banner.endsAt && now > banner.endsAt) status = "Ended";

  return (
    <ContentPageFrame
      backHref="/admin"
      backLabel="Back to Dashboard"
      title="Homepage Popup"
      status={{ label: status, tone: status === "Live" ? "green" : "grey" }}
      purpose="A welcome message or offer shown once to each visitor, 2 seconds after their first page load. Never on cart, checkout, account or sign-in pages."
      sketch="popup"
    >
        <HomePopupForm
          initial={{
            status,
            isActive: banner?.isActive ?? false,
            titleEn: banner?.titleEn ?? "",
            titleAr: banner?.titleAr ?? "",
            titleRu: banner?.titleRu ?? "",
            subtitleEn: banner?.subtitleEn ?? "",
            subtitleAr: banner?.subtitleAr ?? "",
            subtitleRu: banner?.subtitleRu ?? "",
            ctaEn: banner?.ctaEn ?? "",
            ctaAr: banner?.ctaAr ?? "",
            ctaRu: banner?.ctaRu ?? "",
            linkUrl: banner?.linkUrl ?? "",
            theme: style.theme,
            buttonColor: style.buttonColor,
            purpose: style.purpose,
            startsOn: banner?.startsAt
              ? dubaiDayFromIso(banner.startsAt.toISOString())
              : "",
            endsOn: banner?.endsAt
              ? dubaiDayFromIso(banner.endsAt.toISOString())
              : "",
          }}
          imageUrl={
            banner?.storageKey
              ? (getContentImageUrl(banner.storageKey) ?? getImageUrl(banner.storageKey))
              : null
          }
          signupLabels={popupSignupLabels}
        />
    </ContentPageFrame>
  );
}
