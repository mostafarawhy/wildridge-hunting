import AnnouncementBar from "@/components/layout/AnnouncementBar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HomePopup from "@/components/layout/HomePopup";
import { ToastProvider } from "@/components/ui/Toast";

interface MainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function MainLayout({
  children,
  params,
}: MainLayoutProps) {
  const { locale } = await params;

  return (
    <ToastProvider>
      <AnnouncementBar />
      <Navbar locale={locale} />
      <main className="flex-1">{children}</main>
      <Footer />
      <HomePopup />
    </ToastProvider>
  );
}
