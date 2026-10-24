"use client";

import RouteError from "@/components/layout/RouteError";

export default function LocaleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} standalone />;
}
