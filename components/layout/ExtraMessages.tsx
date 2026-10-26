"use client";

import { useMemo } from "react";
import {
  NextIntlClientProvider,
  useLocale,
  useMessages,
  type AbstractIntlMessages,
} from "next-intl";
import { mergeMessages } from "@/lib/client-messages";

export default function ExtraMessages({
  messages,
  children,
}: {
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const parent = useMessages();
  const merged = useMemo(() => mergeMessages(parent, messages), [parent, messages]);

  return (
    <NextIntlClientProvider locale={locale} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
