import {
  countPlaceholders,
  splitParagraphs,
  type AboutFigureCounts,
  type AboutFigureSource,
  type AboutIconName,
  type AboutLocale,
  type AboutPageValue,
} from "@/lib/settings/about-page";

export type AboutView = {
  story: {
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    photoUrl: string | null;
  };
  figures: { value: string; label: string; icon: AboutIconName }[] | null;
  mission: {
    eyebrow: string;
    heading: string;
    text: string;
    photoUrl: string | null;
    points: { icon: AboutIconName; title: string; line: string }[];
  } | null;
  team: {
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    photoUrl: string | null;
    album: { url: string; caption: string }[];
  } | null;
  visit: boolean;
};

export function formatFigureCount(source: AboutFigureSource, count: number): string {
  const format = new Intl.NumberFormat("en-US");
  if (source === "products" && count >= 100) {
    return `${format.format(Math.floor(count / 10) * 10)}+`;
  }
  return format.format(count);
}

export function toAboutView(
  value: AboutPageValue,
  locale: AboutLocale,
  opts: { urlOf: (key: string) => string; counts: AboutFigureCounts },
): AboutView {
  const story = value.story.copy[locale];
  const mission = value.mission.copy[locale];
  const team = value.team.copy[locale];

  const figureItems = value.figures.visible
    ? value.figures.items.flatMap((item) => {
        const label = item.label[locale];
        if (item.source === "manual") {
          return countPlaceholders(item.value) === 0
            ? [{ value: item.value, label, icon: item.icon }]
            : [];
        }
        const count = opts.counts[item.source];
        return count > 0
          ? [{ value: formatFigureCount(item.source, count), label, icon: item.icon }]
          : [];
      })
    : [];

  return {
    story: {
      eyebrow: story.eyebrow,
      heading: story.heading,
      paragraphs: splitParagraphs(story.body),
      photoUrl: value.story.photo ? opts.urlOf(value.story.photo) : null,
    },
    figures: figureItems.length > 0 ? figureItems : null,
    mission: value.mission.visible
      ? {
          eyebrow: mission.eyebrow,
          heading: mission.heading,
          text: mission.body,
          photoUrl: value.mission.photo ? opts.urlOf(value.mission.photo) : null,
          points: mission.points.map((point, index) => ({
            icon: value.mission.icons[index],
            title: point.title,
            line: point.line,
          })),
        }
      : null,
    team: value.team.visible
      ? {
          eyebrow: team.eyebrow,
          heading: team.heading,
          paragraphs: splitParagraphs(team.body),
          photoUrl: value.team.photo ? opts.urlOf(value.team.photo) : null,
          album: value.team.album.map((item) => ({
            url: opts.urlOf(item.photo),
            caption: item.caption[locale].trim(),
          })),
        }
      : null,
    visit: value.visit.visible,
  };
}
