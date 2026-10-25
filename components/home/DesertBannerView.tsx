import Image from "next/image";
import { HOME_BUILTIN_MEDIA } from "@/lib/settings/home-page";
import InViewVideo from "@/components/ui/InViewVideo";
import { isPreviewSrc } from "@/lib/utils/images";
import { posterSrc } from "@/lib/utils/poster-src";

interface DesertBannerViewProps {
  heading: string;
  photoUrl: string | null;
  videoUrl: string | null;
  pauseLabel?: string;
  playLabel?: string;
}

export default function DesertBannerView({
  heading,
  photoUrl,
  videoUrl,
  pauseLabel,
  playLabel,
}: DesertBannerViewProps) {
  return (
    <section
      className="relative w-full overflow-hidden min-h-[440px] lg:min-h-[650px]"
      aria-label="Into the field"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-surface-sunken)", zIndex: 0 }}
      />

      {photoUrl === null && !HOME_BUILTIN_MEDIA.desert.video ? (
        <div
          className="absolute inset-0"
          style={{ zIndex: 1 }}
          aria-hidden="true"
        >
          <Image
            src={HOME_BUILTIN_MEDIA.desert.poster}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "center" }}
            unoptimized={isPreviewSrc(HOME_BUILTIN_MEDIA.desert.poster)}
          />
        </div>
      ) : photoUrl === null ? (
        <InViewVideo
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 1 }}
          src={HOME_BUILTIN_MEDIA.desert.video}
          poster={posterSrc(HOME_BUILTIN_MEDIA.desert.poster)}
          muted
          loop
          playsInline
          pauseLabel={pauseLabel}
          playLabel={playLabel}
          controlClassName="bottom-0.5 end-4 lg:bottom-2 lg:end-10"
        />
      ) : videoUrl !== null ? (
        <InViewVideo
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 1 }}
          src={videoUrl}
          poster={posterSrc(photoUrl)}
          muted
          loop
          playsInline
          pauseLabel={pauseLabel}
          playLabel={playLabel}
          controlClassName="bottom-0.5 end-4 lg:bottom-2 lg:end-10"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ zIndex: 1 }}
          aria-hidden="true"
        >
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "center" }}
            unoptimized={isPreviewSrc(photoUrl)}
          />
        </div>
      )}

      <div
        className="absolute top-0 left-0 right-0 h-12 lg:h-[60px]"
        style={{ backgroundColor: "rgba(0,0,0,0.90)", zIndex: 2 }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-12 lg:h-[60px]"
        style={{ backgroundColor: "rgba(0,0,0,0.90)", zIndex: 2 }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.5) 100%)",
          zIndex: 2,
        }}
      />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
        style={{ zIndex: 3 }}
      >
        <h2
          className="max-lg:text-[2rem] text-display font-bold uppercase leading-[1] tracking-tight lg:text-display"
          style={{
            color: "var(--color-content-primary)",
            textShadow: "0 2px 40px rgba(0,0,0,0.6)",
          }}
        >
          {heading}
        </h2>
      </div>
    </section>
  );
}
