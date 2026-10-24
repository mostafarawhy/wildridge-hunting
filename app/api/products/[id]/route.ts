import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/db/queries/products";
import { getSetting } from "@/lib/db/queries/settings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const program = await getSetting("loyalty_program");

  return NextResponse.json({
    ...product,
    loyaltyEarnRate: program.enabled ? program.earnRate : null,
  });
}
