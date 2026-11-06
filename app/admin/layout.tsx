import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Suspense } from "react";
import { BRAND } from "@/lib/config/brand";
import NavigationProgress from "@/components/loading/NavigationProgress";
import DemoBanner from "@/components/layout/DemoBanner";
import MotionProvider from "@/components/ui/MotionProvider";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} Admin`,
    template: `%s | ${BRAND.name} Admin`,
  },
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    title: `${BRAND.name} Admin`,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-surface="admin" className={GeistSans.variable}>
      <body>
        <MotionProvider>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <DemoBanner message="Portfolio demo. No real orders or payments. Visitor changes are reset regularly." />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
