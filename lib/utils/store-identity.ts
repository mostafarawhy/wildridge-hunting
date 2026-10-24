import { BRAND } from "@/lib/config/brand";
import "server-only";
import { getSetting } from "@/lib/db/queries/settings";

export interface StoreIdentity {
  name: string;
  addressLine: string | null;
  email: string | null;
  phone: string | null;
  trn: string | null;
  vatRate: number;
  taxInvoice: boolean;
  legalNameEn: string | null;
  legalNameAr: string | null;
  registeredAddressEn: string | null;
  registeredAddressAr: string | null;
  tradeLicenceNo: string | null;
  licensingAuthority: string | null;
  invoiceNote: string | null;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function getStoreIdentity(): Promise<StoreIdentity> {
  const [profile, tax, legal] = await Promise.all([
    getSetting("store_profile"),
    getSetting("tax_config"),
    getSetting("legal_details"),
  ]);
  const trimmedTrn = tax.storeTrn.trim();
  const trn = /^\d{15}$/.test(trimmedTrn) ? trimmedTrn : null;
  return {
    name: blankToNull(profile.storeName) ?? BRAND.name,
    addressLine: blankToNull(profile.addressLine),
    email: blankToNull(profile.contactEmail),
    phone: blankToNull(profile.contactPhone),
    trn,
    vatRate: tax.vatRate,
    taxInvoice: trn !== null && tax.vatRate > 0,
    legalNameEn: blankToNull(legal.legalNameEn),
    legalNameAr: blankToNull(legal.legalNameAr),
    registeredAddressEn: blankToNull(legal.registeredAddressEn),
    registeredAddressAr: blankToNull(legal.registeredAddressAr),
    tradeLicenceNo: blankToNull(legal.tradeLicenceNo),
    licensingAuthority: blankToNull(legal.licensingAuthority),
    invoiceNote: blankToNull(legal.invoiceNote),
  };
}
