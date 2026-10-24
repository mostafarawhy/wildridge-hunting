// prisma/seed/01-catalog.seed.ts
// Catalog seed: categories, products, product images, product specs,
// accessories (products), accessory links.
//
// Upsert-safe: safe to re-run against an existing database.
// All Russian fields are null.

import { BRAND } from "../../lib/config/brand";
import { PrismaClient, NavGroup } from "../../app/generated/prisma/client";
import {
  toActionType,
  toPublishStatus,
  dec,
  decRequired,
  autoMetaTitle,
  autoMetaDesc,
  toSlug,
  productStorageKey,
  categoryStorageKey,
  log,
  logSection,
  logDone,
} from "./seed-utils";
import { slugFromName } from "../../lib/utils/slug";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface CategoryDef {
  nameEn: string;
  nameAr: string;
  slug: string;
  displayOrder: number;
  parentSlug?: string;
  imageFilename?: string;
  navGroup?: "RIFLES" | "OPTICS" | "ACCESSORIES" | "AMMO";
}

interface SpecDef {
  labelEn: string;
  labelAr: string;
  valueEn: string;
  valueAr: string;
  displayOrder: number;
}

interface ImageDef {
  filename: string;
  altEn: string;
  altAr: string;
  displayOrder: number;
}

interface ProductDef {
  sku: string;
  nameEn: string;
  nameAr: string;
  slugEn: string;
  brand: string;
  actionType: string;
  caliberMm?: number | null;
  descriptionEn?: string;
  descriptionAr?: string;
  categoryEn: string; // must match a CategoryDef.nameEn exactly
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  lowStockThreshold?: number;
  weightGrams?: number;
  requiresIdVerification: boolean;
  supportsAddons: boolean;
  b2bAvailable: boolean;
  minOrderQty?: number;
  maxOrderQty?: number;
  isNewArrival?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  publishStatus?: string;
  loyaltyOverride?: number | null;
  specs: SpecDef[];
  images: ImageDef[];
  accessorySkus?: string[]; // references ACCESSORIES sku
}

