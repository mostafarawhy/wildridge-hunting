import type { CSSProperties, ReactNode } from "react";
import { getTranslations } from "next-intl/server";

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default async function LoadingRegion({ children, className, style }: Props) {
  const t = await getTranslations("nav");

  return (
    <>
      <span role="status" className="sr-only">
        {t("loading")}
      </span>
      <div aria-busy="true" className={className} style={style}>
        {children}
      </div>
    </>
  );
}
