import "./load-env";
import { BRAND } from "../../lib/config/brand";
import { db } from "../../lib/db/client";
import { seedCatalog } from "./01-catalog.seed";
import { seedFeaturedCollections } from "./05-featured-collections.seed";
import { requireStaffSeedEnv, seedStaff } from "./06-staff.seed";
import { seedSettings } from "./07-settings.seed";
import { seedShipping } from "./08-shipping.seed";
import { seedProductImages } from "./09-product-images.seed";
import { seedDemoData } from "./10-demo-data.seed";
import { seedContent } from "./11-content.seed";

const rawPhase = process.env.SEED_PHASE ?? "";
const phases = rawPhase
  ? rawPhase.split(",").map((n) => parseInt(n.trim(), 10))
  : [1, 5, 6, 7, 8, 9, 10, 11];

async function main() {
  if (phases.includes(6)) requireStaffSeedEnv();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  ${`${BRAND.name.toUpperCase()} — DATABASE SEED`.padEnd(56)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  Running steps:  [${phases.join(", ")}]`);
  console.log(`  Environment:    ${process.env.NODE_ENV ?? "development"}`);
  console.log();

  if (phases.includes(1)) await seedCatalog(db);
  if (phases.includes(5)) await seedFeaturedCollections(db);
  if (phases.includes(6)) await seedStaff(db);
  if (phases.includes(7)) await seedSettings(db);
  if (phases.includes(8)) await seedShipping(db);
  if (phases.includes(9)) await seedProductImages(db);
  if (phases.includes(10)) await seedDemoData(db);
  if (phases.includes(11)) await seedContent(db);

  const [cats, prods, accessoryLinks, customers, orders, quotes, batches, staff] =
    await Promise.all([
      db.category.count(),
      db.product.count(),
      db.productAccessory.count(),
      db.customer.count(),
      db.order.count(),
      db.quoteRequest.count(),
      db.importBatch.count(),
      db.staff.count(),
    ]);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  ✅ SEED COMPLETE                                        ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Categories:    ${String(cats).padEnd(42)}║`);
  console.log(`║  Products:      ${String(prods).padEnd(42)}║`);
  console.log(`║  Accessory links:${String(accessoryLinks).padEnd(41)}║`);
  console.log(`║  Customers:     ${String(customers).padEnd(42)}║`);
  console.log(`║  Orders:        ${String(orders).padEnd(42)}║`);
  console.log(`║  B2B Quotes:    ${String(quotes).padEnd(42)}║`);
  console.log(`║  Import Batches:${String(batches).padEnd(42)}║`);
  console.log(`║  Staff:         ${String(staff).padEnd(42)}║`);
  console.log(
    `║  Featured Colls:${String(await db.featuredCollection.count()).padEnd(42)}║`,
  );
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  ⚠️  Never run the demo data step (10) in production    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e.message);
    if (process.env.NODE_ENV !== "production") console.error(e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
