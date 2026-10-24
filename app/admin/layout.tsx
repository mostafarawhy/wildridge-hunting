import { GeistSans } from "geist/font/sans";
import { Suspense } from "react";
import NavigationProgress from "@/components/loading/NavigationProgress";
import DemoBanner from "@/components/layout/DemoBanner";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-surface="admin" className={GeistSans.variable}>
      <body>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <DemoBanner message="Portfolio demo. No real orders or payments. Visitor changes are reset regularly." />
        {children}
      </body>
    </html>
  );
}
