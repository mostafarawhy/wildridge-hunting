import { PrismaClient } from "../../app/generated/prisma/client";
import { logSection, logDone } from "./seed-utils";

export async function seedSettings(db: PrismaClient) {
  logSection("Settings");

  await db.projectConfig.upsert({
    where: { key: "store_profile" },
    update: {},
    create: {
      key: "store_profile",
      value: { storeName: "", contactEmail: "", contactPhone: "", addressLine: "" },
    },
  });

  await db.projectConfig.upsert({
    where: { key: "email_identity" },
    update: {},
    create: {
      key: "email_identity",
      value: { fromName: "", replyTo: "" },
    },
  });

  await db.projectConfig.upsert({
    where: { key: "email_recipients" },
    update: {},
    create: {
      key: "email_recipients",
      value: { sales: [], orders: [], support: [] },
    },
  });

  await db.projectConfig.upsert({
    where: { key: "tax_config" },
    update: {},
    create: { key: "tax_config", value: { vatRate: 0.05, storeTrn: "" } },
  });

  logDone("settings", 4);
}
