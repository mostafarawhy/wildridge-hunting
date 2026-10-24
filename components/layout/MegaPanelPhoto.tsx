import { focalPosition, type FocalPoint } from "@/lib/utils/focal-point";

interface MegaPanelPhotoProps {
  imageUrl: string;
  focus?: FocalPoint;
  label: string;
  allLabel: string;
  show: boolean;
}

export default function MegaPanelPhoto({
  imageUrl,
  focus,
  label,
  allLabel,
  show,
}: MegaPanelPhotoProps) {
  return (
    <>
      {show && (
        <div
          className="absolute inset-0 bg-cover transition-transform duration-500 group-hover:scale-[1.03]"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundPosition: focalPosition(focus ?? { x: 50, y: 50 }),
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 60%)",
        }}
      />
      <div className="absolute bottom-0 start-0 end-0 p-4">
        <p
          className="text-eyebrow uppercase tracking-widest"
          style={{ color: "var(--color-accent)" }}
        >
          {label}
        </p>
        <p
          className="text-body-lg mt-1"
          style={{
            color: "var(--color-content-primary)",
            fontWeight: 600,
          }}
        >
          {allLabel}{" "}
          <span aria-hidden="true" className="inline-block flip-rtl">
            →
          </span>
        </p>
      </div>
    </>
  );
}
