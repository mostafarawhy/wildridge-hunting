/* Template download temporarily disabled on purpose (2026-10-09). */
import { BRAND } from "@/lib/config/brand";
/* import {
  CATALOG_TEMPLATE_DOWNLOAD_NAME,
  CATALOG_TEMPLATE_PATH,
} from "@/lib/utils/catalog-import"; */

const PRIMARY = "#0b0b0b";
const SECONDARY = "#4b4b4b";
const GREEN = "#166534";
const RED = "#991b1b";

const eyebrow: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-action-primary)",
  margin: 0,
};

const accepted: React.ReactNode[] = [
  "A SKU that isn’t in the store yet creates a new product. Required for new products: SKU, category, brand, name in English and Arabic, mechanism, price, and ID verification required (YES or NO).",
  "A SKU that already exists updates that product. Fill only the cells you want to change; empty cells keep the current value.",
  "New products are saved as Draft unless you set a status (DRAFT, PUBLISHED or ARCHIVED).",
  "Listing a product on the Specs sheet replaces its whole spec table with the rows you give, at most 40 per product.",
  "Images: select the image files together with the workbook (JPG, PNG or WebP, 5 MB each). Listing a product on the Images sheet replaces its whole gallery with your rows: at most 8, and position 1 is the main image.",
  "Images already in a product's gallery don't need selecting again. To replace a photo, give the new file a new name.",
  "Listing a product on the Accessory_Links sheet replaces its whole accessory list with your rows, in the order you give. Products you don't list keep their accessories.",
  "An accessory can be any product outside the rifles and pistols categories, including one created on the Products sheet in the same file.",
  "Opening stock is read for new products only.",
  "Loyalty rule: Standard, Boosted, Fixed or No points. Boosted needs a multiplier from 1.1 to 10. Fixed needs whole points per unit from 1 to 100,000. Rule starts and Rule ends are optional Dubai dates for Boosted or Fixed. An empty cell keeps the current value, and a rule clears the values it does not use.",
  "Numbers as plain digits, such as 850 or 2599.50. YES and NO in any letter case.",
  "Categories by their slug, as listed on the template’s Categories sheet.",
  "Brand must be a brand in Catalog › Brands: its English, Arabic or Russian name, or its web handle. Add a new brand there before importing.",
  "One .xlsx file of up to 4 MB, with at most 2,000 products and 5,000 rows on any other sheet.",
];

const refused: React.ReactNode[] = [
  `Any file other than the ${BRAND.name} catalog import template in .xlsx: files made from an older import template, CSV files, renamed sheets or misspelled column names.`,
  "Currency, commas or units typed into a number cell, such as “AED 850”, “1,200” or “5.5mm”.",
  "A SKU listed twice, a SKU that differs from an existing one only by capital letters, or the SKU of a deleted product.",
  "A category that doesn’t exist yet. Add it in Catalog › Categories first.",
  "A web address (slug) already used by another product.",
  "A calibre of 0 (leave it empty when calibre doesn’t apply), or a was-price that isn’t higher than the price.",
  "A missing required cell on a new product, or a spec row without its English and Arabic label and value.",
  "An Images row whose file wasn’t selected, a file whose content doesn’t match its name, or a position outside 1–8 or used twice for one product.",
  "An Accessory_Links row that links a product to itself, to a rifle or pistol, or to the same accessory twice.",
];

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div
        style={{
          width: "2rem",
          height: "2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PRIMARY,
          color: "#ffffff",
          fontWeight: "var(--font-bold)",
        }}
      >
        {n}
      </div>
      <p
        style={{
          margin: 0,
          fontWeight: "var(--font-semibold)",
          color: PRIMARY,
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-body-sm)",
          lineHeight: 1.6,
          color: SECONDARY,
        }}
      >
        {children}
      </p>
    </div>
  );
}

function Rules({
  title,
  color,
  glyph,
  items,
}: {
  title: string;
  color: string;
  glyph: string;
  items: React.ReactNode[];
}) {
  return (
    <div>
      <p style={{ ...eyebrow, color }}>{title}</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: "0.5rem",
              marginTop: "0.5rem",
              fontSize: "var(--text-body-sm)",
              lineHeight: 1.55,
              color: PRIMARY,
            }}
          >
            <span
              aria-hidden="true"
              style={{ flexShrink: 0, fontWeight: "var(--font-bold)", color }}
            >
              {glyph}
            </span>
            <span style={{ color: PRIMARY }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CatalogImportGuide() {
  return (
    <details
      open
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        padding: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          color: PRIMARY,
        }}
      >
        <span style={eyebrow}>How catalog import works</span>
        <span style={{ fontSize: "var(--text-body-sm)", color: SECONDARY }}>
          Show or hide the guide
        </span>
      </summary>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
          gap: "1rem",
          marginTop: "1.25rem",
        }}
      >
        <Step n={1} title="Start from the template">
          Always start from the import template. It has dropdowns, built-in
          checks and a guide to every column. Don&apos;t rename sheets or change
          row 1. The download is switched off for now; ask your administrator
          for a copy.{" "}
          {/* Template download temporarily disabled on purpose (2026-10-09). */}
          {/* <a
            href={CATALOG_TEMPLATE_PATH}
            download={CATALOG_TEMPLATE_DOWNLOAD_NAME}
            style={{
              color: PRIMARY,
              textDecoration: "underline",
              fontWeight: "var(--font-semibold)",
            }}
          >
            Download the import template
          </a> */}
        </Step>
        <Step n={2} title="Fill in your rows">
          One product per row on the Products sheet, starting at row 4.
          Specifications go on the Specs sheet, one row per line of the spec
          table. Accessories go on the Accessory_Links sheet, one row per
          accessory. Before uploading, open the Checks sheet: every line should
          say PASS.
        </Step>
        <Step n={3} title="Check the file">
          Upload the file and click Check file. Nothing is saved. You&apos;ll
          see what will be created, updated or left unchanged, and every problem
          with its sheet, row and column. Download the problem report, fix the
          file, save it and check it again.
        </Step>
        <Step n={4} title="Review and commit">
          When there are no problems, review the changes and click Commit
          import. Everything is saved together, or nothing is. The import is
          recorded in the history and the audit log under your name. A private
          copy of the file is kept with the import, and a refused commit is
          recorded too, so every attempt can be traced.
        </Step>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
          gap: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
        <Rules title="Accepted" color={GREEN} glyph={"✓"} items={accepted} />
        <Rules
          title="Refused, with an explanation"
          color={RED}
          glyph={"✕"}
          items={refused}
        />
      </div>

      <div
        style={{
          marginTop: "1.5rem",
          borderInlineStart: "3px solid var(--color-shop-divider)",
          paddingInlineStart: "0.75rem",
        }}
      >
        <p
          style={{
            margin: 0,
            fontWeight: "var(--font-bold)",
            color: PRIMARY,
          }}
        >
          Import never:
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-body-sm)",
            lineHeight: 1.6,
            color: SECONDARY,
          }}
        >
          deletes or archives products that aren&apos;t in the file · clears a
          value (edit the product to remove one) · changes the stock of an
          existing product (use its Inventory panel) · creates categories.
        </p>
      </div>

      <p
        style={{
          margin: "0.75rem 0 0",
          fontSize: "var(--text-body-sm)",
          color: SECONDARY,
        }}
      >
        Not sure what a column means? The Column_Guide sheet in the template
        explains every column, and row 3 of each sheet shows its rule.
      </p>
    </details>
  );
}