interface AccessoryDef {
  sku: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
// Slugs are fixed — they are the source of truth for routing.
// Order: top-level first, then subcategories (parent must exist before child).

const CATEGORIES: CategoryDef[] = [
  // ── Top-level ──────────────────────────────────────────────────────────────
  {
    nameEn: "Air Rifles",
    nameAr: "بنادق الهواء",
    slug: "air-rifles",
    displayOrder: 1,
    imageFilename: "cat-air-rifles.jpg",
    navGroup: "RIFLES",
  },
  {
    nameEn: "PCP Rifles",
    nameAr: "بنادق الهواء PCP",
    slug: "pcp-rifles",
    displayOrder: 2,
    imageFilename: "cat-pcp-rifles.jpg",
    navGroup: "RIFLES",
  },
  {
    nameEn: "CO2 Pistols",
    nameAr: "مسدسات الثاني أكسيد الكربون",
    slug: "co2-pistols",
    displayOrder: 3,
    imageFilename: "cat-co2-pistols.jpg",
    navGroup: "RIFLES",
  },
  {
    nameEn: "Optics",
    nameAr: "البصريات",
    slug: "optics",
    displayOrder: 4,
    imageFilename: "cat-optics.jpg",
    navGroup: "OPTICS",
  },
  {
    nameEn: "Pellets & Ammo",
    nameAr: "الرصاص والذخيرة",
    slug: "pellets-ammo",
    displayOrder: 5,
    imageFilename: "cat-ammo.jpg",
    navGroup: "AMMO",
  },
  {
    nameEn: "Accessories",
    nameAr: "الملحقات",
    slug: "accessories",
    displayOrder: 6,
    imageFilename: "cat-accessories.jpg",
    navGroup: "ACCESSORIES",
  },
  // ── Subcategories: Air Rifles ───────────────────────────────────────────────
  {
    nameEn: "Spring Piston",
    nameAr: "نابض مكبس",
    slug: "spring-piston",
    displayOrder: 1,
    parentSlug: "air-rifles",
    imageFilename: "cat-spring-piston.jpg",
  },
  {
    nameEn: "CO2 Air Rifles",
    nameAr: "بنادق هواء CO2",
    slug: "co2-air-rifles",
    displayOrder: 2,
    parentSlug: "air-rifles",
    imageFilename: "cat-co2-air-rifles.jpg",
  },
  // ── Subcategories: PCP Rifles ──────────────────────────────────────────────
  {
    nameEn: "Turkish PCP",
    nameAr: "PCP تركي",
    slug: "turkish-pcp",
    displayOrder: 1,
    parentSlug: "pcp-rifles",
    imageFilename: "cat-turkish-pcp.jpg",
  },
  {
    nameEn: "European PCP",
    nameAr: "PCP أوروبي",
    slug: "european-pcp",
    displayOrder: 2,
    parentSlug: "pcp-rifles",
    imageFilename: "cat-european-pcp.jpg",
  },
  // ── Subcategories: CO2 Pistols ─────────────────────────────────────────────
  {
    nameEn: "Capsule Pistols",
    nameAr: "مسدسات الكبسولة",
    slug: "capsule-pistols",
    displayOrder: 1,
    parentSlug: "co2-pistols",
    imageFilename: "cat-capsule-pistols.jpg",
  },
  // ── Subcategories: Optics ──────────────────────────────────────────────────
  {
    nameEn: "Scopes & Optics",
    nameAr: "المناظير والبصريات",
    slug: "scopes-optics",
    displayOrder: 1,
    parentSlug: "optics",
    imageFilename: "cat-scopes.jpg",
  },
  // ── Subcategories: Pellets & Ammo ──────────────────────────────────────────
  {
    nameEn: "Air Pellets",
    nameAr: "خردق الهواء",
    slug: "air-pellets",
    displayOrder: 1,
    parentSlug: "pellets-ammo",
    imageFilename: "cat-air-pellets.jpg",
  },
  {
    nameEn: "Sound Ammo",
    nameAr: "ذخيرة الصوت",
    slug: "sound-ammo",
    displayOrder: 2,
    parentSlug: "pellets-ammo",
    imageFilename: "cat-sound-ammo.jpg",
  },
  // ── Subcategories: Accessories ─────────────────────────────────────────────
  {
    nameEn: "Cases & Bags",
    nameAr: "حقائب وحافظات",
    slug: "cases-bags",
    displayOrder: 1,
    parentSlug: "accessories",
    imageFilename: "cat-cases-bags.jpg",
  },
  {
    nameEn: "Spare Parts",
    nameAr: "قطع الغيار",
    slug: "spare-parts",
    displayOrder: 2,
    parentSlug: "accessories",
    imageFilename: "cat-spare-parts.jpg",
  },
  {
    nameEn: "Knives",
    nameAr: "السكاكين",
    slug: "knives",
    displayOrder: 3,
    parentSlug: "accessories",
    imageFilename: "cat-knives.jpg",
  },
];

// ─── ACCESSORIES ──────────────────────────────────────────────────────────────

const ACCESSORIES: AccessoryDef[] = [
  // ADN-001 through ADN-010 (original)
  {
    sku: "ADN-001",
    nameEn: "4×32 Rifle Scope",
    nameAr: "منظار بندقية 4×32",
    descriptionEn:
      "Entry-level fixed-power scope with multi-coated lenses. Includes mounts.",
    price: 149,
    stockQuantity: 45,
  },
  {
    sku: "ADN-002",
    nameEn: "Red Dot Sight",
    nameAr: "مشعل النقطة الحمراء",
    descriptionEn:
      "Compact red dot with 3 MOA dot, 11 brightness levels, and quick-detach mount.",
    price: 189,
    compareAtPrice: 229,
    stockQuantity: 38,
  },
  {
    sku: "ADN-003",
    nameEn: "Tactical Flashlight",
    nameAr: "مصباح تكتيكي",
    descriptionEn:
      "1000-lumen rail-mounted flashlight with pressure switch. IPX6 waterproof.",
    price: 129,
    stockQuantity: 52,
  },
  {
    sku: "ADN-004",
    nameEn: "Adjustable Bipod",
    nameAr: "ثنائي القوائم القابل للتعديل",
    descriptionEn:
      "Adjustable bipod, 6–9 inch height range, swivel pan ±45°, quick detach.",
    price: 215,
    compareAtPrice: 259,
    stockQuantity: 30,
  },
  {
    sku: "ADN-005",
    nameEn: "Rifle Sling — Nylon",
    nameAr: "حمالة بندقية نايلون",
    descriptionEn:
      "Adjustable two-point nylon sling with swivel studs. Fits all standard sling mounts.",
    price: 55,
    stockQuantity: 80,
  },
  {
    sku: "ADN-006",
    nameEn: "Green Laser Sight",
    nameAr: "مشعل الليزر الأخضر",
    descriptionEn:
      "532nm green laser, visible up to 200m. Clamp-on rail mount, battery included.",
    price: 175,
    stockQuantity: 26,
  },
  {
    sku: "ADN-007",
    nameEn: "Pistol Laser Sight",
    nameAr: "مشعل ليزر للمسدس",
    descriptionEn:
      "Compact 650nm red laser with universal rail mount. Fits most CO2 pistols.",
    price: 95,
    stockQuantity: 40,
  },
  {
    sku: "ADN-008",
    nameEn: "Suppressor / Silencer (Fake)",
    nameAr: "كاتم الصوت (مظهري)",
    descriptionEn:
      'Cosmetic threaded suppressor. Reduces muzzle report by ~3dB. Fits 1/2" UNF threads.',
    price: 85,
    stockQuantity: 55,
  },
  {
    sku: "ADN-009",
    nameEn: "Scope Rings — High Profile",
    nameAr: "حلقات المنظار — ارتفاع عالٍ",
    descriptionEn:
      "30mm high-profile scope rings. CNC-machined aluminium, two-piece design.",
    price: 65,
    stockQuantity: 70,
  },
  {
    sku: "ADN-010",
    nameEn: "CO2 Cartridges — 12g (10-Pack)",
    nameAr: "خراطيش CO2 — 12 جرام (عبوة 10)",
    descriptionEn:
      "Standard 12g CO2 cartridges. Compatible with all standard CO2 pistols and rifles.",
    price: 45,
    stockQuantity: 200,
  },
  // ADN-011 through ADN-020 (new)
  {
    sku: "ADN-011",
    nameEn: "Gun Cleaning Kit — Universal",
    nameAr: "طقم تنظيف السلاح — شامل",
    descriptionEn:
      "17-piece universal cleaning kit: bore brushes, patches, rod, solvent, and storage pouch.",
    price: 75,
    stockQuantity: 90,
  },
  {
    sku: "ADN-012",
    nameEn: "Pellet Seating Tool",
    nameAr: "أداة تثبيت الرصاص",
    descriptionEn:
      "Brass pellet seater for consistent seating depth. Improves group sizes at 50m+.",
    price: 35,
    stockQuantity: 60,
  },
  {
    sku: "ADN-013",
    nameEn: "Spare Rotary Magazine — 14 Shot",
    nameAr: "مخزن دوار احتياطي — 14 طلقة",
    descriptionEn:
      "Genuine spare rotary magazine for select PCP rifles. 14-shot capacity, 4.5mm or 5.5mm.",
    price: 95,
    compareAtPrice: 115,
    stockQuantity: 35,
  },
  {
    sku: "ADN-014",
    nameEn: "Silicone Oil & Maintenance Kit",
    nameAr: "طقم صيانة بالزيت السيليكوني",
    descriptionEn:
      "100ml silicone oil bottle, O-ring grease, microfibre cloth. Extends seal life.",
    price: 42,
    stockQuantity: 110,
  },
  {
    sku: "ADN-015",
    nameEn: "Adjustable Cheek Rest",
    nameAr: "دعامة الخد القابلة للتعديل",
    descriptionEn:
      "Stick-on adjustable cheek rest. Raises cheek weld by 10–30mm. Fits most stocks.",
    price: 68,
    stockQuantity: 40,
  },
  {
    sku: "ADN-016",
    nameEn: "Paper Target Pack — 50 Targets",
    nameAr: "حزمة أهداف ورقية — 50 هدفاً",
    descriptionEn:
      "A4-sized precision target sheets. 10-ring bullseye with splash zones for easy scoring.",
    price: 22,
    stockQuantity: 150,
  },
  {
    sku: "ADN-017",
    nameEn: "Trigger Lock — Steel",
    nameAr: "قفل الزناد الفولاذي",
    descriptionEn:
      "Hardened steel trigger lock with two keys. UAE compliance for storage safety.",
    price: 38,
    stockQuantity: 75,
  },
  {
    sku: "ADN-018",
    nameEn: "Carry Handle — Tactical",
    nameAr: "مقبض الحمل التكتيكي",
    descriptionEn:
      "Foldable carry handle with integrated Picatinny rail segment. Polymer construction.",
    price: 55,
    stockQuantity: 45,
  },
  {
    sku: "ADN-019",
    nameEn: "Picatinny Rail Kit — 4-Piece",
    nameAr: "طقم سكة بيكاتيني — 4 قطع",
    descriptionEn:
      "Universal 4-piece Picatinny rail kit for adding accessory slots to smooth stocks.",
    price: 48,
    stockQuantity: 50,
  },
  {
    sku: "ADN-020",
    nameEn: 'Muzzle Thread Adapter — 1/2" UNF',
    nameAr: "محول خيط فوهة البندقية",
    descriptionEn:
      'Aluminium muzzle thread adapter. Converts M14x1 to 1/2" UNF for accessory fitting.',
    price: 30,
    stockQuantity: 65,
  },
];

// ─── HELPER: common spec builders ─────────────────────────────────────────────

function rifleBaseSpecs(opts: {
  caliber: string;
  caliberAr: string;
  action: string;
  actionAr: string;
  energy: string;
  barrelLen: string;
  overallLen: string;
  weight: string;
  stock: string;
  stockAr: string;
}): SpecDef[] {
  return [
    {
      labelEn: "Caliber",
      labelAr: "العيار",
      valueEn: opts.caliber,
      valueAr: opts.caliberAr,
      displayOrder: 1,
    },
    {
      labelEn: "Action Type",
      labelAr: "نوع الإجراء",
      valueEn: opts.action,
      valueAr: opts.actionAr,
      displayOrder: 2,
    },
    {
      labelEn: "Muzzle Energy",
      labelAr: "طاقة الفوهة",
      valueEn: opts.energy,
      valueAr: opts.energy,
      displayOrder: 3,
    },
    {
      labelEn: "Barrel Length",
      labelAr: "طول الماسورة",
      valueEn: opts.barrelLen,
      valueAr: opts.barrelLen,
      displayOrder: 4,
    },
    {
      labelEn: "Overall Length",
      labelAr: "الطول الكلي",
      valueEn: opts.overallLen,
      valueAr: opts.overallLen,
      displayOrder: 5,
    },
    {
      labelEn: "Weight",
      labelAr: "الوزن",
      valueEn: opts.weight,
      valueAr: opts.weight,
      displayOrder: 6,
    },
    {
      labelEn: "Stock Material",
      labelAr: "مادة الخزينة",
      valueEn: opts.stock,
      valueAr: opts.stockAr,
      displayOrder: 7,
    },
  ];
}

function pcpExtraSpecs(opts: {
  shots: string;
  pressure: string;
  cylVol?: string;
  magCap?: string;
}): SpecDef[] {
  const specs: SpecDef[] = [
    {
      labelEn: "Max Shots per Fill",
      labelAr: "الطلقات لكل شحن",
      valueEn: opts.shots,
      valueAr: opts.shots,
      displayOrder: 8,
    },
    {
      labelEn: "Max Fill Pressure",
      labelAr: "ضغط الشحن الأقصى",
      valueEn: opts.pressure,
      valueAr: opts.pressure,
      displayOrder: 9,
    },
  ];
  if (opts.cylVol)
    specs.push({
      labelEn: "Cylinder Volume",
      labelAr: "حجم الأسطوانة",
      valueEn: opts.cylVol,
      valueAr: opts.cylVol,
      displayOrder: 10,
    });
  if (opts.magCap)
    specs.push({
      labelEn: "Magazine Capacity",
      labelAr: "سعة المخزن",
      valueEn: opts.magCap,
      valueAr: opts.magCap,
      displayOrder: 11,
    });
  return specs;
}

function scopeSpecs(opts: {
  mag: string;
  obj: string;
  reticle: string;
  tube: string;
  waterproof: string;
}): SpecDef[] {
  return [
    {
      labelEn: "Magnification",
      labelAr: "التكبير",
      valueEn: opts.mag,
      valueAr: opts.mag,
      displayOrder: 1,
    },
    {
      labelEn: "Objective Diameter",
      labelAr: "قطر العدسة الأمامية",
      valueEn: opts.obj,
      valueAr: opts.obj,
      displayOrder: 2,
    },
    {
      labelEn: "Reticle Type",
      labelAr: "نوع الشبكة",
      valueEn: opts.reticle,
      valueAr: opts.reticle,
      displayOrder: 3,
    },
    {
      labelEn: "Tube Diameter",
      labelAr: "قطر الأنبوب",
      valueEn: opts.tube,
      valueAr: opts.tube,
      displayOrder: 4,
    },
    {
      labelEn: "Water Resistance",
      labelAr: "مقاومة الماء",
      valueEn: opts.waterproof,
      valueAr: opts.waterproof,
      displayOrder: 5,
    },
  ];
}

function pelletSpecs(opts: {
  caliber: string;
  type: string;
  typeAr: string;
  count: string;
  weight: string;
  material: string;
  materialAr: string;
}): SpecDef[] {
  return [
    {
      labelEn: "Caliber",
      labelAr: "العيار",
      valueEn: opts.caliber,
      valueAr: opts.caliber,
      displayOrder: 1,
    },
    {
      labelEn: "Shape / Type",
      labelAr: "الشكل / النوع",
      valueEn: opts.type,
      valueAr: opts.typeAr,
      displayOrder: 2,
    },
    {
      labelEn: "Count per Tin",
      labelAr: "العدد في العلبة",
      valueEn: opts.count,
      valueAr: opts.count,
      displayOrder: 3,
    },
    {
      labelEn: "Weight",
      labelAr: "الوزن",
      valueEn: opts.weight,
      valueAr: opts.weight,
      displayOrder: 4,
    },
    {
      labelEn: "Material",
      labelAr: "المادة",
      valueEn: opts.material,
      valueAr: opts.materialAr,
      displayOrder: 5,
    },
  ];
}

function pistolSpecs(opts: {
  caliber: string;
  action: string;
  actionAr: string;
  blowback: string;
  blowbackAr: string;
  capacity: string;
  length: string;
  weight: string;
}): SpecDef[] {
  return [
    {
      labelEn: "Caliber",
      labelAr: "العيار",
      valueEn: opts.caliber,
      valueAr: opts.caliber,
      displayOrder: 1,
    },
    {
      labelEn: "Action",
      labelAr: "الإجراء",
      valueEn: opts.action,
      valueAr: opts.actionAr,
      displayOrder: 2,
    },
    {
      labelEn: "Blowback",
      labelAr: "رجة الإطلاق",
      valueEn: opts.blowback,
      valueAr: opts.blowbackAr,
      displayOrder: 3,
    },
    {
      labelEn: "Magazine Capacity",
      labelAr: "سعة المخزن",
      valueEn: opts.capacity,
      valueAr: opts.capacity,
      displayOrder: 4,
    },
    {
      labelEn: "Overall Length",
      labelAr: "الطول الكلي",
      valueEn: opts.length,
      valueAr: opts.length,
      displayOrder: 5,
    },
    {
      labelEn: "Weight (unloaded)",
      labelAr: "الوزن (بدون ذخيرة)",
      valueEn: opts.weight,
      valueAr: opts.weight,
      displayOrder: 6,
    },
  ];
}

// Shorthand: accessory sets for different product types
const RIFLE_ACCESSORY_SKUS = [
  "ADN-001",
  "ADN-002",
  "ADN-003",
  "ADN-004",
  "ADN-005",
  "ADN-006",
  "ADN-008",
  "ADN-009",
  "ADN-011",
  "ADN-014",
  "ADN-015",
  "ADN-016",
  "ADN-017",
  "ADN-019",
  "ADN-020",
];
const PCP_ACCESSORY_SKUS = [...RIFLE_ACCESSORY_SKUS, "ADN-012", "ADN-013", "ADN-018"];
const PISTOL_ACCESSORY_SKUS = [
  "ADN-002",
  "ADN-003",
  "ADN-006",
  "ADN-007",
  "ADN-010",
  "ADN-011",
  "ADN-014",
  "ADN-016",
  "ADN-017",
];
const SCOPE_ACCESSORY_SKUS = ["ADN-009", "ADN-011"];
const AMMO_ACCESSORY_SKUS: string[] = [];
const ACCESSORY_ACCESSORY_SKUS = ["ADN-011", "ADN-014"];

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

const PRODUCTS: ProductDef[] = [
  // ════════════════════════════════════════════════════════════════════════════
  // AIR RIFLES — Spring Piston
  // categoryEn must be "Spring Piston" (subcategory) or "Air Rifles" (parent)
  // We use the subcategory so browsing works at both levels via parent joins.
  // ════════════════════════════════════════════════════════════════════════════

  {
    sku: "HLV-34-45",
    nameEn: "Halvard Ridgeline 34 Classic — .177",
    nameAr: "هالفارد ريدجلاين 34 كلاسيك — 4.5 ملم",
    slugEn: "halvard-ridgeline-34-classic-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "A straightforward entry-level spring rifle. Adjustable trigger, beech stock, and modest power that suits plinking and backyard practice.",
    descriptionAr:
      "بندقية نابضة بسيطة للمستوى المبتدئ. زناد قابل للضبط وخزينة من خشب الزان وقوة معتدلة تناسب التدريب والرماية الترفيهية.",
    categoryEn: "Spring Piston",
    price: 520,
    compareAtPrice: 580,
    stockQuantity: 18,
    lowStockThreshold: 5,
    weightGrams: 3800,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    isFeatured: true,
    sortOrder: 10,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "Spring Piston",
        actionAr: "نابض مكبس",
        energy: "16 J",
        barrelLen: "480mm",
        overallLen: "1120mm",
        weight: "3.8 kg",
        stock: "Beech Wood",
        stockAr: "خشب الزان",
      }),
    ],
    images: [
      {
        filename: "hlv-34-45-01.jpg",
        altEn: "Halvard Ridgeline 34 Classic .177 — right profile",
        altAr: "هالفارد ريدجلاين 34 كلاسيك 4.5 ملم",
        displayOrder: 1,
      },
      {
        filename: "hlv-34-45-02.jpg",
        altEn: "Halvard Ridgeline 34 Classic .177 — stock detail",
        altAr: "تفاصيل هالفارد ريدجلاين 34 كلاسيك 4.5 ملم",
        displayOrder: 2,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-48-55",
    nameEn: "Halvard Ridgeline 48 SideLever — .22",
    nameAr: "هالفارد ريدجلاين 48 رافعة جانبية — 5.5 ملم",
    slugEn: "halvard-ridgeline-48-sidelever-22",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 5.5,
    descriptionEn:
      "Side-lever action delivers smooth cocking and a solid 24J muzzle energy. Anti-beartrap safety, adjustable trigger, and ambidextrous beech stock.",
    descriptionAr:
      "الرافعة الجانبية توفر شحنًا سلسًا وطاقة فوهة ثابتة 24 جول. أمان مانع للإطلاق العرضي وزناد قابل للضبط وخزينة من خشب الزان.",
    categoryEn: "Spring Piston",
    price: 850,
    stockQuantity: 8,
    lowStockThreshold: 3,
    weightGrams: 4200,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isFeatured: false,
    isNewArrival: true,
    sortOrder: 20,
    specs: rifleBaseSpecs({
      caliber: ".22 (5.5mm)",
      caliberAr: "5.5 ملم",
      action: "Spring Piston",
      actionAr: "نابض مكبس",
      energy: "24 J",
      barrelLen: "500mm",
      overallLen: "1160mm",
      weight: "4.2 kg",
      stock: "Beech Wood",
      stockAr: "خشب الزان",
    }),
    images: [
      {
        filename: "hlv-48-55-01.jpg",
        altEn: "Halvard Ridgeline 48 SideLever .22 — right profile",
        altAr: "هالفارد ريدجلاين 48 رافعة جانبية 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-54-45",
    nameEn: "Halvard Driftmaster 54 — .177",
    nameAr: "هالفارد دريفتماستر 54 — 4.5 ملم",
    slugEn: "halvard-driftmaster-54-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "The recoilless Driftmaster 54 uses a free-floating action in a sliding stock. Exceptional accuracy for benchrest and field target shooting.",
    descriptionAr:
      "تعتمد دريفتماستر 54 على آلية حرة الحركة داخل خزينة منزلقة تلغي الارتداد، فتمنحك دقة استثنائية في الرماية على المقعد والأهداف الميدانية.",
    categoryEn: "Spring Piston",
    price: 1380,
    compareAtPrice: 1500,
    stockQuantity: 5,
    lowStockThreshold: 3,
    weightGrams: 4600,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    isFeatured: false,
    sortOrder: 30,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Spring Piston (Recoilless)",
      actionAr: "نابض مكبس بلا ارتداد",
      energy: "17 J",
      barrelLen: "540mm",
      overallLen: "1200mm",
      weight: "4.6 kg",
      stock: "Walnut",
      stockAr: "خشب الجوز",
    }),
    images: [
      {
        filename: "hlv-54-45-01.jpg",
        altEn: "Halvard Driftmaster 54 .177 — right profile",
        altAr: "هالفارد دريفتماستر 54 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-GLE95-45",
    nameEn: "Brightfell Gale 95 — .177",
    nameAr: "برايتفل غيل 95 — 4.5 ملم",
    slugEn: "brightfell-gale-95-177",
    brand: "Brightfell",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "Gas-piston spring rifle with a walnut-finish stock, adjustable trigger, and anti-shock absorbers for a smooth shot cycle.",
    descriptionAr:
      "بندقية نابضة بمكبس غازي وخزينة بتشطيب الجوز وزناد قابل للضبط وماصات صدمات لدورة إطلاق سلسة.",
    categoryEn: "Spring Piston",
    price: 680,
    compareAtPrice: 750,
    stockQuantity: 14,
    weightGrams: 3600,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    sortOrder: 40,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Gas Piston",
      actionAr: "مكبس غاز",
      energy: "20 J",
      barrelLen: "460mm",
      overallLen: "1100mm",
      weight: "3.6 kg",
      stock: "Turkish Walnut",
      stockAr: "جوز تركي",
    }),
    images: [
      {
        filename: "brf-gle95-45-01.jpg",
        altEn: "Brightfell Gale 95 .177 — right profile",
        altAr: "برايتفل غيل 95 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-GLE125-55",
    nameEn: "Brightfell Gale 125 Marksman — .22",
    nameAr: "برايتفل غيل 125 ماركسمان — 5.5 ملم",
    slugEn: "brightfell-gale-125-marksman-22",
    brand: "Brightfell",
    actionType: "Spring",
    caliberMm: 5.5,
    descriptionEn:
      "Full-power .22 break-barrel with thumbhole polymer stock. 30J muzzle energy. Adjustable trigger and integrated anti-shock absorbers.",
    descriptionAr:
      "بندقية 5.5 ملم كاملة القوة بماسورة كسرية وخزينة بوليمر بفتحة إبهام. طاقة فوهة 30 جول. زناد قابل للضبط وماصات صدمات مدمجة.",
    categoryEn: "Spring Piston",
    price: 780,
    stockQuantity: 3,
    lowStockThreshold: 3,
    weightGrams: 4100,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: true,
    sortOrder: 50,
    specs: rifleBaseSpecs({
      caliber: ".22 (5.5mm)",
      caliberAr: "5.5 ملم",
      action: "Spring Piston",
      actionAr: "نابض مكبس",
      energy: "30 J",
      barrelLen: "500mm",
      overallLen: "1250mm",
      weight: "4.1 kg",
      stock: "Polymer Thumbhole",
      stockAr: "بوليمر بفتحة إبهام",
    }),
    images: [
      {
        filename: "brf-gle125-55-01.jpg",
        altEn: "Brightfell Gale 125 Marksman .22 — right profile",
        altAr: "برايتفل غيل 125 ماركسمان 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-RNG-45",
    nameEn: "Halvard Ranger 1000 — .177",
    nameAr: "هالفارد رينجر 1000 — 4.5 ملم",
    slugEn: "halvard-ranger-1000-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "Break-barrel spring rifle with a synthetic ambidextrous stock. Smooth trigger, fiber-optic sights, and comfortable grip.",
    descriptionAr:
      "بندقية نابضة بماسورة كسرية وخزينة صناعية تناسب الجنسين. زناد سلس ومشاعل بالألياف البصرية ومقبض مريح.",
    categoryEn: "Spring Piston",
    price: 420,
    stockQuantity: 22,
    weightGrams: 2800,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: false,
    sortOrder: 60,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Spring Piston",
      actionAr: "نابض مكبس",
      energy: "19.9 J",
      barrelLen: "460mm",
      overallLen: "1130mm",
      weight: "2.8 kg",
      stock: "Synthetic",
      stockAr: "مصطنع",
    }),
    images: [
      {
        filename: "hlv-rng-45-01.jpg",
        altEn: "Halvard Ranger 1000 .177 — right profile",
        altAr: "هالفارد رينجر 1000 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-KST50-45",
    nameEn: "Halvard Kestrel 50S — .177",
    nameAr: "هالفارد كيستريل 50S — 4.5 ملم",
    slugEn: "halvard-kestrel-50s-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "A benchmark for build quality. Crisp adjustable trigger, rifled barrel, and superb factory fit and finish. The choice of serious field target shooters.",
    descriptionAr:
      "معيار في جودة التصنيع. زناد دقيق قابل للضبط وماسورة مسدّسة وتشطيب مصنعي ممتاز. خيار رماة الأهداف الميدانية الجادين.",
    categoryEn: "Spring Piston",
    price: 1150,
    stockQuantity: 6,
    lowStockThreshold: 3,
    weightGrams: 3700,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isFeatured: false,
    isNewArrival: false,
    sortOrder: 70,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Spring Piston",
      actionAr: "نابض مكبس",
      energy: "16 J",
      barrelLen: "470mm",
      overallLen: "1105mm",
      weight: "3.7 kg",
      stock: "Beech Wood",
      stockAr: "خشب الزان",
    }),
    images: [
      {
        filename: "hlv-kst50-45-01.jpg",
        altEn: "Halvard Kestrel 50S .177 — right profile",
        altAr: "هالفارد كيستريل 50S 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-KST80-55",
    nameEn: "Halvard Kestrel 80 — .22",
    nameAr: "هالفارد كيستريل 80 — 5.5 ملم",
    slugEn: "halvard-kestrel-80-22",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 5.5,
    descriptionEn:
      "One of the best-balanced spring rifles in the range. Crisp adjustable trigger, 24J energy, and a superbly balanced handling experience.",
    descriptionAr:
      "من أكثر البنادق النابضة توازنًا في التشكيلة. زناد دقيق قابل للضبط وطاقة 24 جول وإحساس ممتاز عند الحمل.",
    categoryEn: "Spring Piston",
    price: 1280,
    stockQuantity: 4,
    lowStockThreshold: 3,
    weightGrams: 4000,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    sortOrder: 80,
    specs: rifleBaseSpecs({
      caliber: ".22 (5.5mm)",
      caliberAr: "5.5 ملم",
      action: "Spring Piston",
      actionAr: "نابض مكبس",
      energy: "24 J",
      barrelLen: "500mm",
      overallLen: "1160mm",
      weight: "4.0 kg",
      stock: "Beech Wood",
      stockAr: "خشب الزان",
    }),
    images: [
      {
        filename: "hlv-kst80-55-01.jpg",
        altEn: "Halvard Kestrel 80 .22 — right profile",
        altAr: "هالفارد كيستريل 80 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-KST97-45",
    nameEn: "Halvard Kestrel 97K — .177",
    nameAr: "هالفارد كيستريل 97K — 4.5 ملم",
    slugEn: "halvard-kestrel-97k-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "Under-lever fixed-barrel rifle. Recoilless fixed barrel for outstanding accuracy potential and a crisp adjustable trigger. A field target favourite.",
    descriptionAr:
      "بندقية برافعة سفلية وماسورة ثابتة بلا ارتداد لدقة استثنائية، مع زناد دقيق قابل للضبط. مفضلة لدى رماة الأهداف الميدانية.",
    categoryEn: "Spring Piston",
    price: 1650,
    compareAtPrice: 1800,
    stockQuantity: 0,
    lowStockThreshold: 3,
    weightGrams: 4200,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: true,
    sortOrder: 90,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Spring Piston (Under-lever)",
      actionAr: "نابض مكبس برافعة سفلية",
      energy: "16 J",
      barrelLen: "390mm",
      overallLen: "1090mm",
      weight: "4.2 kg",
      stock: "Beech Wood",
      stockAr: "خشب الزان",
    }),
    images: [
      {
        filename: "hlv-kst97-45-01.jpg",
        altEn: "Halvard Kestrel 97K .177 — right profile",
        altAr: "هالفارد كيستريل 97K 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-SKY-45",
    nameEn: "Halvard Skylark SE — .177",
    nameAr: "هالفارد سكايلارك SE — 4.5 ملم",
    slugEn: "halvard-skylark-se-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "Break-barrel spring rifle with a two-stage trigger. Compact and lightweight for field use.",
    descriptionAr:
      "بندقية نابضة بماسورة كسرية وزناد ثنائي المراحل. مضغوطة وخفيفة الوزن للاستخدام الميداني.",
    categoryEn: "Spring Piston",
    price: 480,
    stockQuantity: 12,
    weightGrams: 2650,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: false,
    sortOrder: 100,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Spring Piston",
      actionAr: "نابض مكبس",
      energy: "17 J",
      barrelLen: "450mm",
      overallLen: "1060mm",
      weight: "2.65 kg",
      stock: "Beech Wood",
      stockAr: "خشب الزان",
    }),
    images: [
      {
        filename: "hlv-sky-45-01.jpg",
        altEn: "Halvard Skylark SE .177 — right profile",
        altAr: "هالفارد سكايلارك SE 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  // ── CO2 Air Rifles ──────────────────────────────────────────────────────────

  {
    sku: "TRV-RPT8-45",
    nameEn: "Torvane R8 Repeater — .177",
    nameAr: "تورفين R8 ريبيتر — 4.5 ملم",
    slugEn: "torvane-r8-repeater-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Semi-automatic CO2 rifle with 8-round rotary magazine. 88g CO2 capsule gives ~100 shots. Picatinny top rail.",
    descriptionAr:
      "بندقية CO2 شبه أوتوماتيكية بمخزن دوار 8 طلقات. كبسولة CO2 بوزن 88 جرامًا تعطي نحو 100 طلقة. سكة بيكاتيني علوية.",
    categoryEn: "CO2 Air Rifles",
    price: 680,
    stockQuantity: 9,
    weightGrams: 2800,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    sortOrder: 110,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "CO2",
        actionAr: "CO2",
        energy: "7.5 J",
        barrelLen: "600mm",
        overallLen: "1140mm",
        weight: "2.8 kg",
        stock: "Synthetic",
        stockAr: "مصطنع",
      }),
      {
        labelEn: "CO2 Source",
        labelAr: "مصدر CO2",
        valueEn: "88g AirSource cartridge",
        valueAr: "خرطوشة AirSource 88 جرام",
        displayOrder: 8,
      },
      {
        labelEn: "Magazine Capacity",
        labelAr: "سعة المخزن",
        valueEn: "8 rounds",
        valueAr: "8 طلقات",
        displayOrder: 9,
      },
    ],
    images: [
      {
        filename: "trv-rpt8-45-01.jpg",
        altEn: "Torvane R8 Repeater .177 — right profile",
        altAr: "تورفين R8 ريبيتر 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // PCP RIFLES — Turkish PCP
  // ════════════════════════════════════════════════════════════════════════════

  {
    sku: "BRF-EMB-N1-45",
    nameEn: "Brightfell Ember N1 — .177",
    nameAr: "برايتفل إمبر N1 — 4.5 ملم",
    slugEn: "brightfell-ember-n1-177",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 4.5,
    descriptionEn:
      "PCP with a 14-round rotary magazine. Adjustable two-stage trigger, Picatinny rail, and 200cc cylinder for ~100 shots per fill.",
    descriptionAr:
      "بندقية PCP بمخزن دوار 14 طلقة. زناد ثنائي المراحل قابل للضبط وسكة بيكاتيني وأسطوانة 200 سس لنحو 100 طلقة لكل تعبئة.",
    categoryEn: "Turkish PCP",
    price: 1650,
    compareAtPrice: 1850,
    stockQuantity: 11,
    lowStockThreshold: 5,
    weightGrams: 3000,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    isFeatured: true,
    sortOrder: 200,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "25 J",
        barrelLen: "550mm",
        overallLen: "1130mm",
        weight: "3.0 kg",
        stock: "Turkish Walnut",
        stockAr: "جوز تركي",
      }),
      ...pcpExtraSpecs({
        shots: "~100 shots",
        pressure: "200 bar",
        cylVol: "200 cc",
        magCap: "14 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-emb-n1-45-01.jpg",
        altEn: "Brightfell Ember N1 .177 — right profile",
        altAr: "برايتفل إمبر N1 4.5 ملم",
        displayOrder: 1,
      },
      {
        filename: "brf-emb-n1-45-02.jpg",
        altEn: "Brightfell Ember N1 .177 — magazine detail",
        altAr: "تفاصيل برايتفل إمبر N1 4.5 ملم",
        displayOrder: 2,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-EMB-FD-55",
    nameEn: "Brightfell Ember Folder — .22",
    nameAr: "برايتفل إمبر فولدر — 5.5 ملم",
    slugEn: "brightfell-ember-folder-22",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 5.5,
    descriptionEn:
      "Folding-stock bullpup PCP with 14-shot magazine. Compact 680mm overall length. Built-in manometer and bottle-in-stock design.",
    descriptionAr:
      "بندقية PCP بولبوب بخزينة قابلة للطي ومخزن 14 طلقة. طول كلي مضغوط 680 ملم. مقياس ضغط مدمج وأسطوانة داخل الخزينة.",
    categoryEn: "Turkish PCP",
    price: 2200,
    stockQuantity: 7,
    lowStockThreshold: 3,
    weightGrams: 2850,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: true,
    sortOrder: 210,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".22 (5.5mm)",
        caliberAr: "5.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "45 J",
        barrelLen: "460mm",
        overallLen: "680mm",
        weight: "2.85 kg",
        stock: "Polymer Folding",
        stockAr: "بوليمر قابل للطي",
      }),
      ...pcpExtraSpecs({
        shots: "~80 shots",
        pressure: "250 bar",
        cylVol: "280 cc",
        magCap: "14 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-emb-fd-55-01.jpg",
        altEn: "Brightfell Ember Folder .22 — right profile",
        altAr: "برايتفل إمبر فولدر 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-BPB65-55",
    nameEn: "Brightfell Bullpup B65 — .22",
    nameAr: "برايتفل بولبوب B65 — 5.5 ملم",
    slugEn: "brightfell-bullpup-b65-22",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 5.5,
    descriptionEn:
      "Bullpup PCP with an adjustable trigger and anti-double-feed mechanism. Integrated regulator for shot-to-shot consistency.",
    descriptionAr: "بندقية PCP بتصميم بولبوب وزناد قابل للضبط وآلية تمنع التغذية المزدوجة. منظّم مدمج لثبات الطلقات.",
    categoryEn: "Turkish PCP",
    price: 2450,
    compareAtPrice: 2700,
    stockQuantity: 5,
    lowStockThreshold: 3,
    weightGrams: 3400,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    sortOrder: 220,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".22 (5.5mm)",
        caliberAr: "5.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "55 J",
        barrelLen: "520mm",
        overallLen: "870mm",
        weight: "3.4 kg",
        stock: "Polymer Bullpup",
        stockAr: "بوليمر بولبوب",
      }),
      ...pcpExtraSpecs({
        shots: "~90 shots",
        pressure: "250 bar",
        cylVol: "350 cc",
        magCap: "10 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-bpb65-55-01.jpg",
        altEn: "Brightfell Bullpup B65 .22 — right profile",
        altAr: "برايتفل بولبوب B65 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-FLR-635",
    nameEn: "Brightfell Flare Quiet — .25",
    nameAr: "برايتفل فلير كوايت — 6.35 ملم",
    slugEn: "brightfell-flare-quiet-25",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 6.35,
    descriptionEn:
      "High-power .25 caliber PCP with a built-in moderator. 14-round magazine. Ideal for pest control at extended ranges.",
    descriptionAr:
      "بندقية PCP عالية القوة بعيار 6.35 ملم مع مخفّض صوت مدمج. مخزن 14 طلقة. مثالية لمكافحة الآفات على مسافات بعيدة.",
    categoryEn: "Turkish PCP",
    price: 2850,
    stockQuantity: 4,
    lowStockThreshold: 3,
    weightGrams: 3100,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    sortOrder: 230,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".25 (6.35mm)",
        caliberAr: "6.35 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "80 J",
        barrelLen: "540mm",
        overallLen: "1080mm",
        weight: "3.1 kg",
        stock: "Walnut",
        stockAr: "خشب الجوز",
      }),
      ...pcpExtraSpecs({
        shots: "~60 shots",
        pressure: "250 bar",
        cylVol: "280 cc",
        magCap: "14 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-flr-635-01.jpg",
        altEn: "Brightfell Flare Quiet .25 — right profile",
        altAr: "برايتفل فلير كوايت 6.35 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  // ── European PCP ─────────────────────────────────────────────────────────────

  {
    sku: "BRF-SUM5-45",
    nameEn: "Brightfell Summit 5 Sporter — .177",
    nameAr: "برايتفل سَميت 5 سبورتر — 4.5 ملم",
    slugEn: "brightfell-summit-5-sporter-177",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 4.5,
    descriptionEn:
      "Regulated PCP built for consistency. Two-stage adjustable trigger, regulated air supply, 10-shot magazine. Exceptional pellet-to-pellet consistency.",
    descriptionAr:
      "بندقية PCP منظّمة صُنعت للثبات. زناد ثنائي المراحل قابل للضبط وإمداد هواء منظّم ومخزن 10 طلقات. ثبات ممتاز بين الرصاصة والأخرى.",
    categoryEn: "European PCP",
    price: 4800,
    compareAtPrice: 5200,
    stockQuantity: 3,
    lowStockThreshold: 3,
    weightGrams: 3400,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isFeatured: true,
    isNewArrival: false,
    sortOrder: 300,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "22 J",
        barrelLen: "510mm",
        overallLen: "1100mm",
        weight: "3.4 kg",
        stock: "Walnut",
        stockAr: "خشب الجوز",
      }),
      ...pcpExtraSpecs({
        shots: "~120 shots",
        pressure: "230 bar",
        cylVol: "480 cc",
        magCap: "10 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-sum5-45-01.jpg",
        altEn: "Brightfell Summit 5 Sporter .177 — right profile",
        altAr: "برايتفل سَميت 5 سبورتر 4.5 ملم",
        displayOrder: 1,
      },
      {
        filename: "brf-sum5-45-02.jpg",
        altEn: "Brightfell Summit 5 Sporter .177 — stock detail",
        altAr: "تفاصيل برايتفل سَميت 5 سبورتر 4.5 ملم",
        displayOrder: 2,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-SUL-45",
    nameEn: "Brightfell Summit Underlever — .177",
    nameAr: "برايتفل سَميت أندرليفر — 4.5 ملم",
    slugEn: "brightfell-summit-underlever-177",
    brand: "Brightfell",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "Under-lever spring rifle with fixed-barrel accuracy, a two-stage trigger, and a beech stock. A field target contender.",
    descriptionAr:
      "بندقية نابضة برافعة سفلية بدقة الماسورة الثابتة وزناد ثنائي المراحل وخزينة من خشب الزان. منافس قوي في الأهداف الميدانية.",
    categoryEn: "European PCP",
    price: 3200,
    stockQuantity: 2,
    lowStockThreshold: 3,
    weightGrams: 4600,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    sortOrder: 310,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Spring Piston (Under-lever)",
      actionAr: "نابض مكبس برافعة سفلية",
      energy: "16 J",
      barrelLen: "390mm",
      overallLen: "1085mm",
      weight: "4.6 kg",
      stock: "Beech Wood",
      stockAr: "خشب الزان",
    }),
    images: [
      {
        filename: "brf-sul-45-01.jpg",
        altEn: "Brightfell Summit Underlever .177 — right profile",
        altAr: "برايتفل سَميت أندرليفر 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-KST100-55",
    nameEn: "Halvard Kestrel 100S — .22",
    nameAr: "هالفارد كيستريل 100S — 5.5 ملم",
    slugEn: "halvard-kestrel-100s-22",
    brand: "Halvard Arms",
    actionType: "PCP",
    caliberMm: 5.5,
    descriptionEn:
      "Side-lever PCP with a 10-round magazine and regulated air supply. Exceptional build quality and shot-count consistency.",
    descriptionAr: "بندقية PCP برافعة جانبية ومخزن 10 طلقات وإمداد هواء منظّم. جودة تصنيع استثنائية وثبات في عدد الطلقات.",
    categoryEn: "European PCP",
    price: 5800,
    stockQuantity: 2,
    lowStockThreshold: 3,
    weightGrams: 3800,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: true,
    sortOrder: 320,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".22 (5.5mm)",
        caliberAr: "5.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "35 J",
        barrelLen: "580mm",
        overallLen: "1140mm",
        weight: "3.8 kg",
        stock: "Walnut",
        stockAr: "خشب الجوز",
      }),
      ...pcpExtraSpecs({
        shots: "~100 shots",
        pressure: "300 bar",
        cylVol: "480 cc",
        magCap: "10 rounds",
      }),
    ],
    images: [
      {
        filename: "hlv-kst100-55-01.jpg",
        altEn: "Halvard Kestrel 100S .22 — right profile",
        altAr: "هالفارد كيستريل 100S 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-VEC-M3-55",
    nameEn: "Brightfell Vector M3 — .22",
    nameAr: "برايتفل فيكتور M3 — 5.5 ملم",
    slugEn: "brightfell-vector-m3-22",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 5.5,
    descriptionEn:
      "Modular PCP. Adjustable power, smooth twist barrel, plenum kit, and 18-shot magazine. A benchmark for high-end PCP performance.",
    descriptionAr:
      "بندقية PCP معيارية. طاقة قابلة للضبط وماسورة ملتوية ناعمة ومجموعة بلينوم ومخزن 18 طلقة. معيار لأداء PCP الراقي.",
    categoryEn: "European PCP",
    price: 7800,
    compareAtPrice: 8500,
    stockQuantity: 1,
    lowStockThreshold: 3,
    weightGrams: 3200,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isFeatured: false,
    isNewArrival: true,
    sortOrder: 330,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".22 (5.5mm)",
        caliberAr: "5.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "60 J (max)",
        barrelLen: "600mm",
        overallLen: "1100mm",
        weight: "3.2 kg",
        stock: "Laminate",
        stockAr: "خشب مضغوط",
      }),
      ...pcpExtraSpecs({
        shots: "~60–120 shots",
        pressure: "250 bar",
        cylVol: "480 cc",
        magCap: "18 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-vec-m3-55-01.jpg",
        altEn: "Brightfell Vector M3 .22 — right profile",
        altAr: "برايتفل فيكتور M3 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-SKP-45",
    nameEn: "Halvard Skylark PCP SE — .177",
    nameAr: "هالفارد سكايلارك PCP SE — 4.5 ملم",
    slugEn: "halvard-skylark-pcp-se-177",
    brand: "Halvard Arms",
    actionType: "PCP",
    caliberMm: 4.5,
    descriptionEn:
      "PCP with regulated air supply and side-lever bolt. 10-shot magazine, walnut stock, and a two-stage trigger.",
    descriptionAr:
      "بندقية PCP بإمداد هواء منظّم وترباس جانبي. مخزن 10 طلقات وخزينة من خشب الجوز وزناد ثنائي المراحل.",
    categoryEn: "European PCP",
    price: 3950,
    stockQuantity: 3,
    lowStockThreshold: 3,
    weightGrams: 3300,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    sortOrder: 340,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "22 J",
        barrelLen: "480mm",
        overallLen: "1080mm",
        weight: "3.3 kg",
        stock: "Walnut",
        stockAr: "خشب الجوز",
      }),
      ...pcpExtraSpecs({
        shots: "~110 shots",
        pressure: "230 bar",
        cylVol: "480 cc",
        magCap: "10 rounds",
      }),
    ],
    images: [
      {
        filename: "hlv-skp-45-01.jpg",
        altEn: "Halvard Skylark PCP SE .177 — right profile",
        altAr: "هالفارد سكايلارك PCP SE 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CO2 PISTOLS
  // ════════════════════════════════════════════════════════════════════════════

  {
    sku: "TRV-TB9-45",
    nameEn: "Torvane TB-9 Blowback — .177",
    nameAr: "تورفين TB-9 بلو باك — 4.5 ملم",
    slugEn: "torvane-tb9-blowback-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Blowback CO2 pistol with an 8-round rotary magazine, realistic steel slide, and accurate single/double action.",
    descriptionAr:
      "مسدس CO2 بارتداد خلفي ومخزن دوار 8 طلقات وشريحة فولاذية واقعية وإطلاق دقيق أحادي ومزدوج الفعل.",
    categoryEn: "CO2 Pistols",
    price: 485,
    compareAtPrice: 540,
    stockQuantity: 16,
    weightGrams: 700,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: false,
    isFeatured: true,
    sortOrder: 400,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA/DA",
      actionAr: "فردي/مزدوج",
      blowback: "Yes",
      blowbackAr: "نعم",
      capacity: "8 rounds",
      length: "190mm",
      weight: "700g",
    }),
    images: [
      {
        filename: "trv-tb9-45-01.jpg",
        altEn: "Torvane TB-9 Blowback .177 — right profile",
        altAr: "تورفين TB-9 بلو باك 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-PKT-45",
    nameEn: "Torvane Pocket Classic — .177",
    nameAr: "تورفين بوكيت كلاسيك — 4.5 ملم",
    slugEn: "torvane-pocket-classic-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Compact classic profile in CO2. Die-cast zinc slide, 6-round rotary magazine. No blowback — smooth and accurate. Ideal for target practice.",
    descriptionAr:
      "تصميم كلاسيكي مضغوط بتقنية CO2. شريحة زنك مصبوب ومخزن دوار 6 طلقات. بلا ارتداد خلفي — سلس ودقيق. مثالي للتدريب على الأهداف.",
    categoryEn: "Capsule Pistols",
    price: 320,
    stockQuantity: 25,
    weightGrams: 590,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    sortOrder: 410,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA/DA",
      actionAr: "فردي/مزدوج",
      blowback: "No",
      blowbackAr: "لا",
      capacity: "6 rounds",
      length: "155mm",
      weight: "590g",
    }),
    images: [
      {
        filename: "trv-pkt-45-01.jpg",
        altEn: "Torvane Pocket Classic .177 — right profile",
        altAr: "تورفين بوكيت كلاسيك 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-DTY-45",
    nameEn: "Torvane Duty Full-Size — .177",
    nameAr: "تورفين ديوتي فول سايز — 4.5 ملم",
    slugEn: "torvane-duty-full-size-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Full-size CO2 pistol with metal slide blowback and an 18-round magazine (2×12g CO2). A realistic feel for serious target practice.",
    descriptionAr:
      "مسدس CO2 كامل الحجم بشريحة معدنية وارتداد خلفي ومخزن 18 طلقة (2×12 جرام CO2). إحساس واقعي للتدريب الجاد على الأهداف.",
    categoryEn: "CO2 Pistols",
    price: 620,
    stockQuantity: 10,
    lowStockThreshold: 5,
    weightGrams: 950,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: false,
    sortOrder: 420,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA/DA",
      actionAr: "فردي/مزدوج",
      blowback: "Yes (full metal)",
      blowbackAr: "نعم (معدن كامل)",
      capacity: "18 rounds",
      length: "217mm",
      weight: "950g",
    }),
    images: [
      {
        filename: "trv-dty-45-01.jpg",
        altEn: "Torvane Duty Full-Size .177 — right profile",
        altAr: "تورفين ديوتي فول سايز 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-MTX-45",
    nameEn: "Torvane Match X — .177",
    nameAr: "تورفين ماتش X — 4.5 ملم",
    slugEn: "torvane-match-x-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Blowback CO2 pistol in a competition-style layout. Full metal construction and a 20-round magazine.",
    descriptionAr:
      "مسدس CO2 بارتداد خلفي وتصميم على طراز المسابقات. بناء معدني كامل ومخزن 20 طلقة.",
    categoryEn: "CO2 Pistols",
    price: 695,
    compareAtPrice: 750,
    stockQuantity: 8,
    lowStockThreshold: 3,
    weightGrams: 1000,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: true,
    sortOrder: 430,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA",
      actionAr: "فردي",
      blowback: "Yes (full metal)",
      blowbackAr: "نعم (معدن كامل)",
      capacity: "20 rounds",
      length: "224mm",
      weight: "1000g",
    }),
    images: [
      {
        filename: "trv-mtx-45-01.jpg",
        altEn: "Torvane Match X .177 — right profile",
        altAr: "تورفين ماتش X 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-CMP18-45",
    nameEn: "Torvane Compact 18 — .177",
    nameAr: "تورفين كومباكت 18 — 4.5 ملم",
    slugEn: "torvane-compact-18-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Full-size metal slide blowback CO2 pistol with an 18-round drop-free polymer magazine. Accurate and easy to handle.",
    descriptionAr:
      "مسدس CO2 بشريحة معدنية كاملة الحجم وارتداد خلفي ومخزن بوليمر 18 طلقة. دقيق وسهل الاستخدام.",
    categoryEn: "CO2 Pistols",
    price: 580,
    stockQuantity: 14,
    weightGrams: 850,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: false,
    sortOrder: 440,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA",
      actionAr: "فردي",
      blowback: "Yes (full metal)",
      blowbackAr: "نعم (معدن كامل)",
      capacity: "18 rounds",
      length: "202mm",
      weight: "850g",
    }),
    images: [
      {
        filename: "trv-cmp18-45-01.jpg",
        altEn: "Torvane Compact 18 .177 — right profile",
        altAr: "تورفين كومباكت 18 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-RVL6-45",
    nameEn: "Torvane Revolver 6\" — .177",
    nameAr: "تورفين ريفولفر 6\" — 4.5 ملم",
    slugEn: "torvane-revolver-6-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Classic-style revolver in CO2. 6\" barrel, 6-round shell-ejecting pellet cylinder, metal construction with blued finish.",
    descriptionAr:
      "مسدس دوار بطراز كلاسيكي بتقنية CO2. ماسورة 6\" وأسطوانة دوارة 6 طلقات بخراطيش قابلة للقذف وبناء معدني بتشطيب أزرق.",
    categoryEn: "Capsule Pistols",
    price: 420,
    stockQuantity: 0,
    lowStockThreshold: 3,
    weightGrams: 1200,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: false,
    sortOrder: 450,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA/DA Revolver",
      actionAr: "مسدس دوار فردي/مزدوج",
      blowback: "No",
      blowbackAr: "لا",
      capacity: "6 rounds (shell)",
      length: "305mm",
      weight: "1200g",
    }),
    images: [
      {
        filename: "trv-rvl6-45-01.jpg",
        altEn: "Torvane Revolver 6\" .177 — right profile",
        altAr: "تورفين ريفولفر 6\" 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-P16-45",
    nameEn: "Torvane Polymer 16 — .177",
    nameAr: "تورفين بوليمر 16 — 4.5 ملم",
    slugEn: "torvane-polymer-16-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "CO2-powered pistol with a lightweight polymer frame and 16-round magazine. Non-blowback for extended shot count per CO2 cartridge.",
    descriptionAr:
      "مسدس يعمل بتقنية CO2 بإطار بوليمر خفيف الوزن ومخزن 16 طلقة. بلا ارتداد خلفي لعدد طلقات أكبر لكل خرطوشة CO2.",
    categoryEn: "Capsule Pistols",
    price: 340,
    stockQuantity: 20,
    weightGrams: 650,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    sortOrder: 460,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA/DA",
      actionAr: "فردي/مزدوج",
      blowback: "No",
      blowbackAr: "لا",
      capacity: "16 rounds",
      length: "195mm",
      weight: "650g",
    }),
    images: [
      {
        filename: "trv-p16-45-01.jpg",
        altEn: "Torvane Polymer 16 .177 — right profile",
        altAr: "تورفين بوليمر 16 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // OPTICS — Scopes & Optics
  // ════════════════════════════════════════════════════════════════════════════

  {
    sku: "OPT-432-GEN",
    nameEn: "4×32 Mil-Dot Scope — Airgun Rated",
    nameAr: "منظار 4×32 Mil-Dot — مخصص لبنادق الهواء",
    slugEn: "4x32-mil-dot-scope-airgun",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Entry-level 4×32 fixed-power scope. Mil-dot reticle, fully multi-coated lenses, and dovetail/Picatinny rings included. AO adjustable.",
    descriptionAr:
      "منظار 4×32 ثابت القوة للمستوى المبتدئ. شبكة Mil-dot وعدسات مطلية بالكامل.",
    categoryEn: "Scopes & Optics",
    price: 195,
    stockQuantity: 35,
    weightGrams: 350,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 500,
    specs: [
      ...scopeSpecs({
        mag: "4× (fixed)",
        obj: "32mm",
        reticle: "Mil-dot (30/30)",
        tube: '25.4mm (1")',
        waterproof: "Yes — O-ring sealed",
      }),
      {
        labelEn: "Includes",
        labelAr: "يشمل",
        valueEn: "11mm/Picatinny rings",
        valueAr: "حلقات 11 ملم / بيكاتيني",
        displayOrder: 6,
      },
    ],
    images: [
      {
        filename: "scope-4x32-01.jpg",
        altEn: "4×32 Mil-dot scope — included rings",
        altAr: "منظار 4×32 مع الحلقات",
        displayOrder: 1,
      },
    ],
    accessorySkus: SCOPE_ACCESSORY_SKUS,
  },

  {
    sku: "CRM-3940",
    nameEn: "Crestmoor Sport 3–9×40 — AO",
    nameAr: "كريستمور سبورت 3–9×40 — AO",
    slugEn: "crestmoor-sport-3-9x40-ao",
    brand: "Crestmoor Optics",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Entry-level Sport series scope with half-mil reticle, 40mm objective, and AO parallax adjustment. Suitable for airguns and rimfire.",
    descriptionAr: "منظار من سلسلة سبورت للمستوى المبتدئ بشبكة نصف ميل وعدسة 40 ملم وضبط موازٍ AO. مناسب لبنادق الهواء وبنادق الرمي الجانبي.",
    categoryEn: "Scopes & Optics",
    price: 480,
    compareAtPrice: 530,
    stockQuantity: 22,
    weightGrams: 440,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isFeatured: false,
    isNewArrival: false,
    sortOrder: 510,
    specs: [
      ...scopeSpecs({
        mag: "3–9× (variable)",
        obj: "40mm",
        reticle: "Half-Mil Dot",
        tube: '25.4mm (1")',
        waterproof: "Yes — nitrogen purged",
      }),
      {
        labelEn: "Parallax Adjustment",
        labelAr: "ضبط التوازي",
        valueEn: "Side AO, 10m–∞",
        valueAr: "جانبي AO، 10م–∞",
        displayOrder: 6,
      },
    ],
    images: [
      {
        filename: "crm-3940-01.jpg",
        altEn: "Crestmoor Sport 3–9×40 AO",
        altAr: "كريستمور سبورت 3–9×40 AO",
        displayOrder: 1,
      },
    ],
    accessorySkus: SCOPE_ACCESSORY_SKUS,
  },

  {
    sku: "CRM-4165",
    nameEn: "Crestmoor Summit 4–16×50 — IR AO",
    nameAr: "كريستمور سَميت 4–16×50 — IR AO",
    slugEn: "crestmoor-summit-4-16x50-ir-ao",
    brand: "Crestmoor Optics",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Mid-range illuminated reticle scope with side AO. Ideal for field target and long-range airgun use. Includes Picatinny rings.",
    descriptionAr:
      "منظار متوسط المدى بشبكة مضيئة وضبط موازٍ جانبي. مثالي للأهداف الميدانية والرماية بعيدة المدى ببنادق الهواء. يشمل حلقات بيكاتيني.",
    categoryEn: "Scopes & Optics",
    price: 890,
    stockQuantity: 12,
    weightGrams: 640,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isNewArrival: true,
    sortOrder: 520,
    specs: [
      ...scopeSpecs({
        mag: "4–16× (variable)",
        obj: "50mm",
        reticle: "IR Half-Mil Dot",
        tube: '25.4mm (1")',
        waterproof: "Yes — nitrogen purged",
      }),
      {
        labelEn: "Illumination",
        labelAr: "الإضاءة",
        valueEn: "Red/Green, 5 levels each",
        valueAr: "أحمر/أخضر، 5 مستويات لكل منهما",
        displayOrder: 6,
      },
    ],
    images: [
      {
        filename: "crm-4165-01.jpg",
        altEn: "Crestmoor Summit 4–16×50 IR AO",
        altAr: "كريستمور سَميت 4–16×50 IR AO",
        displayOrder: 1,
      },
    ],
    accessorySkus: SCOPE_ACCESSORY_SKUS,
  },

  {
    sku: "CRM-6246",
    nameEn: "Crestmoor Longview 6–24×50 — SF",
    nameAr: "كريستمور لونغفيو 6–24×50 — SF",
    slugEn: "crestmoor-longview-6-24x50-sf",
    brand: "Crestmoor Optics",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "High-magnification side-focus scope for benchrest and field target. 50mm objective, illuminated reticle, 30mm tube. CNC aircraft-grade aluminium.",
    descriptionAr:
      "منظار بتكبير عالٍ وتركيز جانبي للرماية على المقعد والأهداف الميدانية. عدسة 50 ملم وشبكة مضيئة وأنبوب 30 ملم من الألمنيوم المشغّل آليًا.",
    categoryEn: "Scopes & Optics",
    price: 1650,
    stockQuantity: 6,
    lowStockThreshold: 3,
    weightGrams: 820,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: true,
    sortOrder: 530,
    specs: [
      ...scopeSpecs({
        mag: "6–24× (variable)",
        obj: "50mm",
        reticle: "IR Mil Dot",
        tube: "30mm",
        waterproof: "Yes — argon purged",
      }),
      {
        labelEn: "Adjustment Per Click",
        labelAr: "الضبط لكل نقرة",
        valueEn: "¼ MOA",
        valueAr: "¼ MOA",
        displayOrder: 6,
      },
    ],
    images: [
      {
        filename: "crm-6246-01.jpg",
        altEn: "Crestmoor Longview 6–24×50 SF",
        altAr: "كريستمور لونغفيو 6–24×50 SF",
        displayOrder: 1,
      },
    ],
    accessorySkus: SCOPE_ACCESSORY_SKUS,
  },

  {
    sku: "CRM-REDDOT",
    nameEn: "Crestmoor 4MOA Reflex Red Dot",
    nameAr: "كريستمور ريفلكس نقطة حمراء 4MOA",
    slugEn: "crestmoor-4moa-reflex-red-dot",
    brand: "Crestmoor Optics",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Compact reflex sight with a 4 MOA red dot. 4 brightness settings, quick-detach Picatinny mount. Parallax-free at 50m.",
    descriptionAr:
      "مشعل ريفلكس مضغوط بنقطة حمراء 4 MOA. 4 مستويات سطوع وتثبيت سريع على سكة بيكاتيني. بلا انحراف موازٍ عند 50 مترًا.",
    categoryEn: "Optics",
    price: 280,
    stockQuantity: 28,
    weightGrams: 180,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isNewArrival: true,
    sortOrder: 540,
    specs: [
      {
        labelEn: "Type",
        labelAr: "النوع",
        valueEn: "Reflex Red Dot",
        valueAr: "ريفلكس نقطة حمراء",
        displayOrder: 1,
      },
      {
        labelEn: "Dot Size",
        labelAr: "حجم النقطة",
        valueEn: "4 MOA",
        valueAr: "4 MOA",
        displayOrder: 2,
      },
      {
        labelEn: "Brightness Levels",
        labelAr: "مستويات السطوع",
        valueEn: "4 (red)",
        valueAr: "4 (أحمر)",
        displayOrder: 3,
      },
      {
        labelEn: "Mount",
        labelAr: "التثبيت",
        valueEn: "Quick-detach Picatinny",
        valueAr: "بيكاتيني سريع الفك",
        displayOrder: 4,
      },
      {
        labelEn: "Water Resistance",
        labelAr: "مقاومة الماء",
        valueEn: "IPX7",
        valueAr: "IPX7",
        displayOrder: 5,
      },
    ],
    images: [
      {
        filename: "crm-reddot-01.jpg",
        altEn: "Crestmoor 4MOA Reflex Red Dot",
        altAr: "كريستمور ريفلكس نقطة حمراء 4MOA",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  {
    sku: "OPT-RANGEFDR-800",
    nameEn: "Laser Rangefinder — 800m",
    nameAr: "جهاز قياس المسافة بالليزر — 800 م",
    slugEn: "laser-rangefinder-800m",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Compact monocular rangefinder with ±1m accuracy up to 800m. 6× magnification, angle compensation. Hunting and field target use.",
    descriptionAr:
      "جهاز قياس مسافة أحادي العين مضغوط بدقة ±1 م حتى 800 م. تكبير 6× وتعويض الزاوية.",
    categoryEn: "Optics",
    price: 680,
    stockQuantity: 15,
    weightGrams: 190,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 550,
    specs: [
      {
        labelEn: "Range",
        labelAr: "المدى",
        valueEn: "10–800m",
        valueAr: "10–800 م",
        displayOrder: 1,
      },
      {
        labelEn: "Accuracy",
        labelAr: "الدقة",
        valueEn: "±1m",
        valueAr: "±1 م",
        displayOrder: 2,
      },
      {
        labelEn: "Magnification",
        labelAr: "التكبير",
        valueEn: "6×",
        valueAr: "6×",
        displayOrder: 3,
      },
      {
        labelEn: "Modes",
        labelAr: "الأوضاع",
        valueEn: "Normal / Scan / Angle",
        valueAr: "عادي / مسح / زاوية",
        displayOrder: 4,
      },
      {
        labelEn: "Battery",
        labelAr: "البطارية",
        valueEn: "CR2 (included)",
        valueAr: "CR2 (مرفق)",
        displayOrder: 5,
      },
    ],
    images: [
      {
        filename: "rangefinder-800m-01.jpg",
        altEn: "Laser rangefinder 800m",
        altAr: "جهاز قياس مسافة بالليزر 800 م",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // PELLETS & AMMO — Air Pellets
  // ════════════════════════════════════════════════════════════════════════════

  {
    sku: "ASH-FTT-45-500",
    nameEn: "Ashgrove Field Target Dome — .177 (500ct)",
    nameAr: "آشغروف فيلد تارجت دوم — 4.5 ملم (500 حبة)",
    slugEn: "ashgrove-field-target-dome-177-500",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 4.5,
    descriptionEn:
      "Competition pellet with a round-head dome design for maximum energy transfer and consistent grouping. 4.50mm head size.",
    descriptionAr:
      "رصاص للمسابقات بتصميم قبة مستديرة لأقصى نقل للطاقة وتجمّع ثابت. قطر الرأس 4.50 ملم.",
    categoryEn: "Air Pellets",
    price: 55,
    stockQuantity: 80,
    lowStockThreshold: 10,
    weightGrams: 280,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    minOrderQty: 1,
    maxOrderQty: 20,
    sortOrder: 600,
    specs: pelletSpecs({
      caliber: ".177 (4.5mm)",
      type: "Domed (Round Head)",
      typeAr: "قبة مستديرة",
      count: "500",
      weight: "8.64 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-ftt-45-500-01.jpg",
        altEn: "Ashgrove Field Target Dome .177 500ct",
        altAr: "آشغروف فيلد تارجت دوم 4.5 ملم 500 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-PDM-45-500",
    nameEn: "Ashgrove Precision Dome — .177 (500ct)",
    nameAr: "آشغروف بريسجن دوم — 4.5 ملم (500 حبة)",
    slugEn: "ashgrove-precision-dome-177-500",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 4.5,
    descriptionEn:
      "Domed diabolo pellet. Benchmark accuracy with controlled-size dies. Preferred by field target shooters.",
    descriptionAr:
      "رصاصة ديابولو بقبة مستديرة. دقة مرجعية بقوالب مضبوطة الحجم. المفضلة لدى رماة الأهداف الميدانية.",
    categoryEn: "Air Pellets",
    price: 62,
    compareAtPrice: 72,
    stockQuantity: 95,
    lowStockThreshold: 10,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 610,
    specs: pelletSpecs({
      caliber: ".177 (4.5mm)",
      type: "Domed (Diabolo)",
      typeAr: "قبة ديابولو",
      count: "500",
      weight: "8.44 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-pdm-45-500-01.jpg",
        altEn: "Ashgrove Precision Dome .177 500ct",
        altAr: "آشغروف بريسجن دوم 4.5 ملم 500 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-HPX-55-200",
    nameEn: "Ashgrove Hollow Point Extreme — .22 (200ct)",
    nameAr: "آشغروف هولو بوينت إكستريم — 5.5 ملم (200 حبة)",
    slugEn: "ashgrove-hollow-point-extreme-22-200",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 5.5,
    descriptionEn:
      "Hollow point .22 pellet with 5-pointed tip. Rapid expansion on impact. Ideal for pest control and small game hunting.",
    descriptionAr: "رصاص مجوف بعيار 5.5 ملم وبطرف خماسي النقاط. توسع سريع عند الاصطدام. مثالي لمكافحة الآفات وصيد الطرائد الصغيرة.",
    categoryEn: "Air Pellets",
    price: 52,
    stockQuantity: 65,
    lowStockThreshold: 10,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 620,
    specs: pelletSpecs({
      caliber: ".22 (5.5mm)",
      type: "Hollow Point",
      typeAr: "مجوف",
      count: "200",
      weight: "18.52 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-hpx-55-200-01.jpg",
        altEn: "Ashgrove Hollow Point Extreme .22 200ct",
        altAr: "آشغروف هولو بوينت إكستريم 5.5 ملم 200 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-PDH-55-500",
    nameEn: "Ashgrove Precision Dome Heavy — .22 (500ct)",
    nameAr: "آشغروف بريسجن دوم هيفي — 5.5 ملم (500 حبة)",
    slugEn: "ashgrove-precision-dome-heavy-22-500",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 5.5,
    descriptionEn:
      "Heavy .22 domed pellet. 18.13gr for maximum energy retention at range. Preferred by PCP hunters and field target shooters.",
    descriptionAr:
      "رصاصة ثقيلة بقبة مستديرة بعيار 5.5 ملم. وزن 18.13 قمحة للحفاظ على أقصى طاقة على المسافات. المفضلة لدى صيادي PCP ورماة الأهداف الميدانية.",
    categoryEn: "Air Pellets",
    price: 75,
    stockQuantity: 70,
    lowStockThreshold: 10,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isNewArrival: false,
    sortOrder: 630,
    specs: pelletSpecs({
      caliber: ".22 (5.5mm)",
      type: "Domed (Heavy)",
      typeAr: "قبة ثقيلة",
      count: "500",
      weight: "18.13 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-pdh-55-500-01.jpg",
        altEn: "Ashgrove Precision Dome Heavy .22 500ct",
        altAr: "آشغروف بريسجن دوم هيفي 5.5 ملم 500 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-SLG-635-100",
    nameEn: "Ashgrove Slugs HP — .25 (100ct)",
    nameAr: "آشغروف سلاغز HP — 6.35 ملم (100 حبة)",
    slugEn: "ashgrove-slugs-hp-25-100",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 6.35,
    descriptionEn:
      "Solid slug design for .25 caliber. Hollow point variant for hunting use. Superior downrange energy for high-power PCP rifles.",
    descriptionAr: "تصميم سلاغ صلب لعيار 6.35 ملم، مع نسخة مجوفة للصيد. طاقة متفوقة على المدى البعيد لبنادق PCP عالية القوة.",
    categoryEn: "Air Pellets",
    price: 85,
    stockQuantity: 40,
    lowStockThreshold: 5,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 640,
    specs: pelletSpecs({
      caliber: ".25 (6.35mm)",
      type: "Solid Slug Hollow Point",
      typeAr: "سلاج صلب مجوف",
      count: "100",
      weight: "26 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-slg-635-100-01.jpg",
        altEn: "Ashgrove Slugs HP .25 100ct",
        altAr: "آشغروف سلاغز HP 6.35 ملم 100 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-VAL-45-1000",
    nameEn: "Ashgrove Value Dome — .177 (1000ct)",
    nameAr: "آشغروف فاليو دوم — 4.5 ملم (1000 حبة)",
    slugEn: "ashgrove-value-dome-177-1000",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 4.5,
    descriptionEn:
      "Accurate .177 pellet in the value range. Flat-base domed for tight groups at 25m. 1000-count box for high-volume shooters.",
    descriptionAr:
      "رصاصة دقيقة بعيار 4.5 ملم ضمن فئة القيمة. قاعدة مسطحة وقبة مستديرة لتجمّع محكم عند 25 مترًا. علبة 1000 حبة للرماة كثيري الاستهلاك.",
    categoryEn: "Air Pellets",
    price: 42,
    stockQuantity: 120,
    lowStockThreshold: 20,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    minOrderQty: 1,
    maxOrderQty: 30,
    sortOrder: 650,
    specs: pelletSpecs({
      caliber: ".177 (4.5mm)",
      type: "Domed (Flat Base)",
      typeAr: "قبة بقاعدة مستوية",
      count: "1000",
      weight: "7.9 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-val-45-1000-01.jpg",
        altEn: "Ashgrove Value Dome .177 1000ct",
        altAr: "آشغروف فاليو دوم 4.5 ملم 1000 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-ALR-45-250",
    nameEn: "Ashgrove All-Round — .177 (250ct)",
    nameAr: "آشغروف أول راوند — 4.5 ملم (250 حبة)",
    slugEn: "ashgrove-all-round-177-250",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 4.5,
    descriptionEn:
      "All-round pellet for spring and PCP rifles. Clean skirt for consistent fit and reliable pellet seating. Multi-use: target and hunting.",
    descriptionAr:
      "رصاصة متعددة الأغراض للبنادق النابضة وبنادق PCP. تنورة نظيفة لثبات الملاءمة وتثبيت موثوق. مناسبة للأهداف والصيد.",
    categoryEn: "Air Pellets",
    price: 38,
    stockQuantity: 88,
    lowStockThreshold: 10,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 660,
    specs: pelletSpecs({
      caliber: ".177 (4.5mm)",
      type: "Domed",
      typeAr: "قبة",
      count: "250",
      weight: "8.2 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-alr-45-250-01.jpg",
        altEn: "Ashgrove All-Round .177 250ct",
        altAr: "آشغروف أول راوند 4.5 ملم 250 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  // ── Sound Ammo ──────────────────────────────────────────────────────────────

  {
    sku: "SNDAMMO-8MM-50",
    nameEn: "8mm Sound Ammo — Box of 50",
    nameAr: "ذخيرة الصوت 8 ملم — علبة 50 حبة",
    slugEn: "sound-ammo-8mm-50",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "8mm blank / sound cartridges. For training and signalling only. Not for use in live-fire weapons.",
    descriptionAr: "طلقات صوت 8 ملم فارغة. للتدريب والإشارة فقط.",
    categoryEn: "Sound Ammo",
    price: 35,
    stockQuantity: 150,
    lowStockThreshold: 20,
    requiresIdVerification: true,
    supportsAddons: false,
    b2bAvailable: false,
    minOrderQty: 1,
    maxOrderQty: 10,
    sortOrder: 700,
    specs: [
      {
        labelEn: "Caliber",
        labelAr: "العيار",
        valueEn: "8mm",
        valueAr: "8 ملم",
        displayOrder: 1,
      },
      {
        labelEn: "Type",
        labelAr: "النوع",
        valueEn: "Sound / Blank",
        valueAr: "صوت / فارغ",
        displayOrder: 2,
      },
      {
        labelEn: "Count per Box",
        labelAr: "العدد في العلبة",
        valueEn: "50",
        valueAr: "50",
        displayOrder: 3,
      },
      {
        labelEn: "Use",
        labelAr: "الاستخدام",
        valueEn: "Training and signalling only",
        valueAr: "للتدريب والإشارة فقط",
        displayOrder: 4,
      },
    ],
    images: [
      {
        filename: "sound-ammo-8mm-50-01.jpg",
        altEn: "8mm sound ammo 50-round box",
        altAr: "علبة ذخيرة صوت 8 ملم 50 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "SNDAMMO-9MM-100",
    nameEn: "9mm Sound Ammo — Box of 100",
    nameAr: "ذخيرة الصوت 9 ملم — علبة 100 حبة",
    slugEn: "sound-ammo-9mm-100",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "9mm blank / sound cartridges. 100-round value box for training pistols and starter pistols.",
    descriptionAr:
      "طلقات صوت 9 ملم فارغة. علبة 100 حبة للقيمة للمسدسات التدريبية.",
    categoryEn: "Sound Ammo",
    price: 58,
    stockQuantity: 90,
    lowStockThreshold: 10,
    requiresIdVerification: true,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 710,
    specs: [
      {
        labelEn: "Caliber",
        labelAr: "العيار",
        valueEn: "9mm",
        valueAr: "9 ملم",
        displayOrder: 1,
      },
      {
        labelEn: "Type",
        labelAr: "النوع",
        valueEn: "Sound / Blank",
        valueAr: "صوت / فارغ",
        displayOrder: 2,
      },
      {
        labelEn: "Count per Box",
        labelAr: "العدد في العلبة",
        valueEn: "100",
        valueAr: "100",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "sound-ammo-9mm-100-01.jpg",
        altEn: "9mm sound ammo 100-round box",
        altAr: "علبة ذخيرة صوت 9 ملم 100 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESSORIES — Cases & Bags
  // ════════════════════════════════════════════════════════════════════════════

  {
    sku: "CASE-120-HARD",
    nameEn: "Hard Rifle Case — 120cm",
    nameAr: "حقيبة بندقية صلبة — 120 سم",
    slugEn: "hard-rifle-case-120cm",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Impact-resistant hard case with foam lining and dual latches. Fits rifles up to 120cm. Interior foam for PCP/optics storage.",
    descriptionAr:
      "حقيبة صلبة مقاومة للصدمات مع بطانة رغوية وأقفال مزدوجة. تناسب البنادق حتى 120 سم.",
    categoryEn: "Cases & Bags",
    price: 245,
    stockQuantity: 30,
    weightGrams: 2400,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 800,
    specs: [
      {
        labelEn: "Interior Length",
        labelAr: "الطول الداخلي",
        valueEn: "120cm",
        valueAr: "120 سم",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "ABS Polymer",
        valueAr: "بوليمر ABS",
        displayOrder: 2,
      },
      {
        labelEn: "Foam Lining",
        labelAr: "البطانة الرغوية",
        valueEn: "Pre-cut egg crate foam",
        valueAr: "رغوة بيضاوية مقطوعة مسبقاً",
        displayOrder: 3,
      },
      {
        labelEn: "Latches",
        labelAr: "الأقفال",
        valueEn: "2× dual-action latches",
        valueAr: "2× أقفال ذات حركة مزدوجة",
        displayOrder: 4,
      },
      {
        labelEn: "IP Rating",
        labelAr: "تقييم IP",
        valueEn: "Water-resistant",
        valueAr: "مقاوم للماء",
        displayOrder: 5,
      },
    ],
    images: [
      {
        filename: "hard-case-120cm-01.jpg",
        altEn: "Hard rifle case 120cm open with foam",
        altAr: "حقيبة بندقية صلبة 120 سم مفتوحة",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  {
    sku: "CASE-100-SOFT",
    nameEn: "Tactical Rifle Bag — 100cm",
    nameAr: "حقيبة بندقية تكتيكية — 100 سم",
    slugEn: "tactical-rifle-bag-100cm",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "600D nylon tactical rifle bag with MOLLE webbing, padded dividers, and dual carry handles. Two external pockets for accessories.",
    descriptionAr:
      "حقيبة بندقية تكتيكية نايلون 600D مع نسيج MOLLE وفواصل مبطنة.",
    categoryEn: "Cases & Bags",
    price: 145,
    stockQuantity: 45,
    weightGrams: 1100,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 810,
    specs: [
      {
        labelEn: "Interior Length",
        labelAr: "الطول الداخلي",
        valueEn: "100cm",
        valueAr: "100 سم",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "600D Nylon",
        valueAr: "نايلون 600D",
        displayOrder: 2,
      },
      {
        labelEn: "Features",
        labelAr: "المميزات",
        valueEn: "MOLLE webbing, padded dividers, dual handles",
        valueAr: "نسيج MOLLE، فواصل مبطنة، مقابض مزدوجة",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "rifle-bag-100cm-01.jpg",
        altEn: "Tactical rifle bag 100cm",
        altAr: "حقيبة بندقية تكتيكية 100 سم",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  {
    sku: "CASE-130-HARD",
    nameEn: "Hard Rifle Case — 130cm",
    nameAr: "حقيبة بندقية صلبة — 130 سم",
    slugEn: "hard-rifle-case-130cm",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Extra-long hard case for longer PCP and sporter rifles. 3 latches, padded shoulder strap, and lockable hasps for travel.",
    descriptionAr:
      "حقيبة صلبة طويلة للبنادق الأطول. 3 أقفال وحزام كتف مبطن وأقفال قابلة للتأمين.",
    categoryEn: "Cases & Bags",
    price: 285,
    compareAtPrice: 320,
    stockQuantity: 18,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isNewArrival: false,
    sortOrder: 820,
    specs: [
      {
        labelEn: "Interior Length",
        labelAr: "الطول الداخلي",
        valueEn: "130cm",
        valueAr: "130 سم",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "ABS Polymer",
        valueAr: "بوليمر ABS",
        displayOrder: 2,
      },
      {
        labelEn: "Latches",
        labelAr: "الأقفال",
        valueEn: "3× dual-action latches + 2 lockable hasps",
        valueAr: "3× أقفال مزدوجة + 2 قفل قابل للتأمين",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "hard-case-130cm-01.jpg",
        altEn: "Hard rifle case 130cm",
        altAr: "حقيبة بندقية صلبة 130 سم",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  {
    sku: "CASE-PISTOL-HARD",
    nameEn: "Hard Pistol Case — Foam Lined",
    nameAr: "حقيبة مسدس صلبة — مبطنة بالرغوة",
    slugEn: "hard-pistol-case-foam",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Compact hard pistol case with custom-cut foam. Dual latches, lockable hasps, and interior for pistol + 2 spare magazines.",
    descriptionAr: "حقيبة مسدس صلبة مضغوطة مع رغوة مقطوعة مخصصة. أقفال مزدوجة.",
    categoryEn: "Cases & Bags",
    price: 95,
    stockQuantity: 50,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 830,
    specs: [
      {
        labelEn: "Interior Dimensions",
        labelAr: "الأبعاد الداخلية",
        valueEn: "290 × 200 × 75mm",
        valueAr: "290 × 200 × 75 ملم",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "ABS Polymer",
        valueAr: "بوليمر ABS",
        displayOrder: 2,
      },
    ],
    images: [
      {
        filename: "hard-pistol-case-01.jpg",
        altEn: "Hard pistol case foam lined",
        altAr: "حقيبة مسدس صلبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  // ── Spare Parts ─────────────────────────────────────────────────────────────

  {
    sku: "PUMP-300-HCP",
    nameEn: "PCP Hand Pump — 300 Bar",
    nameAr: "مضخة يدوية PCP — 300 بار",
    slugEn: "pcp-hand-pump-300bar",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "High-pressure 3-stage hand pump. Built-in moisture trap, pressure gauge, and 300-bar rating. Includes fill probe and DIN adapter.",
    descriptionAr:
      "مضخة يدوية 3 مراحل عالية الضغط. مصيدة رطوبة مدمجة ومقياس ضغط وتقييم 300 بار.",
    categoryEn: "Spare Parts",
    price: 320,
    compareAtPrice: 380,
    stockQuantity: 22,
    weightGrams: 2200,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: true,
    isNewArrival: false,
    isFeatured: true,
    sortOrder: 900,
    specs: [
      {
        labelEn: "Max Pressure",
        labelAr: "الضغط الأقصى",
        valueEn: "300 bar (4350 psi)",
        valueAr: "300 بار (4350 PSI)",
        displayOrder: 1,
      },
      {
        labelEn: "Stages",
        labelAr: "المراحل",
        valueEn: "3-stage",
        valueAr: "3 مراحل",
        displayOrder: 2,
      },
      {
        labelEn: "Moisture Filter",
        labelAr: "مرشح الرطوبة",
        valueEn: "Yes — integrated",
        valueAr: "نعم — مدمج",
        displayOrder: 3,
      },
      {
        labelEn: "Gauge",
        labelAr: "المقياس",
        valueEn: "0–300 bar (included)",
        valueAr: "0–300 بار (مرفق)",
        displayOrder: 4,
      },
      {
        labelEn: "Includes",
        labelAr: "يشمل",
        valueEn: "Fill probe, DIN connector, carry bag",
        valueAr: "مسبار التعبئة، موصل DIN، حقيبة حمل",
        displayOrder: 5,
      },
    ],
    images: [
      {
        filename: "pcp-pump-300bar-01.jpg",
        altEn: "PCP hand pump 300 bar with gauge",
        altAr: "مضخة يدوية PCP 300 بار",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  {
    sku: "CO2-12G-5PK",
    nameEn: "CO2 Cartridges — 12g (5-Pack)",
    nameAr: "خراطيش CO2 — 12 جرام (عبوة 5)",
    slugEn: "co2-cartridges-12g-5pack",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Standard 12g CO2 cartridges. Compatible with all 12g-based CO2 pistols, rifles, and airguns.",
    descriptionAr:
      "خراطيش CO2 قياسية 12 جرام. متوافقة مع جميع المسدسات والبنادق الهوائية التي تستخدم 12 جرام.",
    categoryEn: "Spare Parts",
    price: 28,
    stockQuantity: 300,
    lowStockThreshold: 30,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    minOrderQty: 1,
    maxOrderQty: 20,
    sortOrder: 910,
    specs: [
      {
        labelEn: "Weight",
        labelAr: "الوزن",
        valueEn: "12g per cartridge",
        valueAr: "12 جرام لكل خرطوشة",
        displayOrder: 1,
      },
      {
        labelEn: "Quantity",
        labelAr: "الكمية",
        valueEn: "5 cartridges per pack",
        valueAr: "5 خراطيش في الحزمة",
        displayOrder: 2,
      },
      {
        labelEn: "Compatibility",
        labelAr: "التوافق",
        valueEn: "Universal standard 12g",
        valueAr: "معيار عالمي 12 جرام",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "co2-12g-5pk-01.jpg",
        altEn: "CO2 12g cartridges 5-pack",
        altAr: "خراطيش CO2 12 جرام 5 حبات",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "PELLET-TRAP-STL",
    nameEn: "Steel Pellet Trap — A4 Target Frame",
    nameAr: "منطقة توقف الرصاص الفولاذية — إطار هدف A4",
    slugEn: "steel-pellet-trap-a4",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Heavy-duty steel backstop with angled baffle for pellet collection. Accepts standard A4 paper targets. Safe for up to .22 caliber.",
    descriptionAr:
      "حاجب فولاذي ثقيل مع حاجز مائل لتجميع الرصاص. يقبل أهداف ورق A4.",
    categoryEn: "Spare Parts",
    price: 88,
    stockQuantity: 35,
    weightGrams: 2800,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 920,
    specs: [
      {
        labelEn: "Target Area",
        labelAr: "منطقة الهدف",
        valueEn: "210 × 297mm (A4)",
        valueAr: "210 × 297 ملم (A4)",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "3mm Steel",
        valueAr: "فولاذ 3 ملم",
        displayOrder: 2,
      },
      {
        labelEn: "Rated For",
        labelAr: "مصنف لـ",
        valueEn: "Up to .22 caliber airguns",
        valueAr: "حتى عيار 5.5 ملم",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "pellet-trap-a4-01.jpg",
        altEn: "Steel pellet trap A4 target frame",
        altAr: "منطقة توقف الرصاص الفولاذية A4",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "CLEAN-KIT-UNIV",
    nameEn: "Universal Cleaning Kit — 17pcs",
    nameAr: "طقم تنظيف شامل — 17 قطعة",
    slugEn: "universal-cleaning-kit-17pcs",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "17-piece aluminium cleaning rod kit for .177 to .30 caliber. Includes bore brushes, patches, jag, mop, and pull-through for airguns and rimfire.",
    descriptionAr:
      "طقم 17 قطعة بعصا ألومنيوم من 4.5 ملم إلى 7.62 ملم. يشمل فراشي الماسورة والقطع والسحب.",
    categoryEn: "Spare Parts",
    price: 65,
    stockQuantity: 55,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 930,
    specs: [
      {
        labelEn: "Piece Count",
        labelAr: "عدد القطع",
        valueEn: "17 pieces",
        valueAr: "17 قطعة",
        displayOrder: 1,
      },
      {
        labelEn: "Compatible Calibers",
        labelAr: "العيارات المتوافقة",
        valueEn: ".177 – .30 (4.5–7.62mm)",
        valueAr: "4.5 – 7.62 ملم",
        displayOrder: 2,
      },
      {
        labelEn: "Rod Material",
        labelAr: "مادة العصا",
        valueEn: "Aluminium (multi-section)",
        valueAr: "ألومنيوم (متعدد المقاطع)",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "cleaning-kit-17pcs-01.jpg",
        altEn: "Universal 17-piece cleaning kit",
        altAr: "طقم تنظيف شامل 17 قطعة",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  // ── Knives ───────────────────────────────────────────────────────────────────

  {
    sku: "FEN-FXD-TRL",
    nameEn: "Fennick Trailmaster Fixed Blade",
    nameAr: "سكين فينيك تريلماستر ثابتة النصل",
    slugEn: "fennick-trailmaster-fixed-blade",
    brand: "Fennick Outdoor",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "4.8\" drop-point blade in stainless steel. Glass-filled nylon handle, integrated fire starter, and sheath with sharpener.",
    descriptionAr:
      "نصل 4.8\" بنقطة منخفضة من الفولاذ المقاوم للصدأ. مقبض نايلون معزز بالألياف مع بادئ نار مدمج وغمد مزود بمسّن.",
    categoryEn: "Knives",
    price: 185,
    compareAtPrice: 220,
    stockQuantity: 28,
    weightGrams: 210,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isFeatured: false,
    isNewArrival: false,
    sortOrder: 1000,
    specs: [
      {
        labelEn: "Blade Length",
        labelAr: "طول النصل",
        valueEn: '4.8" (122mm)',
        valueAr: '4.8" (122 ملم)',
        displayOrder: 1,
      },
      {
        labelEn: "Blade Steel",
        labelAr: "فولاذ النصل",
        valueEn: "7Cr17MoV Stainless",
        valueAr: "7Cr17MoV مقاوم للصدأ",
        displayOrder: 2,
      },
      {
        labelEn: "Blade Style",
        labelAr: "شكل النصل",
        valueEn: "Drop Point",
        valueAr: "نقطة منخفضة",
        displayOrder: 3,
      },
      {
        labelEn: "Handle",
        labelAr: "المقبض",
        valueEn: "Glass-filled nylon",
        valueAr: "نايلون مملوء بالزجاج",
        displayOrder: 4,
      },
      {
        labelEn: "Includes",
        labelAr: "يشمل",
        valueEn: "Nylon sheath, fire starter, sharpener",
        valueAr: "غمد نايلون، بادئ نار، مبرد",
        displayOrder: 5,
      },
    ],
    images: [
      {
        filename: "fen-fxd-trl-01.jpg",
        altEn: "Fennick Trailmaster Fixed Blade",
        altAr: "سكين فينيك تريلماستر ثابتة النصل",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  {
    sku: "FEN-FXD-HNT",
    nameEn: "Fennick Hunter Fixed Blade 6\"",
    nameAr: "سكين فينيك هانتر ثابتة النصل 6\"",
    slugEn: "fennick-hunter-fixed-blade-6",
    brand: "Fennick Outdoor",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Classic hunting knife with a 6\" stainless blade and leather handle. Dependable in the field. Includes leather sheath.",
    descriptionAr:
      "سكين صيد كلاسيكية بنصل 6\" من الفولاذ المقاوم للصدأ ومقبض جلدي. موثوقة في الميدان. تشمل غمدًا جلديًا.",
    categoryEn: "Knives",
    price: 280,
    stockQuantity: 15,
    weightGrams: 310,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isNewArrival: true,
    isFeatured: false,
    sortOrder: 1010,
    specs: [
      {
        labelEn: "Blade Length",
        labelAr: "طول النصل",
        valueEn: '6" (152mm)',
        valueAr: '6" (152 ملم)',
        displayOrder: 1,
      },
      {
        labelEn: "Blade Steel",
        labelAr: "فولاذ النصل",
        valueEn: "420HC Stainless",
        valueAr: "420HC مقاوم للصدأ",
        displayOrder: 2,
      },
      {
        labelEn: "Blade Style",
        labelAr: "شكل النصل",
        valueEn: "Clip Point",
        valueAr: "نقطة مقطوعة",
        displayOrder: 3,
      },
      {
        labelEn: "Handle",
        labelAr: "المقبض",
        valueEn: "Phenolic resin",
        valueAr: "راتنج فينولي",
        displayOrder: 4,
      },
      {
        labelEn: "Includes",
        labelAr: "يشمل",
        valueEn: "Genuine leather sheath",
        valueAr: "غمد جلد طبيعي",
        displayOrder: 5,
      },
    ],
    images: [
      {
        filename: "fen-fxd-hnt-01.jpg",
        altEn: "Fennick Hunter Fixed Blade 6\"",
        altAr: "سكين فينيك هانتر ثابتة النصل 6\"",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  {
    sku: "KNF-SKIN-GHK",
    nameEn: "Skinning Knife — Gut Hook",
    nameAr: "سكين التقشير — خطاف تنظيف",
    slugEn: "skinning-knife-gut-hook",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      '3.5" skinner blade with integrated gut hook. Rubberised soft-grip handle. Ideal for field-dressing game after a hunt.',
    descriptionAr:
      'نصل تقشير 3.5" مع خطاف تنظيف مدمج. مقبض مطاطي ناعم. مثالي لتجهيز الصيد.',
    categoryEn: "Knives",
    price: 120,
    stockQuantity: 40,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 1020,
    specs: [
      {
        labelEn: "Blade Length",
        labelAr: "طول النصل",
        valueEn: '3.5" (89mm)',
        valueAr: '3.5" (89 ملم)',
        displayOrder: 1,
      },
      {
        labelEn: "Blade Style",
        labelAr: "شكل النصل",
        valueEn: "Drop Point + Gut Hook",
        valueAr: "نقطة منخفضة + خطاف تنظيف",
        displayOrder: 2,
      },
      {
        labelEn: "Handle",
        labelAr: "المقبض",
        valueEn: "Rubberised soft-grip",
        valueAr: "مطاطي ناعم",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "skinning-knife-gut-hook-01.jpg",
        altEn: "Skinning knife with gut hook",
        altAr: "سكين تقشير مع خطاف تنظيف",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  // ── Additional Spring Piston ─────────────────────────────────────────────

  {
    sku: "HLV-RPT-45",
    nameEn: "Halvard Ranger Repeater G2 — .177",
    nameAr: "هالفارد رينجر ريبيتر G2 — 4.5 ملم",
    slugEn: "halvard-ranger-repeater-g2-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "10-shot repeater spring rifle with a horizontal inline magazine. No manual pellet loading between shots. Includes a recoil pad.",
    descriptionAr:
      "بندقية نابضة متكررة 10 طلقات بمخزن أفقي. لا حاجة لتحميل الرصاصة يدويًا بين الطلقات. مزودة بوسادة لامتصاص الارتداد.",
    categoryEn: "Spring Piston",
    price: 650,
    compareAtPrice: 720,
    stockQuantity: 10,
    weightGrams: 3000,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: true,
    sortOrder: 105,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "Spring Piston",
        actionAr: "نابض مكبس",
        energy: "19.9 J",
        barrelLen: "460mm",
        overallLen: "1100mm",
        weight: "3.0 kg",
        stock: "Synthetic",
        stockAr: "مصطنع",
      }),
      {
        labelEn: "Magazine Capacity",
        labelAr: "سعة المخزن",
        valueEn: "10 rounds (inline)",
        valueAr: "10 طلقات (أفقي)",
        displayOrder: 8,
      },
    ],
    images: [
      {
        filename: "hlv-rpt-45-01.jpg",
        altEn: "Halvard Ranger Repeater G2 .177",
        altAr: "هالفارد رينجر ريبيتر G2 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-GLU155-55",
    nameEn: "Brightfell Gale Underlever 155 — .22",
    nameAr: "برايتفل غيل أندرليفر 155 — 5.5 ملم",
    slugEn: "brightfell-gale-underlever-155-22",
    brand: "Brightfell",
    actionType: "Spring",
    caliberMm: 5.5,
    descriptionEn:
      "Under-lever spring rifle with fixed barrel for improved accuracy. Adjustable trigger, walnut stock, and anti-shock system.",
    descriptionAr:
      "بندقية نابضة برافعة سفلية وماسورة ثابتة لدقة أفضل. زناد قابل للضبط وخزينة من خشب الجوز ونظام لامتصاص الصدمات.",
    categoryEn: "Spring Piston",
    price: 920,
    stockQuantity: 7,
    lowStockThreshold: 3,
    weightGrams: 4300,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    sortOrder: 115,
    specs: rifleBaseSpecs({
      caliber: ".22 (5.5mm)",
      caliberAr: "5.5 ملم",
      action: "Spring Piston (Under-lever)",
      actionAr: "نابض مكبس برافعة سفلية",
      energy: "28 J",
      barrelLen: "500mm",
      overallLen: "1165mm",
      weight: "4.3 kg",
      stock: "Turkish Walnut",
      stockAr: "جوز تركي",
    }),
    images: [
      {
        filename: "brf-glu155-55-01.jpg",
        altEn: "Brightfell Gale Underlever 155 .22",
        altAr: "برايتفل غيل أندرليفر 155 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-56-55",
    nameEn: "Halvard Driftmaster 56 Hunter — .22",
    nameAr: "هالفارد دريفتماستر 56 هانتر — 5.5 ملم",
    slugEn: "halvard-driftmaster-56-hunter-22",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 5.5,
    descriptionEn:
      "Recoilless side-lever spring rifle at the top of the Halvard lineup. Laminate stock, adjustable trigger, and micro-adjustable foresight.",
    descriptionAr:
      "بندقية نابضة برافعة جانبية بلا ارتداد في قمة تشكيلة هالفارد. خزينة مصفّحة وزناد قابل للضبط وشعيرة دقيقة الضبط.",
    categoryEn: "Spring Piston",
    price: 1780,
    compareAtPrice: 1950,
    stockQuantity: 2,
    lowStockThreshold: 3,
    weightGrams: 4900,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    sortOrder: 125,
    specs: rifleBaseSpecs({
      caliber: ".22 (5.5mm)",
      caliberAr: "5.5 ملم",
      action: "Spring Piston (Recoilless)",
      actionAr: "نابض مكبس بلا ارتداد",
      energy: "24 J",
      barrelLen: "500mm",
      overallLen: "1200mm",
      weight: "4.9 kg",
      stock: "Laminate",
      stockAr: "خشب مصفاة",
    }),
    images: [
      {
        filename: "hlv-56-55-01.jpg",
        altEn: "Halvard Driftmaster 56 Hunter .22",
        altAr: "هالفارد دريفتماستر 56 هانتر 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-KST30-45",
    nameEn: "Halvard Kestrel 30S — .177",
    nameAr: "هالفارد كيستريل 30S — 4.5 ملم",
    slugEn: "halvard-kestrel-30s-177",
    brand: "Halvard Arms",
    actionType: "Spring",
    caliberMm: 4.5,
    descriptionEn:
      "The ideal trainer and backyard rifle. Crisp adjustable trigger, 11J power, and superb accuracy in a compact package.",
    descriptionAr:
      "بندقية التدريب والرماية المنزلية المثالية. زناد دقيق قابل للضبط وطاقة 11 جول ودقة ممتازة في حجم مضغوط.",
    categoryEn: "Spring Piston",
    price: 950,
    stockQuantity: 9,
    weightGrams: 2800,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: false,
    sortOrder: 130,
    specs: rifleBaseSpecs({
      caliber: ".177 (4.5mm)",
      caliberAr: "4.5 ملم",
      action: "Spring Piston",
      actionAr: "نابض مكبس",
      energy: "11 J",
      barrelLen: "396mm",
      overallLen: "1000mm",
      weight: "2.8 kg",
      stock: "Beech Wood",
      stockAr: "خشب الزان",
    }),
    images: [
      {
        filename: "hlv-kst30-45-01.jpg",
        altEn: "Halvard Kestrel 30S .177",
        altAr: "هالفارد كيستريل 30S 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  // ── Additional Turkish PCP ────────────────────────────────────────────────

  {
    sku: "BRF-EMB-MX-45",
    nameEn: "Brightfell Ember Maxi — .177",
    nameAr: "برايتفل إمبر ماكسي — 4.5 ملم",
    slugEn: "brightfell-ember-maxi-177",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 4.5,
    descriptionEn:
      "Flagship side-lever PCP with laminate stock. 14-round magazine, 480cc cylinder, and built-in manometer for 250-shot fills.",
    descriptionAr:
      "بندقية PCP رائدة برافعة جانبية وخزينة مصفّحة. مخزن 14 طلقة وأسطوانة 480 سس ومقياس ضغط مدمج لنحو 250 طلقة لكل تعبئة.",
    categoryEn: "Turkish PCP",
    price: 2950,
    compareAtPrice: 3200,
    stockQuantity: 4,
    lowStockThreshold: 3,
    weightGrams: 3600,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: true,
    sortOrder: 240,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "28 J",
        barrelLen: "590mm",
        overallLen: "1180mm",
        weight: "3.6 kg",
        stock: "Laminate",
        stockAr: "خشب مصفاة",
      }),
      ...pcpExtraSpecs({
        shots: "~130 shots",
        pressure: "250 bar",
        cylVol: "480 cc",
        magCap: "14 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-emb-mx-45-01.jpg",
        altEn: "Brightfell Ember Maxi .177",
        altAr: "برايتفل إمبر ماكسي 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "BRF-BPR-55",
    nameEn: "Brightfell Bullpup Repeater — .22",
    nameAr: "برايتفل بولبوب ريبيتر — 5.5 ملم",
    slugEn: "brightfell-bullpup-repeater-22",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 5.5,
    descriptionEn:
      "Semi-automatic bullpup PCP. 21-round capacity from dual rotary magazines. Adjustable trigger, integrated regulator, and side-folding stock.",
    descriptionAr:
      "بندقية PCP شبه أوتوماتيكية بتصميم بولبوب. سعة 21 طلقة عبر مخزنين دوارين. زناد قابل للضبط ومنظّم مدمج وخزينة تنطوي جانبيًا.",
    categoryEn: "Turkish PCP",
    price: 3400,
    stockQuantity: 3,
    lowStockThreshold: 3,
    weightGrams: 3700,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    sortOrder: 250,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".22 (5.5mm)",
        caliberAr: "5.5 ملم",
        action: "PCP (Semi-auto)",
        actionAr: "PCP شبه أوتوماتيكي",
        energy: "60 J",
        barrelLen: "520mm",
        overallLen: "750mm",
        weight: "3.7 kg",
        stock: "Polymer Bullpup",
        stockAr: "بوليمر بولبوب",
      }),
      ...pcpExtraSpecs({
        shots: "~80 shots",
        pressure: "250 bar",
        cylVol: "350 cc",
        magCap: "21 rounds (2×10 + 1)",
      }),
    ],
    images: [
      {
        filename: "brf-bpr-55-01.jpg",
        altEn: "Brightfell Bullpup Repeater .22",
        altAr: "برايتفل بولبوب ريبيتر 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  // ── Additional European PCP ───────────────────────────────────────────────

  {
    sku: "BRF-SUM4-45",
    nameEn: "Brightfell Summit 4 Classic — .177",
    nameAr: "برايتفل سَميت 4 كلاسيك — 4.5 ملم",
    slugEn: "brightfell-summit-4-classic-177",
    brand: "Brightfell",
    actionType: "PCP",
    caliberMm: 4.5,
    descriptionEn:
      "The entry point to regulated PCP in the Summit range. Side-lever bolt, 10-shot magazine, and a two-stage trigger.",
    descriptionAr:
      "مدخل تشكيلة سَميت إلى بنادق PCP المنظّمة. ترباس جانبي ومخزن 10 طلقات وزناد ثنائي المراحل.",
    categoryEn: "European PCP",
    price: 3500,
    stockQuantity: 4,
    lowStockThreshold: 3,
    weightGrams: 3000,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    sortOrder: 350,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "22 J",
        barrelLen: "510mm",
        overallLen: "990mm",
        weight: "3.0 kg",
        stock: "Beech Wood",
        stockAr: "خشب الزان",
      }),
      ...pcpExtraSpecs({
        shots: "~110 shots",
        pressure: "200 bar",
        cylVol: "200 cc",
        magCap: "10 rounds",
      }),
    ],
    images: [
      {
        filename: "brf-sum4-45-01.jpg",
        altEn: "Brightfell Summit 4 Classic .177",
        altAr: "برايتفل سَميت 4 كلاسيك 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  {
    sku: "HLV-KST110-55",
    nameEn: "Halvard Kestrel 110 ST — .22",
    nameAr: "هالفارد كيستريل 110 ST — 5.5 ملم",
    slugEn: "halvard-kestrel-110-st-22",
    brand: "Halvard Arms",
    actionType: "PCP",
    caliberMm: 5.5,
    descriptionEn:
      "PCP with a thumbhole laminate stock. Integrated manometer, 14-round magazine, and a crisp adjustable trigger.",
    descriptionAr:
      "بندقية PCP بخزينة مصفّحة بفتحة إبهام. مقياس ضغط مدمج ومخزن 14 طلقة وزناد دقيق قابل للضبط.",
    categoryEn: "European PCP",
    price: 6800,
    stockQuantity: 2,
    lowStockThreshold: 3,
    weightGrams: 3500,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: false,
    sortOrder: 360,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".22 (5.5mm)",
        caliberAr: "5.5 ملم",
        action: "PCP",
        actionAr: "PCP",
        energy: "40 J",
        barrelLen: "600mm",
        overallLen: "1050mm",
        weight: "3.5 kg",
        stock: "Laminate Thumbhole",
        stockAr: "خشب مصفاة بفتحة إبهام",
      }),
      ...pcpExtraSpecs({
        shots: "~80 shots",
        pressure: "300 bar",
        cylVol: "480 cc",
        magCap: "14 rounds",
      }),
    ],
    images: [
      {
        filename: "hlv-kst110-55-01.jpg",
        altEn: "Halvard Kestrel 110 ST .22",
        altAr: "هالفارد كيستريل 110 ST 5.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PCP_ACCESSORY_SKUS,
  },

  // ── Additional CO2 Pistols ────────────────────────────────────────────────

  {
    sku: "TRV-MCR-45",
    nameEn: "Torvane Micro Carry — .177",
    nameAr: "تورفين مايكرو كاري — 4.5 ملم",
    slugEn: "torvane-micro-carry-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Compact CO2 pistol for easy handling. Full metal blowback and a 12-round magazine. Lightweight for easy handling.",
    descriptionAr:
      "مسدس CO2 مضغوط وسهل الحمل. ارتداد خلفي معدني كامل ومخزن 12 طلقة. خفيف الوزن وسهل الاستخدام.",
    categoryEn: "CO2 Pistols",
    price: 545,
    stockQuantity: 12,
    weightGrams: 680,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    isNewArrival: true,
    sortOrder: 465,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA",
      actionAr: "فردي",
      blowback: "Yes (full metal)",
      blowbackAr: "نعم (معدن كامل)",
      capacity: "12 rounds",
      length: "176mm",
      weight: "680g",
    }),
    images: [
      {
        filename: "trv-mcr-45-01.jpg",
        altEn: "Torvane Micro Carry .177",
        altAr: "تورفين مايكرو كاري 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-HRT-45",
    nameEn: "Torvane Heritage Service — .177",
    nameAr: "تورفين هيريتدج سيرفيس — 4.5 ملم",
    slugEn: "torvane-heritage-service-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Vintage-style service pistol in CO2. Metal construction with realistic markings, 8-round rotary magazine. Collector's piece with shooting performance.",
    descriptionAr:
      "مسدس خدمة بطراز كلاسيكي بتقنية CO2. بناء معدني مع علامات واقعية ومخزن دوار 8 طلقات. قطعة اقتناء بأداء رماية حقيقي.",
    categoryEn: "Capsule Pistols",
    price: 360,
    stockQuantity: 18,
    weightGrams: 720,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    sortOrder: 475,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA/DA",
      actionAr: "فردي/مزدوج",
      blowback: "No",
      blowbackAr: "لا",
      capacity: "8 rounds",
      length: "216mm",
      weight: "720g",
    }),
    images: [
      {
        filename: "trv-hrt-45-01.jpg",
        altEn: "Torvane Heritage Service .177",
        altAr: "تورفين هيريتدج سيرفيس 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  {
    sku: "TRV-C17-45",
    nameEn: "Torvane Compact Auto 17 — .177",
    nameAr: "تورفين كومباكت أوتو 17 — 4.5 ملم",
    slugEn: "torvane-compact-auto-17-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Compact CO2 pistol. 17-round magazine, metal slide, and fully ambidextrous controls. Ideal for close-range training.",
    descriptionAr:
      "مسدس CO2 مضغوط. مخزن 17 طلقة وشريحة معدنية وأزرار تحكم تناسب اليدين. مثالي للتدريب على المسافات القريبة.",
    categoryEn: "Capsule Pistols",
    price: 480,
    compareAtPrice: 530,
    stockQuantity: 1,
    lowStockThreshold: 3,
    weightGrams: 780,
    requiresIdVerification: false,
    supportsAddons: true,
    b2bAvailable: false,
    sortOrder: 480,
    specs: pistolSpecs({
      caliber: ".177 (4.5mm)",
      action: "SA/DA",
      actionAr: "فردي/مزدوج",
      blowback: "No",
      blowbackAr: "لا",
      capacity: "17 rounds",
      length: "172mm",
      weight: "780g",
    }),
    images: [
      {
        filename: "trv-c17-45-01.jpg",
        altEn: "Torvane Compact Auto 17 .177",
        altAr: "تورفين كومباكت أوتو 17 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: PISTOL_ACCESSORY_SKUS,
  },

  // ── Additional Optics ─────────────────────────────────────────────────────

  {
    sku: "CRM-2450",
    nameEn: "Crestmoor Airline 2–7×32 — AO",
    nameAr: "كريستمور إيرلاين 2–7×32 — AO",
    slugEn: "crestmoor-airline-2-7x32-ao",
    brand: "Crestmoor Optics",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Scope designed specifically for airguns. 2–7× variable, 32mm objective, AO parallax, and a reticle with holdover marks.",
    descriptionAr:
      "منظار مصمم خصيصًا لبنادق الهواء. تكبير متغير 2–7× وعدسة 32 ملم وضبط موازٍ AO وشبكة بعلامات تعويض المسافة.",
    categoryEn: "Scopes & Optics",
    price: 580,
    stockQuantity: 14,
    weightGrams: 380,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isFeatured: true,
    isNewArrival: false,
    sortOrder: 545,
    specs: [
      ...scopeSpecs({
        mag: "2–7× (variable)",
        obj: "32mm",
        reticle: "AMX (Airgun specific)",
        tube: '25.4mm (1")',
        waterproof: "Yes — nitrogen purged",
      }),
      {
        labelEn: "Parallax Adjustment",
        labelAr: "ضبط التوازي",
        valueEn: "Side AO, 10m–∞",
        valueAr: "جانبي AO، 10م–∞",
        displayOrder: 6,
      },
    ],
    images: [
      {
        filename: "crm-2450-01.jpg",
        altEn: "Crestmoor Airline 2–7×32 AO",
        altAr: "كريستمور إيرلاين 2–7×32 AO",
        displayOrder: 1,
      },
    ],
    accessorySkus: SCOPE_ACCESSORY_SKUS,
  },

  {
    sku: "OPT-NIGHTVSN-400",
    nameEn: "Night Vision Monocular — 400m",
    nameAr: "منظار رؤية ليلية أحادي — 400 م",
    slugEn: "night-vision-monocular-400m",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Gen 1+ night vision monocular with 400m detection range. 3× magnification, IR illuminator, and compact form for field use.",
    descriptionAr:
      "منظار رؤية ليلية أحادي الجيل 1+ بمدى كشف 400 م. تكبير 3× ومضيء IR.",
    categoryEn: "Optics",
    price: 1850,
    stockQuantity: 5,
    lowStockThreshold: 3,
    weightGrams: 450,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: true,
    isNewArrival: true,
    sortOrder: 555,
    specs: [
      {
        labelEn: "Type",
        labelAr: "النوع",
        valueEn: "Gen 1+ Night Vision",
        valueAr: "جيل 1+ رؤية ليلية",
        displayOrder: 1,
      },
      {
        labelEn: "Magnification",
        labelAr: "التكبير",
        valueEn: "3×",
        valueAr: "3×",
        displayOrder: 2,
      },
      {
        labelEn: "Detection Range",
        labelAr: "مدى الكشف",
        valueEn: "Up to 400m",
        valueAr: "حتى 400 م",
        displayOrder: 3,
      },
      {
        labelEn: "IR Illuminator",
        labelAr: "مضيء IR",
        valueEn: "Integrated",
        valueAr: "مدمج",
        displayOrder: 4,
      },
      {
        labelEn: "Battery",
        labelAr: "البطارية",
        valueEn: "2× AA (up to 40h)",
        valueAr: "2× AA (حتى 40 ساعة)",
        displayOrder: 5,
      },
    ],
    images: [
      {
        filename: "night-vision-mono-01.jpg",
        altEn: "Night vision monocular 400m",
        altAr: "منظار رؤية ليلية أحادي 400 م",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  // ── Additional Pellets ────────────────────────────────────────────────────

  {
    sku: "HLV-RDT-45-250",
    nameEn: "Halvard Redline Tipped — .177 (250ct)",
    nameAr: "هالفارد ريدلاين مدبب — 4.5 ملم (250 حبة)",
    slugEn: "halvard-redline-tipped-177-250",
    brand: "Halvard Arms",
    actionType: "N/A",
    caliberMm: 4.5,
    descriptionEn:
      "Polymer-tipped pellet for expansion on impact. Red tip for easy counting. Designed for use in break-barrel airguns.",
    descriptionAr:
      "رصاصة بطرف بوليمر تتوسع عند الاصطدام. الطرف الأحمر يسهّل العد. مصممة للاستخدام مع بنادق الهواء ذات الماسورة الكسرية.",
    categoryEn: "Air Pellets",
    price: 30,
    stockQuantity: 110,
    lowStockThreshold: 10,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 665,
    specs: pelletSpecs({
      caliber: ".177 (4.5mm)",
      type: "Polymer-tip Expanding",
      typeAr: "موسع بطرف بوليمر",
      count: "250",
      weight: "7.8 gr",
      material: "Lead / Polymer Tip",
      materialAr: "رصاص / طرف بوليمر",
    }),
    images: [
      {
        filename: "hlv-rdt-45-250-01.jpg",
        altEn: "Halvard Redline Tipped .177 250ct",
        altAr: "هالفارد ريدلاين مدبب 4.5 ملم 250 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-WAD-45-500",
    nameEn: "Ashgrove Match Wadcutter — .177 (500ct)",
    nameAr: "آشغروف ماتش واد كاتر — 4.5 ملم (500 حبة)",
    slugEn: "ashgrove-match-wadcutter-177-500",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 4.5,
    descriptionEn:
      "Flat-head wadcutter for 10m target shooting. Suited to indoor competition. Cuts clean holes in paper for precise scoring.",
    descriptionAr:
      "رأس مسطح للرماية على الأهداف من 10 أمتار. مناسبة للمسابقات الداخلية. تقطع ثقوبًا نظيفة في الورق لتسجيل دقيق للنتائج.",
    categoryEn: "Air Pellets",
    price: 68,
    stockQuantity: 72,
    lowStockThreshold: 10,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 670,
    specs: pelletSpecs({
      caliber: ".177 (4.5mm)",
      type: "Wadcutter (Flat Head)",
      typeAr: "رأس مسطح",
      count: "500",
      weight: "8.18 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-wad-45-500-01.jpg",
        altEn: "Ashgrove Match Wadcutter .177 500ct",
        altAr: "آشغروف ماتش واد كاتر 4.5 ملم 500 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "ASH-PDH-635-150",
    nameEn: "Ashgrove Precision Dome Heavy — .25 (150ct)",
    nameAr: "آشغروف بريسجن دوم هيفي — 6.35 ملم (150 حبة)",
    slugEn: "ashgrove-precision-dome-heavy-25-150",
    brand: "Ashgrove Ammunition",
    actionType: "N/A",
    caliberMm: 6.35,
    descriptionEn:
      "Heavy .25 pellet for high-powered PCP rifles. Consistent skirt and domed head for maximum range accuracy.",
    descriptionAr:
      "رصاصة ثقيلة بعيار 6.35 ملم لبنادق PCP عالية القوة. تنورة ثابتة ورأس مقبب لأقصى دقة على المدى البعيد.",
    categoryEn: "Air Pellets",
    price: 95,
    stockQuantity: 30,
    lowStockThreshold: 5,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 680,
    specs: pelletSpecs({
      caliber: ".25 (6.35mm)",
      type: "Domed",
      typeAr: "قبة",
      count: "150",
      weight: "33.95 gr",
      material: "Lead",
      materialAr: "رصاص",
    }),
    images: [
      {
        filename: "ash-pdh-635-150-01.jpg",
        altEn: "Ashgrove Precision Dome Heavy .25 150ct",
        altAr: "آشغروف بريسجن دوم هيفي 6.35 ملم 150 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  {
    sku: "SNDAMMO-8MM-100",
    nameEn: "8mm Sound Ammo — Box of 100",
    nameAr: "ذخيرة الصوت 8 ملم — علبة 100 حبة",
    slugEn: "sound-ammo-8mm-100",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "8mm blank / sound cartridges — 100-round value box for training and signalling.",
    descriptionAr: "طلقات صوت 8 ملم فارغة — علبة 100 حبة.",
    categoryEn: "Sound Ammo",
    price: 62,
    stockQuantity: 80,
    lowStockThreshold: 10,
    requiresIdVerification: true,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 720,
    specs: [
      {
        labelEn: "Caliber",
        labelAr: "العيار",
        valueEn: "8mm",
        valueAr: "8 ملم",
        displayOrder: 1,
      },
      {
        labelEn: "Type",
        labelAr: "النوع",
        valueEn: "Sound / Blank",
        valueAr: "صوت / فارغ",
        displayOrder: 2,
      },
      {
        labelEn: "Count per Box",
        labelAr: "العدد في العلبة",
        valueEn: "100",
        valueAr: "100",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "sound-ammo-8mm-100-01.jpg",
        altEn: "8mm sound ammo 100-round box",
        altAr: "علبة ذخيرة صوت 8 ملم 100 حبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: AMMO_ACCESSORY_SKUS,
  },

  // ── Additional Accessories ────────────────────────────────────────────────

  {
    sku: "BAG-RANGE-TKT",
    nameEn: "Tactical Range Bag — Large",
    nameAr: "حقيبة الميدان التكتيكية — كبيرة",
    slugEn: "tactical-range-bag-large",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Large range bag with removable dividers, 4 magazine pouches, and padded carry handles. Fits pistols, optics, pellets, and cleaning kits.",
    descriptionAr:
      "حقيبة ميدان كبيرة مع فواصل قابلة للإزالة وجيوب مخازن ومقابض حمل مبطنة.",
    categoryEn: "Cases & Bags",
    price: 175,
    stockQuantity: 22,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 840,
    specs: [
      {
        labelEn: "Main Compartment",
        labelAr: "الحجرة الرئيسية",
        valueEn: "500 × 280 × 250mm",
        valueAr: "500 × 280 × 250 ملم",
        displayOrder: 1,
      },
      {
        labelEn: "Magazine Pouches",
        labelAr: "جيوب المخازن",
        valueEn: "4× external",
        valueAr: "4× خارجية",
        displayOrder: 2,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "900D Nylon",
        valueAr: "نايلون 900D",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "range-bag-large-01.jpg",
        altEn: "Tactical range bag large",
        altAr: "حقيبة الميدان التكتيكية الكبيرة",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  {
    sku: "BPACK-HUNT-45L",
    nameEn: "Hunting Backpack — 45L",
    nameAr: "حقيبة الصيد على الظهر — 45 لتر",
    slugEn: "hunting-backpack-45l",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "45L hydration-compatible hunting backpack. MOLLE system, rifle holder straps, camo pattern, and padded waist belt.",
    descriptionAr:
      "حقيبة صيد على الظهر 45 لتر متوافقة مع الترطيب. نظام MOLLE وأحزمة حامل البندقية.",
    categoryEn: "Cases & Bags",
    price: 320,
    compareAtPrice: 380,
    stockQuantity: 14,
    weightGrams: 1800,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    isNewArrival: true,
    sortOrder: 850,
    specs: [
      {
        labelEn: "Volume",
        labelAr: "الحجم",
        valueEn: "45 litres",
        valueAr: "45 لتر",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "600D Polyester, Woodland Camo",
        valueAr: "بوليستر 600D، كامو",
        displayOrder: 2,
      },
      {
        labelEn: "Hydration",
        labelAr: "الترطيب",
        valueEn: "Compatible (reservoir not included)",
        valueAr: "متوافق (الخزان غير مرفق)",
        displayOrder: 3,
      },
      {
        labelEn: "Rifle Straps",
        labelAr: "أحزمة البندقية",
        valueEn: "2× adjustable side straps",
        valueAr: "2× أحزمة جانبية قابلة للتعديل",
        displayOrder: 4,
      },
    ],
    images: [
      {
        filename: "hunting-backpack-45l-01.jpg",
        altEn: "Hunting backpack 45L",
        altAr: "حقيبة صيد على الظهر 45 لتر",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  {
    sku: "BBRUSH-CLEAN-45",
    nameEn: "Bore Cleaning Brush Set — .177/.22/.25",
    nameAr: "طقم فرش تنظيف الماسورة — 4.5/5.5/6.35 ملم",
    slugEn: "bore-cleaning-brush-set-177-22-25",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Brass bore brushes for .177, .22, and .25 caliber airguns. Compatible with standard 8-32 UNF cleaning rods.",
    descriptionAr:
      "فرش تنظيف نحاسية للماسورة لبنادق الهواء 4.5، 5.5، و6.35 ملم.",
    categoryEn: "Spare Parts",
    price: 28,
    stockQuantity: 90,
    lowStockThreshold: 15,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 940,
    specs: [
      {
        labelEn: "Included Sizes",
        labelAr: "الأحجام المرفقة",
        valueEn: ".177, .22, .25 (3 brushes)",
        valueAr: "4.5، 5.5، 6.35 ملم (3 فرش)",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "Brass bristles, steel core",
        valueAr: "شعيرات نحاسية، قلب فولاذي",
        displayOrder: 2,
      },
      {
        labelEn: "Thread",
        labelAr: "الخيط",
        valueEn: "8-32 UNF (standard)",
        valueAr: "8-32 UNF (قياسي)",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "bore-brush-set-01.jpg",
        altEn: "Bore cleaning brush set .177 .22 .25",
        altAr: "طقم فرش تنظيف الماسورة",
        displayOrder: 1,
      },
    ],
    accessorySkus: ACCESSORY_ACCESSORY_SKUS,
  },

  {
    sku: "KNF-SHRPN-DMD",
    nameEn: "Diamond Knife Sharpener — Dual Grit",
    nameAr: "مبرد سكاكين ألماسي — حبيبتان",
    slugEn: "diamond-knife-sharpener-dual-grit",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "Dual-grit diamond sharpening stick. Coarse and fine sides. Compact field carry size for hunting and fieldcraft use.",
    descriptionAr:
      "عصا تحديد ألماسية ثنائية الحبيبة. جانب خشن وجانب ناعم. حجم مضغوط للميدان.",
    categoryEn: "Knives",
    price: 65,
    stockQuantity: 55,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 1035,
    specs: [
      {
        labelEn: "Grit",
        labelAr: "الحبيبة",
        valueEn: "Coarse 325 + Fine 750",
        valueAr: "خشن 325 + ناعم 750",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "Diamond-coated steel",
        valueAr: "فولاذ مطلي بالألماس",
        displayOrder: 2,
      },
      {
        labelEn: "Length",
        labelAr: "الطول",
        valueEn: "200mm",
        valueAr: "200 ملم",
        displayOrder: 3,
      },
    ],
    images: [
      {
        filename: "diamond-sharpener-01.jpg",
        altEn: "Diamond knife sharpener dual grit",
        altAr: "مبرد سكاكين ألماسي ثنائي الحبيبة",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  // ── CO2 Air Rifle addition ────────────────────────────────────────────────

  {
    sku: "TRV-VSM-45",
    nameEn: "Torvane Vintage SMG — .177",
    nameAr: "تورفين فينتج SMG — 4.5 ملم",
    slugEn: "torvane-vintage-smg-177",
    brand: "Torvane",
    actionType: "CO2",
    caliberMm: 4.5,
    descriptionEn:
      "Vintage-style submachine gun replica in CO2. Full-auto capable, 52-shot magazine, die-cast metal construction. Collector and range use.",
    descriptionAr:
      "نسخة بطراز كلاسيكي من الرشاش الخفيف بتقنية CO2. تدعم الإطلاق الآلي الكامل ومخزن 52 طلقة وبناء معدني مصبوب. للاقتناء والرماية في الميدان.",
    categoryEn: "CO2 Air Rifles",
    price: 1200,
    compareAtPrice: 1380,
    stockQuantity: 4,
    lowStockThreshold: 3,
    weightGrams: 3500,
    requiresIdVerification: true,
    supportsAddons: true,
    b2bAvailable: true,
    isNewArrival: true,
    sortOrder: 120,
    specs: [
      ...rifleBaseSpecs({
        caliber: ".177 (4.5mm)",
        caliberAr: "4.5 ملم",
        action: "CO2",
        actionAr: "CO2",
        energy: "3 J",
        barrelLen: "250mm",
        overallLen: "830mm",
        weight: "3.5 kg",
        stock: "Metal/Polymer",
        stockAr: "معدن/بوليمر",
      }),
      {
        labelEn: "Fire Mode",
        labelAr: "وضع الإطلاق",
        valueEn: "Full-auto / Semi-auto",
        valueAr: "أوتوماتيكي كامل / شبه أوتوماتيكي",
        displayOrder: 8,
      },
      {
        labelEn: "Magazine Capacity",
        labelAr: "سعة المخزن",
        valueEn: "52 rounds (2×12g CO2)",
        valueAr: "52 طلقة (2×12 جرام CO2)",
        displayOrder: 9,
      },
    ],
    images: [
      {
        filename: "trv-vsm-45-01.jpg",
        altEn: "Torvane Vintage SMG .177",
        altAr: "تورفين فينتج SMG 4.5 ملم",
        displayOrder: 1,
      },
    ],
    accessorySkus: RIFLE_ACCESSORY_SKUS,
  },

  {
    sku: "FEN-FLD-RNG",
    nameEn: "Fennick Ranger Folding Knife",
    nameAr: "سكين فينيك رينجر القابلة للطي",
    slugEn: "fennick-ranger-folding",
    brand: "Fennick Outdoor",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "4.0\" clip point blade in stainless steel. Wood-look handle with solid brass bolsters. Classic fieldcraft and hunting knife.",
    descriptionAr:
      "نصل 4.0\" بحد مائل من الفولاذ المقاوم للصدأ. مقبض بمظهر الخشب مع دعامات نحاسية صلبة. سكين كلاسيكية للصيد والأعمال الميدانية.",
    categoryEn: "Knives",
    price: 240,
    stockQuantity: 20,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 1025,
    specs: [
      {
        labelEn: "Blade Length",
        labelAr: "طول النصل",
        valueEn: '4.0" (102mm)',
        valueAr: '4.0" (102 ملم)',
        displayOrder: 1,
      },
      {
        labelEn: "Blade Steel",
        labelAr: "فولاذ النصل",
        valueEn: "420HC Stainless",
        valueAr: "420HC مقاوم للصدأ",
        displayOrder: 2,
      },
      {
        labelEn: "Handle",
        labelAr: "المقبض",
        valueEn: "Phenolic resin (ebony pattern)",
        valueAr: "راتنج فينولي (نمط أبنوس)",
        displayOrder: 3,
      },
      {
        labelEn: "Lock Type",
        labelAr: "نوع القفل",
        valueEn: "Liner lock",
        valueAr: "قفل الحشو",
        displayOrder: 4,
      },
    ],
    images: [
      {
        filename: "fen-fld-rng-01.jpg",
        altEn: "Fennick Ranger Folding Knife",
        altAr: "سكين فينيك رينجر القابلة للطي",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  {
    sku: "KNF-FLD-MULTITOOL",
    nameEn: "Field Multi-Tool — Plier + Blade",
    nameAr: "أداة متعددة الميدان — زردية + نصل",
    slugEn: "field-multi-tool-plier-blade",
    brand: "Generic",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "12-function stainless steel multi-tool. Pliers, knife blade, screwdrivers, file, and can opener. Nylon belt pouch included.",
    descriptionAr:
      "أداة متعددة الوظائف 12 وظيفة من الفولاذ المقاوم للصدأ. زردية وشفرة وبراغي وملف.",
    categoryEn: "Knives",
    price: 88,
    stockQuantity: 40,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 1040,
    specs: [
      {
        labelEn: "Functions",
        labelAr: "الوظائف",
        valueEn: "12 tools",
        valueAr: "12 أداة",
        displayOrder: 1,
      },
      {
        labelEn: "Material",
        labelAr: "المادة",
        valueEn: "420 Stainless Steel",
        valueAr: "فولاذ 420 مقاوم للصدأ",
        displayOrder: 2,
      },
      {
        labelEn: "Weight",
        labelAr: "الوزن",
        valueEn: "230g",
        valueAr: "230 جرام",
        displayOrder: 3,
      },
      {
        labelEn: "Includes",
        labelAr: "يشمل",
        valueEn: "Nylon belt pouch",
        valueAr: "حقيبة حزام نايلون",
        displayOrder: 4,
      },
    ],
    images: [
      {
        filename: "multi-tool-01.jpg",
        altEn: "Field multi-tool plier and blade",
        altAr: "أداة ميدان متعددة الوظائف",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },

  {
    sku: "FEN-FLD-LTE",
    nameEn: "Fennick Lite Folding Knife",
    nameAr: "سكين فينيك لايت القابلة للطي",
    slugEn: "fennick-lite-folding",
    brand: "Fennick Outdoor",
    actionType: "N/A",
    caliberMm: null,
    descriptionEn:
      "3\" drop point blade in stainless steel. Open-frame stainless handle. Lightweight everyday knife for hunting and field use.",
    descriptionAr:
      "نصل 3\" بنقطة منخفضة من الفولاذ المقاوم للصدأ. مقبض فولاذي بإطار مفتوح. سكين خفيفة للاستخدام اليومي في الصيد والميدان.",
    categoryEn: "Knives",
    price: 95,
    stockQuantity: 35,
    requiresIdVerification: false,
    supportsAddons: false,
    b2bAvailable: false,
    sortOrder: 1030,
    specs: [
      {
        labelEn: "Blade Length",
        labelAr: "طول النصل",
        valueEn: '3.0" (76mm)',
        valueAr: '3.0" (76 ملم)',
        displayOrder: 1,
      },
      {
        labelEn: "Blade Steel",
        labelAr: "فولاذ النصل",
        valueEn: "7Cr17MoV Stainless",
        valueAr: "7Cr17MoV مقاوم للصدأ",
        displayOrder: 2,
      },
      {
        labelEn: "Lock Type",
        labelAr: "نوع القفل",
        valueEn: "Frame lock",
        valueAr: "قفل الإطار",
        displayOrder: 3,
      },
      {
        labelEn: "Weight",
        labelAr: "الوزن",
        valueEn: "78g",
        valueAr: "78 جرام",
        displayOrder: 4,
      },
    ],
    images: [
      {
        filename: "fen-fld-lte-01.jpg",
        altEn: "Fennick Lite Folding Knife",
        altAr: "سكين فينيك لايت القابلة للطي",
        displayOrder: 1,
      },
    ],
    accessorySkus: [],
  },
];

// ─── PRE-FLIGHT VALIDATOR ─────────────────────────────────────────────────────
// Runs before any DB writes. Catches mismatched categoryEn references,
// duplicate SKUs, missing required fields, and broken accessory references.

function validateSeedData() {
  const categoryNames = new Set(CATEGORIES.map((c) => c.nameEn));
  const accessorySkuSet = new Set(ACCESSORIES.map((a) => a.sku));
  const skus = new Set<string>();
  const slugs = new Set<string>();
  const errors: string[] = [];

  for (const p of PRODUCTS) {
    if (!categoryNames.has(p.categoryEn)) {
      errors.push(
        `Product ${p.sku}: categoryEn "${p.categoryEn}" not found in CATEGORIES`,
      );
    }
    if (skus.has(p.sku)) {
      errors.push(`Duplicate SKU: ${p.sku}`);
    }
    skus.add(p.sku);
    if (slugs.has(p.slugEn)) {
      errors.push(`Duplicate slugEn: ${p.slugEn}`);
    }
    slugs.add(p.slugEn);
    if (!p.nameEn || !p.nameAr || !p.slugEn || !p.brand) {
      errors.push(
        `Product ${p.sku}: missing required field (nameEn/nameAr/slugEn/brand)`,
      );
    }
    for (const accessorySku of p.accessorySkus ?? []) {
      if (!accessorySkuSet.has(accessorySku)) {
        errors.push(
          `Product ${p.sku}: accessory "${accessorySku}" not found in ACCESSORIES`,
        );
      }
      if (accessorySku === p.sku) {
        errors.push(`Product ${p.sku}: lists itself as an accessory`);
      }
    }
  }

  const accessorySkus = new Set<string>();
  const accessorySlugs = new Set<string>();
  for (const a of ACCESSORIES) {
    if (accessorySkus.has(a.sku)) {
      errors.push(`Duplicate accessory SKU: ${a.sku}`);
    }
    accessorySkus.add(a.sku);
    if (skus.has(a.sku)) {
      errors.push(`Accessory ${a.sku}: SKU is also used by a product`);
    }
    const slug = toSlug(a.nameEn);
    if (accessorySlugs.has(slug)) {
      errors.push(`Duplicate accessory slugEn: ${slug}`);
    }
    accessorySlugs.add(slug);
    if (slugs.has(slug)) {
      errors.push(`Accessory ${a.sku}: slugEn "${slug}" is also used by a product`);
    }
  }

  // Check parent slugs exist
  const topLevelSlugs = new Set(
    CATEGORIES.filter((c) => !c.parentSlug).map((c) => c.slug),
  );
  for (const cat of CATEGORIES) {
    if (cat.parentSlug && !topLevelSlugs.has(cat.parentSlug)) {
      errors.push(
        `Category "${cat.nameEn}": parentSlug "${cat.parentSlug}" not found in top-level categories`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ Seed validation failed:");
    errors.forEach((e) => console.error(`   • ${e}`));
    throw new Error(`Seed validation failed with ${errors.length} error(s)`);
  }

  console.log(
    `   ✅ Validation passed — ${PRODUCTS.length} products, ${CATEGORIES.length} categories, ${ACCESSORIES.length} accessories`,
  );
}

// ─── MAIN SEEDER ──────────────────────────────────────────────────────────────

async function upsertCategoryBySlug(
  db: PrismaClient,
  slug: string,
  fields: {
    nameEn: string;
    nameAr: string;
    nameRu: string | null;
    displayOrder: number;
    parentId?: string;
    imageFilename: string | null;
    storageKey: string | null;
    isVisible: boolean;
    navGroup?: NavGroup | null;
  },
) {
  const existing = await db.category.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    return db.category.update({ where: { id: existing.id }, data: fields });
  }
  return db.category.create({ data: { slug, ...fields } });
}

// ─── MAIN SEEDER ──────────────────────────────────────────────────────────────
export async function seedCatalog(db: PrismaClient) {
  logSection(`${BRAND.name} — Catalog Seed`);

  // ── 0. Validate before any writes ────────────────────────────────────────
  log("🔍", "Validating seed data…");
  validateSeedData();

  // ── 1. Categories ─────────────────────────────────────────────────────────
  log("📂", "Seeding categories…");

  // Build a slug→id map after upserting all categories.
  // We upsert in two passes: top-level first (no parent), then sub-categories.

  const topLevelCats = CATEGORIES.filter((c) => !c.parentSlug);
  const subCats = CATEGORIES.filter((c) => !!c.parentSlug);

  for (const cat of topLevelCats) {
    await upsertCategoryBySlug(db, cat.slug, {
      nameEn: cat.nameEn,
      nameAr: cat.nameAr,
      nameRu: null,
      displayOrder: cat.displayOrder,
      imageFilename: cat.imageFilename ?? null,
      storageKey: cat.imageFilename
        ? categoryStorageKey(cat.slug, cat.imageFilename)
        : null,
      isVisible: true,
      navGroup: cat.navGroup ?? null,
    });
  }

  // Build parent slug→id map
  const parentMap = new Map<string, string>();
  const allTopLevel = await db.category.findMany({ where: { parentId: null } });
  for (const c of allTopLevel) parentMap.set(c.slug, c.id);

  for (const cat of subCats) {
    const parentId = parentMap.get(cat.parentSlug!);
    if (!parentId)
      throw new Error(`Parent not found for subcategory: ${cat.slug}`);
    await upsertCategoryBySlug(db, cat.slug, {
      nameEn: cat.nameEn,
      nameAr: cat.nameAr,
      nameRu: null,
      displayOrder: cat.displayOrder,
      parentId,
      imageFilename: cat.imageFilename ?? null,
      storageKey: cat.imageFilename
        ? categoryStorageKey(cat.slug, cat.imageFilename)
        : null,
      isVisible: true,
    });
  }

  logDone("categories", CATEGORIES.length);

  // Build categoryName→id map for product seeding
  const categoryNameToId = new Map<string, string>();
  const categorySlugToId = new Map<string, string>();
  const allCats = await db.category.findMany();
  for (const c of allCats) {
    categoryNameToId.set(c.nameEn, c.id);
    if (c.deletedAt === null) categorySlugToId.set(c.slug, c.id);
  }

  // ── 1b. Brands ────────────────────────────────────────────────────────────
  log("🏷️", "Seeding brands…");

  const brandNames = [
    ...new Set(["Generic", ...PRODUCTS.map((p) => p.brand)]),
  ];
  const brandNameToId = new Map<string, string>();
  for (const nameEn of brandNames) {
    const sameName = await db.brand.findFirst({
      where: { nameEn: { equals: nameEn.trim(), mode: "insensitive" }, deletedAt: null },
      select: { id: true },
    });
    if (sameName) {
      brandNameToId.set(nameEn, sameName.id);
      continue;
    }
    const slug = slugFromName(nameEn);
    const brand = await db.brand.upsert({
      where: { slug },
      create: { nameEn, slug },
      update: {},
      select: { id: true },
    });
    brandNameToId.set(nameEn, brand.id);
  }
  logDone("brands", brandNames.length);

  // ── 2. Accessories (products) ─────────────────────────────────────────────
  log("🔩", "Seeding accessories…");

  const OPTICS_ACCESSORIES = new Set(["ADN-001", "ADN-002", "ADN-006", "ADN-007"]);
  const SPARE_PART_ACCESSORIES = new Set([
    "ADN-008",
    "ADN-009",
    "ADN-013",
    "ADN-015",
    "ADN-018",
    "ADN-019",
    "ADN-020",
  ]);

  for (const acc of ACCESSORIES) {
    const categorySlug = OPTICS_ACCESSORIES.has(acc.sku)
      ? "scopes-optics"
      : SPARE_PART_ACCESSORIES.has(acc.sku)
        ? "spare-parts"
        : "accessories";
    const categoryId = categorySlugToId.get(categorySlug);
    if (!categoryId) {
      throw new Error(`Category not found for accessory ${acc.sku}: "${categorySlug}"`);
    }

    const fields = {
      nameEn: acc.nameEn,
      nameAr: acc.nameAr,
      nameRu: null,
      slugEn: toSlug(acc.nameEn),
      brandId: brandNameToId.get("Generic")!,
      actionType: toActionType("N/A"),
      descriptionEn: acc.descriptionEn ?? null,
      descriptionAr: null,
      descriptionRu: null,
      categoryId,
      price: decRequired(acc.price),
      compareAtPrice: dec(acc.compareAtPrice ?? null),
      stockQuantity: acc.stockQuantity,
      requiresIdVerification: false,
      supportsAddons: false,
      b2bAvailable: false,
      minOrderQty: 1,
      isNewArrival: false,
      isFeatured: false,
      publishStatus: toPublishStatus("PUBLISHED"),
      loyaltyPointsEarn: 0,
    };

    await db.product.upsert({
      where: { sku: acc.sku },
      update: fields,
      create: { sku: acc.sku, reservedQuantity: 0, ...fields },
    });
  }

  logDone("accessories", ACCESSORIES.length);

  // ── 3. Products ───────────────────────────────────────────────────────────
  log("🔫", "Seeding products…");

  for (const p of PRODUCTS) {
    const categoryId = categoryNameToId.get(p.categoryEn);
    if (!categoryId)
      throw new Error(`Category not found at runtime: "${p.categoryEn}"`);

    const price = p.price;
    const fixedPoints =
      p.loyaltyOverride != null && p.loyaltyOverride > 0 ? p.loyaltyOverride : 0;

    // Upsert product
    await db.product.upsert({
      where: { sku: p.sku },
      update: {
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        nameRu: null,
        slugEn: p.slugEn,
        brandId: brandNameToId.get(p.brand)!,
        actionType: toActionType(p.actionType),
        caliberMm: p.caliberMm != null ? dec(p.caliberMm) : null,
        descriptionEn: p.descriptionEn ?? null,
        descriptionAr: p.descriptionAr ?? null,
        descriptionRu: null,
        categoryId,
        price: decRequired(price),
        compareAtPrice: dec(p.compareAtPrice ?? null),
        stockQuantity: p.stockQuantity,
        lowStockThreshold: p.lowStockThreshold ?? 5,
        weightGrams: p.weightGrams ?? null,
        requiresIdVerification: p.requiresIdVerification,
        serialTracking: p.requiresIdVerification ? "SERIAL" : "NONE",
        supportsAddons: p.supportsAddons,
        b2bAvailable: p.b2bAvailable,
        minOrderQty: p.minOrderQty ?? 1,
        maxOrderQty: p.maxOrderQty ?? null,
        isNewArrival: p.isNewArrival ?? false,
        isFeatured: p.isFeatured ?? false,
        sortOrder: p.sortOrder ?? null,
        publishStatus: toPublishStatus(p.publishStatus ?? "PUBLISHED"),
        loyaltyPointsEarn: fixedPoints,
        loyaltyRule: fixedPoints > 0 ? "FIXED" : "STANDARD",
        loyaltyMultiplier: null,
        loyaltyRuleStartsAt: null,
        loyaltyRuleEndsAt: null,
        metaTitleEn: autoMetaTitle(p.nameEn),
        metaTitleAr: autoMetaTitle(p.nameAr),
        metaTitleRu: null,
        metaDescriptionEn: autoMetaDesc(p.descriptionEn),
        metaDescriptionAr: autoMetaDesc(p.descriptionAr),
        metaDescriptionRu: null,
      },
      create: {
        sku: p.sku,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        nameRu: null,
        slugEn: p.slugEn,
        brandId: brandNameToId.get(p.brand)!,
        actionType: toActionType(p.actionType),
        caliberMm: p.caliberMm != null ? dec(p.caliberMm) : null,
        descriptionEn: p.descriptionEn ?? null,
        descriptionAr: p.descriptionAr ?? null,
        descriptionRu: null,
        categoryId,
        price: decRequired(price),
        compareAtPrice: dec(p.compareAtPrice ?? null),
        stockQuantity: p.stockQuantity,
        reservedQuantity: 0,
        lowStockThreshold: p.lowStockThreshold ?? 5,
        weightGrams: p.weightGrams ?? null,
        requiresIdVerification: p.requiresIdVerification,
        serialTracking: p.requiresIdVerification ? "SERIAL" : "NONE",
        supportsAddons: p.supportsAddons,
        b2bAvailable: p.b2bAvailable,
        minOrderQty: p.minOrderQty ?? 1,
        maxOrderQty: p.maxOrderQty ?? null,
        isNewArrival: p.isNewArrival ?? false,
        isFeatured: p.isFeatured ?? false,
        sortOrder: p.sortOrder ?? null,
        publishStatus: toPublishStatus(p.publishStatus ?? "PUBLISHED"),
        loyaltyPointsEarn: fixedPoints,
        loyaltyRule: fixedPoints > 0 ? "FIXED" : "STANDARD",
        loyaltyMultiplier: null,
        loyaltyRuleStartsAt: null,
        loyaltyRuleEndsAt: null,
        metaTitleEn: autoMetaTitle(p.nameEn),
        metaTitleAr: autoMetaTitle(p.nameAr),
        metaTitleRu: null,
        metaDescriptionEn: autoMetaDesc(p.descriptionEn),
        metaDescriptionAr: autoMetaDesc(p.descriptionAr),
        metaDescriptionRu: null,
      },
    });

    // ── 3a. Product images ─────────────────────────────────────────────────
    for (const img of p.images) {
      await db.productImage.upsert({
        where: {
          productSku_displayOrder: {
            productSku: p.sku,
            displayOrder: img.displayOrder,
          },
        },
        update: {
          filename: img.filename,
          storageKey: productStorageKey(p.sku, img.filename),
          altTextEn: img.altEn,
          altTextAr: img.altAr,
          altTextRu: null,
        },
        create: {
          productSku: p.sku,
          filename: img.filename,
          storageKey: productStorageKey(p.sku, img.filename),
          altTextEn: img.altEn,
          altTextAr: img.altAr,
          altTextRu: null,
          displayOrder: img.displayOrder,
        },
      });
    }

    // ── 3b. Product specs ──────────────────────────────────────────────────
    for (const spec of p.specs) {
      await db.productSpec.upsert({
        where: {
          productSku_labelEn: { productSku: p.sku, labelEn: spec.labelEn },
        },
        update: {
          labelAr: spec.labelAr,
          labelRu: null,
          valueEn: spec.valueEn,
          valueAr: spec.valueAr,
          valueRu: null,
          displayOrder: spec.displayOrder,
        },
        create: {
          productSku: p.sku,
          labelEn: spec.labelEn,
          labelAr: spec.labelAr,
          labelRu: null,
          valueEn: spec.valueEn,
          valueAr: spec.valueAr,
          valueRu: null,
          displayOrder: spec.displayOrder,
        },
      });
    }

  }

  logDone("products", PRODUCTS.length);

  // ── 3c. Accessory links ───────────────────────────────────────────────────
  log("🔗", "Linking accessories…");

  let accessoryLinks = 0;
  for (const p of PRODUCTS) {
    if (!p.supportsAddons) continue;
    const list = p.accessorySkus ?? [];
    for (let i = 0; i < list.length; i++) {
      await db.productAccessory.upsert({
        where: {
          productSku_accessorySku: { productSku: p.sku, accessorySku: list[i] },
        },
        update: { displayOrder: i + 1 },
        create: { productSku: p.sku, accessorySku: list[i], displayOrder: i + 1 },
      });
      accessoryLinks++;
    }
  }

  logDone("accessory links", accessoryLinks);

  // ── Summary ────────────────────────────────────────────────────────────────
  logSection("Catalog seed complete");
  log("✅", `${CATEGORIES.length} categories`);
  log("✅", `${ACCESSORIES.length} accessories (ADN-001 → ADN-020)`);
  log("✅", `${PRODUCTS.length} products`);
}
