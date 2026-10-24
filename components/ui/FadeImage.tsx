"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

type FadeImageProps = ImageProps & {
  fade?: boolean;
  tone?: "light" | "dark";
};

type LoadState = "loading" | "loaded" | "error";

export default function FadeImage({
  fade = true,
  tone = "light",
  className,
  alt,
  onLoad,
  onError,
  ...props
}: FadeImageProps) {
  const [state, setState] = useState<LoadState>("loading");
  const dark = tone === "dark";

  if (state === "error") {
    return (
      <span
        className={dark ? "img-fallback img-fallback--dark" : "img-fallback"}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <>
      <span
        className={dark ? "img-tone img-tone--dark" : "img-tone"}
        data-loaded={state === "loaded" ? "true" : "false"}
        aria-hidden="true"
      />
      <Image
        {...props}
        alt={alt}
        className={[className, fade ? "img-fade" : ""].filter(Boolean).join(" ")}
        data-loaded={state === "loaded" ? "true" : "false"}
        onLoad={(event) => {
          setState("loaded");
          onLoad?.(event);
        }}
        onError={(event) => {
          setState("error");
          onError?.(event);
        }}
      />
    </>
  );
}
