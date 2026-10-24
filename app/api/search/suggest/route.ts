import { NextRequest, NextResponse } from "next/server";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { getSearchSuggestions } from "@/lib/db/queries/products";
import { getIsBusinessMode } from "@/lib/utils/shop-mode";
import { parseCatalogParams } from "@/lib/utils/catalog-params";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const record: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    record[key] = values.length > 1 ? values : values[0];
  }

  const q = searchParams.get("q") ?? "";
  const scopeCategory = searchParams.get("scopeCategory") ?? undefined;

  const params = parseCatalogParams(record, scopeCategory);
  params.search = q;

  const [result, customerId] = await Promise.all([
    getSearchSuggestions(params),
    getSessionCustomerId(),
  ]);
  const businessMode = await getIsBusinessMode(customerId);

  if (businessMode) {
    result.businessMode = true;
    result.products = result.products.map((p) => ({
      ...p,
      price: null,
      compareAtPrice: null,
    }));
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
