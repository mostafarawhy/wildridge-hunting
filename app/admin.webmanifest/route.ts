import { BRAND } from "@/lib/config/brand";

export const dynamic = "force-static";

const manifest = {
  id: "/admin",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  name: `${BRAND.name} Admin`,
  short_name: `${BRAND.wordmark} Admin`,
  description: BRAND.description,
  theme_color: "#FFFFFF",
  background_color: "#FFFFFF",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
