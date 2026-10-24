import { BRAND } from "@/lib/config/brand";
import { z } from "zod";

export const ABOUT_LOCALES = ["en", "ar", "ru"] as const;
export type AboutLocale = (typeof ABOUT_LOCALES)[number];

export const ABOUT_PHOTO_PREFIX = "about/";
export const ABOUT_PHOTO_KEY_RE =
  /^about\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const ABOUT_ICONS = [
  "shield",
  "conversation",
  "truck",
  "target",
  "star",
  "map",
  "users",
  "leaf",
  "calendar",
  "tag",
  "language",
] as const;
export type AboutIconName = (typeof ABOUT_ICONS)[number];

const aboutIcon = z.enum(ABOUT_ICONS);

export const ABOUT_FIGURE_SOURCES = ["manual", "brands", "products", "showrooms"] as const;
export type AboutFigureSource = (typeof ABOUT_FIGURE_SOURCES)[number];
export type AboutFigureCounts = { brands: number; products: number; showrooms: number };

export const ABOUT_LIMITS = {
  eyebrow: 40,
  heading: 80,
  storyText: 1500,
  storyParagraphs: 3,
  missionText: 400,
  teamText: 800,
  teamParagraphs: 2,
  figureValue: 12,
  figureLabel: 40,
  figures: 4,
  pointTitle: 60,
  pointLine: 160,
  caption: 140,
  album: 12,
} as const;

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const photoKey = z.string().regex(ABOUT_PHOTO_KEY_RE, "This photo is not valid.");

function perLocale<T extends z.ZodType>(shape: T) {
  return z.object({ en: shape, ar: shape, ru: shape });
}

function limited(max: number, noun: string) {
  return z
    .string()
    .trim()
    .max(max, `Keep the ${noun} to ${max} characters or fewer.`);
}

const eyebrowField = limited(ABOUT_LIMITS.eyebrow, "eyebrow");
const headingField = limited(ABOUT_LIMITS.heading, "heading");

const storyBody = limited(ABOUT_LIMITS.storyText, "text").refine(
  (v) => splitParagraphs(v).length <= ABOUT_LIMITS.storyParagraphs,
  "Use up to three paragraphs.",
);

const missionBody = limited(ABOUT_LIMITS.missionText, "text").refine(
  (v) => splitParagraphs(v).length <= 1,
  "Use one paragraph, with no empty line.",
);

const teamBody = limited(ABOUT_LIMITS.teamText, "text").refine(
  (v) => splitParagraphs(v).length <= ABOUT_LIMITS.teamParagraphs,
  "Use one or two paragraphs.",
);

const missionPoint = z.object({
  title: limited(ABOUT_LIMITS.pointTitle, "title"),
  line: limited(ABOUT_LIMITS.pointLine, "line"),
});

const figureItem = z.object({
  source: z.enum(ABOUT_FIGURE_SOURCES).default("manual"),
  value: z
    .string()
    .trim()
    .max(
      ABOUT_LIMITS.figureValue,
      `Keep the figure to ${ABOUT_LIMITS.figureValue} characters or fewer.`,
    ),
  icon: aboutIcon,
  label: perLocale(limited(ABOUT_LIMITS.figureLabel, "label")),
});

const albumPhoto = z.object({
  photo: photoKey,
  caption: perLocale(limited(ABOUT_LIMITS.caption, "caption")),
});

export const aboutPageSchema = z.object({
  story: z.object({
    photo: photoKey.nullable(),
    copy: perLocale(
      z.object({
        eyebrow: eyebrowField,
        heading: headingField,
        body: storyBody,
      }),
    ),
  }),
  figures: z.object({
    visible: z.boolean(),
    items: z
      .array(figureItem)
      .max(ABOUT_LIMITS.figures, "Show up to four figures.")
      .superRefine((items, ctx) => {
        items.forEach((item, index) => {
          if (item.source === "manual" && item.value === "") {
            ctx.addIssue({
              code: "custom",
              message: "Add the figure.",
              path: [index, "value"],
            });
          }
        });
      }),
  }),
  mission: z.object({
    visible: z.boolean(),
    photo: photoKey.nullable(),
    icons: z.array(aboutIcon).length(3, "Choose exactly three icons."),
    copy: perLocale(
      z.object({
        eyebrow: eyebrowField,
        heading: headingField,
        body: missionBody,
        points: z.array(missionPoint).length(3, "Add exactly three points."),
      }),
    ),
  }),
  team: z.object({
    visible: z.boolean(),
    photo: photoKey.nullable(),
    copy: perLocale(
      z.object({
        eyebrow: eyebrowField,
        heading: headingField,
        body: teamBody,
      }),
    ),
    album: z
      .array(albumPhoto)
      .max(ABOUT_LIMITS.album, "The album holds up to 12 photos.")
      .superRefine((album, ctx) => {
        const seen = new Set<string>();
        album.forEach((item, index) => {
          if (seen.has(item.photo)) {
            ctx.addIssue({
              code: "custom",
              message: "Each photo can be used once.",
              path: [index, "photo"],
            });
          }
          seen.add(item.photo);
        });
      }),
  }),
  visit: z.object({ visible: z.boolean() }),
});

