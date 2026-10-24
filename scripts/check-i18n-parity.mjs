import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.join(__dirname, "..", "messages");

const LOCALES = ["en", "ru", "ar"];
const REFERENCE_LOCALE = "en";

function loadCatalog(locale) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function collectLeafKeys(value, prefix, keys) {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    for (const [key, child] of Object.entries(value)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      collectLeafKeys(child, nextPrefix, keys);
    }
  } else {
    keys.add(prefix);
  }
  return keys;
}

function diffSets(a, b) {
  const result = [];
  for (const item of a) {
    if (!b.has(item)) result.push(item);
  }
  return result.sort();
}

const catalogs = {};
for (const locale of LOCALES) {
  catalogs[locale] = loadCatalog(locale);
}

const keySets = {};
for (const locale of LOCALES) {
  keySets[locale] = collectLeafKeys(catalogs[locale], "", new Set());
}

const referenceKeys = keySets[REFERENCE_LOCALE];
let hasDiscrepancy = false;
const report = [];

for (const locale of LOCALES) {
  if (locale === REFERENCE_LOCALE) continue;
  const localeKeys = keySets[locale];
  const missing = diffSets(referenceKeys, localeKeys);
  const extra = diffSets(localeKeys, referenceKeys);
  if (missing.length > 0 || extra.length > 0) {
    hasDiscrepancy = true;
  }
  report.push({ locale, missing, extra });
}

console.log(`Reference locale: ${REFERENCE_LOCALE} (${referenceKeys.size} keys)`);
for (const locale of LOCALES) {
  console.log(`  ${locale}: ${keySets[locale].size} keys`);
}
console.log("");

if (hasDiscrepancy) {
  for (const { locale, missing, extra } of report) {
    console.log(`Locale: ${locale}`);
    if (missing.length > 0) {
      console.log(`  Missing (${missing.length}) — present in ${REFERENCE_LOCALE}, absent in ${locale}:`);
      for (const key of missing) {
        console.log(`    - ${key}`);
      }
    }
    if (extra.length > 0) {
      console.log(`  Extra (${extra.length}) — present in ${locale}, absent in ${REFERENCE_LOCALE}:`);
      for (const key of extra) {
        console.log(`    - ${key}`);
      }
    }
    if (missing.length === 0 && extra.length === 0) {
      console.log("  OK");
    }
    console.log("");
  }
  process.exit(1);
} else {
  console.log(`i18n parity OK — ${referenceKeys.size} keys × ${LOCALES.length} locales`);
  process.exit(0);
}
