"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Button from "@/components/ui/Button";
import PageStatus from "@/components/layout/PageStatus";

const COPY = {
  en: {
    dir: "ltr",
    eyebrow: "Error",
    title: "Something went wrong",
    body: "We couldn't load the site. Reload the page to try again.",
    reload: "Reload page",
    reference: "Reference",
  },
  ar: {
    dir: "rtl",
    eyebrow: "خطأ",
    title: "حدث خطأ ما",
    body: "تعذّر تحميل الموقع. أعد تحميل الصفحة للمحاولة مرة أخرى.",
    reload: "إعادة تحميل الصفحة",
    reference: "الرقم المرجعي",
  },
  ru: {
    dir: "ltr",
    eyebrow: "Ошибка",
    title: "Что-то пошло не так",
    body: "Не удалось загрузить сайт. Обновите страницу, чтобы попробовать снова.",
    reload: "Обновить страницу",
    reference: "Код",
  },
} as const;

type Locale = keyof typeof COPY;

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const segment = usePathname()?.split("/")[1];
  const locale: Locale = segment === "ar" || segment === "ru" ? segment : "en";
  const copy = COPY[locale];

  return (
    <html lang={locale} dir={copy.dir}>
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif',
        }}
      >
        <PageStatus
          standalone
          eyebrow={copy.eyebrow}
          title={copy.title}
          body={copy.body}
          action={
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => window.location.reload()}
            >
              {copy.reload}
            </Button>
          }
          footnote={
            error.digest ? (
              <>
                {copy.reference}: <bdi dir="ltr">{error.digest}</bdi>
              </>
            ) : undefined
          }
        />
      </body>
    </html>
  );
}
