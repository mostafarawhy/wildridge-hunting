interface ProductDescriptionProps {
  heading?: string;
  text: string;
  fallbackLang?: "en";
}

export default function ProductDescription({
  heading,
  text,
  fallbackLang,
}: ProductDescriptionProps) {
  return (
    <div className="flex flex-col gap-3">
      {heading && (
        <p
          className="text-eyebrow tracking-widest uppercase"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {heading}
        </p>
      )}
      <p
        className="text-body"
        style={{
          maxWidth: "68ch",
          color: "var(--primitive-black)",
          whiteSpace: "pre-line",
          lineHeight: 1.6,
        }}
        {...(fallbackLang ? { lang: fallbackLang, dir: "ltr" } : {})}
      >
        {text}
      </p>
    </div>
  );
}
