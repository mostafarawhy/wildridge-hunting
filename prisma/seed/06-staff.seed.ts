import { BRAND } from "../../lib/config/brand";
import { PrismaClient, StaffRole } from "../../app/generated/prisma/client";
import { logSection, logDone, requireEnv } from "./seed-utils";

export const STAFF_EMAILS = {
  superAdmin: `admin@${BRAND.emailDomain}`,
  demoStaff: `demo.staff@${BRAND.emailDomain}`,
  sales: `sales@${BRAND.emailDomain}`,
  fulfilment: `fulfilment@${BRAND.emailDomain}`,
  support: `support@${BRAND.emailDomain}`,
} as const;

const RETIRED_STAFF_LOCAL_PARTS = [
  "superadmin",
  "opsmanager",
  "catalog",
  "orders",
  "warehouse",
  "finance",
];

const BACKGROUND_STAFF = [
  { email: STAFF_EMAILS.sales, name: "Noor Haddad", role: StaffRole.ORDER_MGR },
  { email: STAFF_EMAILS.fulfilment, name: "Omar Sabbagh", role: StaffRole.WAREHOUSE },
  { email: STAFF_EMAILS.support, name: "Layla Mansour", role: StaffRole.SUPPORT },
];

export function requireStaffSeedEnv() {
  requireEnv("SEED_ADMIN_PASSWORD");
  requireEnv("DEMO_STAFF_PASSWORD");
}

export async function seedStaff(db: PrismaClient) {
  logSection("Staff");

  requireStaffSeedEnv();
  const bcrypt = await import("bcryptjs");
  const adminHash = await bcrypt.hash(requireEnv("SEED_ADMIN_PASSWORD"), 10);
  const demoHash = await bcrypt.hash(requireEnv("DEMO_STAFF_PASSWORD"), 10);

  const loginable = [
    {
      email: STAFF_EMAILS.superAdmin,
      name: "Super Admin",
      role: StaffRole.SUPER_ADMIN,
      passwordHash: adminHash,
    },
    {
      email: STAFF_EMAILS.demoStaff,
      name: "Demo Staff",
      role: StaffRole.OPS_MANAGER,
      passwordHash: demoHash,
    },
  ];

  for (const staff of loginable) {
    await db.staff.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        role: staff.role,
        passwordHash: staff.passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
      create: { ...staff, isActive: true, mustChangePassword: false },
    });
  }

  for (const staff of BACKGROUND_STAFF) {
    await db.staff.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        role: staff.role,
        passwordHash: null,
        isActive: true,
        mustChangePassword: false,
      },
      create: { ...staff, passwordHash: null, isActive: true, mustChangePassword: false },
    });
  }

  await db.staff.updateMany({
    where: {
      email: {
        in: RETIRED_STAFF_LOCAL_PARTS.map((p) => `${p}@${BRAND.emailDomain}`),
      },
    },
    data: { passwordHash: null, isActive: false },
  });

  logDone("staff members", loginable.length + BACKGROUND_STAFF.length);
  console.log("\n   Sign-in accounts:");
  for (const s of loginable) console.log(`   • ${s.email}  (${s.role})`);
}
