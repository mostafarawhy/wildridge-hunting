"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import SearchCombobox from "@/components/search/SearchCombobox";

interface SearchInputInnerProps {
  initialValue: string;
  scopeCategory?: string;
}

function SearchInputInner({
  initialValue,
  scopeCategory,
}: SearchInputInnerProps) {
  const t = useTranslations("shop");

  return (
    <div className="flex-1 min-w-0 lg:max-w-sm">
      <SearchCombobox
        variant="shop"
        initialValue={initialValue}
        scopeCategory={scopeCategory}
        placeholder={t("search_placeholder")}
      />
    </div>
  );
}

interface SearchInputProps {
  initialValue?: string;
  scopeCategory?: string;
}

export default function SearchInput({
  initialValue = "",
  scopeCategory,
}: SearchInputProps) {
  return (
    <Suspense
      fallback={
        <div
          className="flex-1 lg:max-w-sm h-9"
          style={{ border: "1px solid var(--color-content-tertiary)" }}
        />
      }
    >
      <SearchInputInner
        key={initialValue}
        initialValue={initialValue}
        scopeCategory={scopeCategory}
      />
    </Suspense>
  );
}
