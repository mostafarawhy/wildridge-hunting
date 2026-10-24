import "server-only";
import { db } from "@/lib/db/client";
import {
  STORE_DAYS,
  readStoreHours,
  type StoreDay,
  type StoreHours,
} from "@/lib/utils/stores";

export interface AdminStoreListItem {
  id: string;
  nameEn: string;
  addressEn: string;
  isActive: boolean;
  isPrimary: boolean;
  displayOrder: number;
}

export async function getAdminStoreList(): Promise<AdminStoreListItem[]> {
  return db.store.findMany({
    orderBy: [
      { isPrimary: "desc" },
      { displayOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      nameEn: true,
      addressEn: true,
      isActive: true,
      isPrimary: true,
      displayOrder: true,
    },
  });
}

export type StoreHoursFormState = Record<
  StoreDay,
  { closed: boolean; open: string; close: string }
>;

export interface AdminStoreDetail {
  id: string;
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
  addressEn: string;
  addressAr: string | null;
  addressRu: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  hoursNoteEn: string | null;
  hoursNoteAr: string | null;
  hoursNoteRu: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isPrimary: boolean;
  displayOrder: number;
  pin: string;
  showHours: boolean;
  hours: StoreHoursFormState;
}

export async function getAdminStoreForEdit(
  id: string,
): Promise<AdminStoreDetail | null> {
  const store = await db.store.findUnique({ where: { id } });
  if (!store) return null;

  const parsedHours = readStoreHours(store.openingHours);

  const hours = STORE_DAYS.reduce((acc, day) => {
    const dayHours = parsedHours?.[day] ?? null;
    acc[day] = dayHours
      ? { closed: false, open: dayHours.open, close: dayHours.close }
      : { closed: true, open: "", close: "" };
    return acc;
  }, {} as StoreHoursFormState);

  return {
    id: store.id,
    nameEn: store.nameEn,
    nameAr: store.nameAr,
    nameRu: store.nameRu,
    addressEn: store.addressEn,
    addressAr: store.addressAr,
    addressRu: store.addressRu,
    descriptionEn: store.descriptionEn,
    descriptionAr: store.descriptionAr,
    descriptionRu: store.descriptionRu,
    hoursNoteEn: store.hoursNoteEn,
    hoursNoteAr: store.hoursNoteAr,
    hoursNoteRu: store.hoursNoteRu,
    latitude: store.latitude,
    longitude: store.longitude,
    phone: store.phone,
    email: store.email,
    isActive: store.isActive,
    isPrimary: store.isPrimary,
    displayOrder: store.displayOrder,
    pin: `${store.latitude}, ${store.longitude}`,
    showHours: parsedHours != null,
    hours,
  };
}

export interface PublicStore {
  id: string;
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
  addressEn: string;
  addressAr: string | null;
  addressRu: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  hoursNoteEn: string | null;
  hoursNoteAr: string | null;
  hoursNoteRu: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  hours: StoreHours | null;
}

function toPublicStore(store: {
  id: string;
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
  addressEn: string;
  addressAr: string | null;
  addressRu: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  hoursNoteEn: string | null;
  hoursNoteAr: string | null;
  hoursNoteRu: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  openingHours: unknown;
}): PublicStore {
  return {
    id: store.id,
    nameEn: store.nameEn,
    nameAr: store.nameAr,
    nameRu: store.nameRu,
    addressEn: store.addressEn,
    addressAr: store.addressAr,
    addressRu: store.addressRu,
    descriptionEn: store.descriptionEn,
    descriptionAr: store.descriptionAr,
    descriptionRu: store.descriptionRu,
    hoursNoteEn: store.hoursNoteEn,
    hoursNoteAr: store.hoursNoteAr,
    hoursNoteRu: store.hoursNoteRu,
    latitude: store.latitude,
    longitude: store.longitude,
    phone: store.phone,
    email: store.email,
    isPrimary: store.isPrimary,
    hours: readStoreHours(store.openingHours),
  };
}

export async function getActiveStores(): Promise<PublicStore[]> {
  const rows = await db.store.findMany({
    where: { isActive: true },
    orderBy: [
      { isPrimary: "desc" },
      { displayOrder: "asc" },
      { createdAt: "asc" },
    ],
  });
  return rows.map(toPublicStore);
}

export async function getPrimaryStore(): Promise<PublicStore | null> {
  const row = await db.store.findFirst({
    where: { isPrimary: true, isActive: true },
  });
  return row ? toPublicStore(row) : null;
}
