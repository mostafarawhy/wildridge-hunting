import { UAE_EMIRATES } from "@/lib/constants";

const SA_REGIONS = [
  "Asir Region",
  "Al Bahah Region",
  "Northern Borders Region",
  "Al Jawf Region",
  "Medina Region",
  "Qassim Region",
  "Riyadh Region",
  "Eastern Province",
  "Hail Region",
  "Jazan Region",
  "Mecca Region",
  "Najran Region",
  "Tabuk Region",
] as const satisfies readonly string[];

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const satisfies readonly string[];

const SUBDIVISIONS: Record<string, readonly string[]> = {
  AE: UAE_EMIRATES,
  SA: SA_REGIONS,
  US: US_STATES,
};

export function getSubdivisions(code: string): readonly string[] | null {
  return SUBDIVISIONS[code] ?? null;
}

export function getSubdivisionLabelKey(code: string): string {
  switch (code) {
    case "AE":
      return "checkout.billing.subdivisionEmirate";
    case "SA":
      return "checkout.billing.subdivisionRegion";
    case "US":
      return "checkout.billing.subdivisionState";
    default:
      return "checkout.billing.subdivisionGeneric";
  }
}