export type AboutPageValue = z.infer<typeof aboutPageSchema>;

export const ABOUT_PAGE_DEFAULT: AboutPageValue = {
  story: {
    photo: null,
    copy: {
      en: {
        eyebrow: "How it began",
        heading: "Where we started",
        body: [
          `${BRAND.shortName} began in [YEAR] with a small range of hunting gear, put together by people who spend their weekends in the field.`,
          "We wanted a shop that gives straight answers, stocks only what we would carry ourselves, and makes ordering as simple as the gear is dependable.",
        ].join("\n\n"),
      },
      ar: {
        eyebrow: "كيف بدأنا",
        heading: "بداياتنا",
        body: [
          `انطلقت ${BRAND.shortName} عام [سنة التأسيس] بتشكيلة صغيرة من معدات الصيد، اختارها أشخاص يقضون عطلات أسابيعهم في البراري.`,
          "أردنا متجرًا يعطيك جوابًا صريحًا، ولا يعرض إلا ما كنا سنحمله بأنفسنا، ويجعل الطلب بسيطًا بقدر ما هي المعدات موثوقة.",
        ].join("\n\n"),
      },
      ru: {
        eyebrow: "Как всё начиналось",
        heading: "С чего мы начинали",
        body: [
          `${BRAND.shortName} начался в [ГОД] с небольшой коллекции снаряжения для охоты, которую собрали люди, проводящие выходные в поле.`,
          "Нам хотелось магазина, который отвечает прямо, держит в ассортименте только то, что мы взяли бы себе, и делает заказ таким же простым, как надёжно само снаряжение.",
        ].join("\n\n"),
      },
    },
  },
  figures: {
    visible: true,
    items: [
      {
        source: "manual",
        value: "[YEAR]",
        icon: "calendar",
        label: {
          en: "Year we opened",
          ar: "سنة انطلاقتنا",
          ru: "Год открытия",
        },
      },
      {
        source: "brands",
        value: "",
        icon: "tag",
        label: {
          en: "Brands we carry",
          ar: "علامة تجارية نوفّرها",
          ru: "Брендов в ассортименте",
        },
      },
      {
        source: "manual",
        value: "3",
        icon: "language",
        label: {
          en: "Languages we serve you in",
          ar: "لغات نخدمك بها",
          ru: "Языка обслуживания",
        },
      },
      {
        source: "manual",
        value: "100%",
        icon: "shield",
        label: {
          en: "Licensed orders verified",
          ar: "من الطلبات المرخّصة موثّقة",
          ru: "Лицензионных заказов проверено",
        },
      },
    ],
  },
  mission: {
    visible: true,
    photo: null,
    icons: ["shield", "conversation", "truck"],
    copy: {
      en: {
        eyebrow: "Our mission",
        heading: "How we sell",
        body: "Buying a firearm in the UAE is regulated, and it should be. We handle the paperwork with you so it stays simple.",
        points: [
          {
            title: "Verified once",
            line: "Your licence and identity are checked before your first licensed order ships, then kept on file.",
          },
          {
            title: "Advice first",
            line: "We recommend what suits your hunt or discipline, not what costs the most.",
          },
          {
            title: "Delivered legally",
            line: "Every licensed shipment follows UAE regulations.",
          },
        ],
      },
      ar: {
        eyebrow: "مهمتنا",
        heading: "كيف نبيع",
        body: "شراء سلاح ناري في الإمارات أمر منظَّم، وهكذا يجب أن يكون. نتولّى الإجراءات معك لتبقى بسيطة.",
        points: [
          {
            title: "تحقق لمرة واحدة",
            line: "نتحقق من ترخيصك وهويتك قبل شحن أول طلب مرخّص، ثم نحتفظ بها في ملفك.",
          },
          {
            title: "النصيحة أولًا",
            line: "نرشّح ما يناسب رحلة صيدك أو رياضتك، لا الأغلى ثمنًا.",
          },
          {
            title: "توصيل وفق القانون",
            line: "كل شحنة مرخّصة تتبع لوائح دولة الإمارات.",
          },
        ],
      },
      ru: {
        eyebrow: "Наша миссия",
        heading: "Как мы продаём",
        body: "Покупка оружия в ОАЭ регулируется законом, и так и должно быть. Мы помогаем с оформлением, чтобы всё оставалось просто.",
        points: [
          {
            title: "Одна проверка",
            line: "Мы проверяем лицензию и личность перед отправкой первого лицензионного заказа и сохраняем данные в вашем профиле.",
          },
          {
            title: "Сначала совет",
            line: "Мы рекомендуем то, что подходит для вашей охоты или дисциплины, а не самое дорогое.",
          },
          {
            title: "Доставка по закону",
            line: "Каждая лицензионная отправка соответствует законодательству ОАЭ.",
          },
        ],
      },
    },
  },
  team: {
    visible: true,
    photo: null,
    copy: {
      en: {
        eyebrow: "Our team",
        heading: "People who hunt and shoot",
        body: [
          "Our team hunts and shoots too, so the advice you get comes from the field and the range.",
          "We serve individual hunters and sport shooters, private collectors, and business customers such as clubs, ranges and resellers. Business customers can open a business account for quotes, priced orders and a dedicated contact.",
        ].join("\n\n"),
      },
      ar: {
        eyebrow: "فريقنا",
        heading: "أشخاص يمارسون الصيد والرماية",
        body: [
          "فريقنا يمارس الصيد والرماية أيضًا، لذا تأتيك نصيحتنا من الميدان وميدان الرماية.",
          "نخدم الصيادين والرماة الرياضيين الأفراد، وهواة الجمع، وعملاء الأعمال مثل الأندية وميادين الرماية والموزعين. يمكن لعملاء الأعمال فتح حساب أعمال للحصول على عروض الأسعار والطلبات المسعّرة وجهة تواصل مخصّصة.",
        ].join("\n\n"),
      },
      ru: {
        eyebrow: "Наша команда",
        heading: "Люди, которые сами охотятся и стреляют",
        body: [
          "Наша команда тоже охотится и стреляет, поэтому наши советы основаны на опыте в поле и на стрельбище.",
          "Мы обслуживаем частных охотников и спортивных стрелков, коллекционеров, а также бизнес-клиентов: клубы, стрельбища и реселлеров. Бизнес-клиенты могут открыть бизнес-аккаунт для коммерческих предложений, заказов по согласованным ценам и персонального менеджера.",
        ].join("\n\n"),
      },
    },
    album: [],
  },
  visit: { visible: true },
};

