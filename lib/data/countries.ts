import { continents, countries, type TContinentCode } from "countries-list";

export interface CountryOption {
  code: string;
  name: string;
  continent: TContinentCode;
  continentName: string;
}

export const CONTINENTS: Record<TContinentCode, string> = continents;

const CONTINENT_ORDER: TContinentCode[] = [
  "AS",
  "EU",
  "AF",
  "NA",
  "SA",
  "OC",
  "AN",
];

let cachedList: CountryOption[] | null = null;

export function getAllCountries(): CountryOption[] {
  if (cachedList) return cachedList;
  cachedList = (Object.keys(countries) as (keyof typeof countries)[])
    .map((code) => {
      const data = countries[code];
      return {
        code,
        name: data.name,
        continent: data.continent,
        continentName: continents[data.continent],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return cachedList;
}

export function isValidCountryCode(code: string): boolean {
  return code in countries;
}

export function getCountryName(code: string): string {
  const data = countries[code as keyof typeof countries];
  return data ? data.name : code;
}

export interface CountryContinentGroup {
  continent: TContinentCode;
  continentName: string;
  countries: CountryOption[];
}

export function groupByContinent(
  list: CountryOption[],
): CountryContinentGroup[] {
  const map = new Map<TContinentCode, CountryOption[]>();
  for (const c of list) {
    const arr = map.get(c.continent) ?? [];
    arr.push(c);
    map.set(c.continent, arr);
  }
  return CONTINENT_ORDER.filter((cont) => map.has(cont)).map((cont) => ({
    continent: cont,
    continentName: continents[cont],
    countries: (map.get(cont) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}
