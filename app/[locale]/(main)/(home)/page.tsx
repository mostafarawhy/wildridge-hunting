import HeroSection from "@/components/home/HeroSection";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import CollectionTiles from "@/components/home/CollectionTiles";
import BrandStory from "@/components/home/BrandStory";
import NewsletterSection from "@/components/home/NewsletterSection";
import { DesertExperienceBanner, ProductShowcase } from "@/components/home";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;

  return (
    <>
      <HeroSection />
      <FeaturedProducts locale={locale} />
      <CollectionTiles />
      <DesertExperienceBanner />
      <NewsletterSection />
      <ProductShowcase />
      <BrandStory />
    </>
  );
}