export function readAboutPage(raw: unknown): {
  value: AboutPageValue;
  legacy: boolean;
} {
  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === "object" && Object.keys(raw).length === 0)
  ) {
    return { value: ABOUT_PAGE_DEFAULT, legacy: false };
  }
  const parsed = aboutPageSchema.safeParse(raw);
  if (parsed.success) return { value: parsed.data, legacy: false };
  return { value: ABOUT_PAGE_DEFAULT, legacy: true };
}

function gapEntries(
  value: AboutPageValue,
  locale: AboutLocale,
): [string, string][] {
  const gaps: [string, string][] = [];

  function checkText(path: string, text: string, message: string) {
    if (!text.trim()) gaps.push([path, message]);
  }

  function checkSection(
    prefix: string,
    copy: { eyebrow: string; heading: string; body: string },
  ) {
    checkText(`${prefix}.eyebrow`, copy.eyebrow, "Add an English eyebrow.");
    checkText(`${prefix}.heading`, copy.heading, "Add an English heading.");
    checkText(`${prefix}.body`, copy.body, "Add the English text.");
  }

  checkSection(`story.copy.${locale}`, value.story.copy[locale]);

  if (value.figures.visible) {
    value.figures.items.forEach((item, index) => {
      checkText(
        `figures.items.${index}.label.${locale}`,
        item.label[locale],
        "Add an English label.",
      );
    });
  }

  if (value.mission.visible) {
    const mission = value.mission.copy[locale];
    checkSection(`mission.copy.${locale}`, mission);
    mission.points.forEach((point, index) => {
      checkText(
        `mission.copy.${locale}.points.${index}.title`,
        point.title,
        "Add an English title.",
      );
      checkText(
        `mission.copy.${locale}.points.${index}.line`,
        point.line,
        "Add an English line.",
      );
    });
  }

  if (value.team.visible) {
    checkSection(`team.copy.${locale}`, value.team.copy[locale]);
  }

  return gaps;
}

export function isAboutLocaleComplete(
  value: AboutPageValue,
  locale: AboutLocale,
): boolean {
  return gapEntries(value, locale).length === 0;
}

export function englishGaps(value: AboutPageValue): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [path, message] of gapEntries(value, "en")) {
    result[path] = [message];
  }
  return result;
}

export function countPlaceholders(text: string): number {
  return (text.match(/\[[^\]\n]+\]/g) ?? []).length;
}

export function aboutPhotoKeys(value: AboutPageValue): string[] {
  const keys: string[] = [];
  if (value.story.photo) keys.push(value.story.photo);
  if (value.mission.photo) keys.push(value.mission.photo);
  if (value.team.photo) keys.push(value.team.photo);
  for (const item of value.team.album) keys.push(item.photo);
  return keys;
}
