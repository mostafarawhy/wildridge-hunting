import { BRAND } from "@/lib/config/brand";
import BrandMark from "@/components/ui/BrandMark";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { getCountryName } from "@/lib/data/countries";
import type { OrderConfirmationProjection } from "@/lib/db/queries/order";
import type { StoreIdentity } from "@/lib/utils/store-identity";
import type { ShippingAddressSnapshot } from "@/types/order";

interface Props {
  order: OrderConfirmationProjection;
  store: StoreIdentity;
  locale: "en" | "ar" | "ru";
}

const EYEBROW =
  "text-[0.6875rem] font-bold tracking-[0.16em] uppercase text-neutral-500 rtl:tracking-normal rtl:normal-case";

export default async function ReceiptDocument({ order, store, locale }: Props) {
  const t = await getTranslations("checkout.receipt");
  const ts = await getTranslations("checkout.success");
  const tc = await getTranslations("checkout");
  const tNav = await getTranslations("nav");

  const title = store.taxInvoice ? t("taxInvoice") : t("title");
  const taxAed = order.taxAmountAed;
  const effectiveRate = Math.round(order.vatRate * 100);

  const productItems = order.items.filter((i) => i.itemType === "PRODUCT");
  const addonItems = order.items.filter((i) => i.itemType === "ADDON");

  const shippingMethodName = order.shippingMethod
    ? locale === "ar"
      ? order.shippingMethod.nameAr
      : locale === "ru"
        ? (order.shippingMethod.nameRu ?? order.shippingMethod.nameEn)
        : order.shippingMethod.nameEn
    : null;

  const lastSettlement = order.settlements[order.settlements.length - 1];
  const paidOnIso = order.paidAt ?? lastSettlement?.paidAt ?? null;

  const paymentLabel =
    order.paymentProvider === "NGENIUS"
      ? t("paymentCard")
      : t("paymentOffline");

  const billTo = order.billingAddress ?? order.shippingAddress;
  const shipTo = order.shippingAddress;

  const contactLine = [store.email, store.phone].filter(Boolean).join(" · ");

  const isArabic = locale === "ar";
  const sellerName =
    (isArabic ? (store.legalNameAr ?? store.legalNameEn) : store.legalNameEn) ??
    store.name;
  const sellerAddress =
    (isArabic
      ? (store.registeredAddressAr ?? store.registeredAddressEn)
      : store.registeredAddressEn) ?? store.addressLine;

  const businessBuyer = order.businessBuyer;
  const buyerName = businessBuyer
    ? isArabic
      ? (businessBuyer.nameAr ?? businessBuyer.nameEn)
      : businessBuyer.nameEn
    : null;

  const discountLabel = order.couponCode
    ? `${ts("discount")} · ${order.couponCode}`
    : ts("discount");
  const pointsLabel = `${ts("points")} · ${order.loyaltyPointsUsed.toLocaleString("en-US")}`;
  const shippingLabel = shippingMethodName
    ? `${ts("shipping")} · ${shippingMethodName}`
    : ts("shipping");

  const taxRows = store.taxInvoice
    ? buildTaxInvoiceRows({
        products: productItems,
        addons: addonItems,
        rate: effectiveRate / 100,
        discountFils: Math.round(order.discountAmountAed * 100),
        discountLabel,
        pointsFils: Math.round(order.loyaltyDiscountAmountAed * 100),
        pointsLabel,
        shippingFils: Math.round(order.shippingCostAed * 100),
        shippingLabel,
        taxFils: Math.round(taxAed * 100),
        totalFils: Math.round(order.totalAed * 100),
      })
    : null;
  const totalExVatAed =
    (Math.round(order.totalAed * 100) - Math.round(taxAed * 100)) / 100;

  const renderAddress = (address: ShippingAddressSnapshot) => (
    <p className="text-[0.8125rem] text-neutral-700 leading-relaxed">
      <span className="font-bold text-neutral-900">{address.fullName}</span>
      <br />
      {address.addressLine1}
      {address.addressLine2 && <>, {address.addressLine2}</>}
      <br />
      {address.city}, {address.emirate}
      {address.postalCode && <> {address.postalCode}</>}
      <br />
      {getCountryName(address.country)}
    </p>
  );

  return (
    <table className="block w-full print:table">
      <thead className="hidden print:table-header-group">
        <tr>
          <td>
            <div className="h-[14mm]" />
          </td>
        </tr>
      </thead>
      <tbody className="block print:table-row-group">
        <tr className="block print:table-row">
          <td className="block print:table-cell">
    <div className="py-10 px-4 print:p-0">
      <div className="bg-white text-[#0b0b0b] mx-auto w-full max-w-[210mm] px-[14mm] pb-[14mm] shadow-[0_1px_3px_rgba(0,0,0,0.08)] print:max-w-none print:px-[14mm] print:pb-0 print:shadow-none">
        <div className="h-1 bg-[var(--color-action-primary)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] mb-6" />

        <div className="flex justify-between items-start gap-6 mb-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-4 group"
              aria-label={tNav("aria_home")}
            >
              <BrandMark size={104} />
              <span
                dir="ltr"
                className="brand-wordmark brand-wordmark--checkout text-[var(--primitive-black)]"
              >
                {BRAND.wordmark}
              </span>
            </Link>
            <div className="text-[0.75rem] text-neutral-700 leading-relaxed mt-3">
              <p className="font-bold text-neutral-900">{sellerName}</p>
              {sellerAddress && (
                <p className="text-neutral-700">{sellerAddress}</p>
              )}
              {contactLine && <p className="text-neutral-700">{contactLine}</p>}
              {store.trn && (
                <p className="text-neutral-700">
                  {t("trn")}{" "}
                  <span dir="ltr" className="tabular-nums">
                    {store.trn}
                  </span>
                </p>
              )}
              {store.tradeLicenceNo && (
                <p className="text-neutral-700">
                  {t("tradeLicence")}{" "}
                  <span dir="ltr" className="tabular-nums">
                    {store.tradeLicenceNo}
                  </span>
                  {store.licensingAuthority && (
                    <> · {store.licensingAuthority}</>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="text-end">
            <p className="text-[1.5rem] font-bold text-neutral-900">{title}</p>
            {store.taxInvoice && (
              <p className="text-[0.875rem] text-neutral-700">
                {t("taxInvoiceAlt")}
              </p>
            )}
            <p
              dir="ltr"
              className="tabular-nums text-[0.75rem] text-neutral-600"
            >
              {order.orderNumber}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-4 border-y border-[var(--color-shop-divider)] py-3 mb-6">
          <div>
            <p className={EYEBROW}>{t("orderNumber")}</p>
            <p
              dir="ltr"
              className="text-[0.8125rem] text-neutral-900 tabular-nums text-start"
            >
              {order.orderNumber}
            </p>
          </div>
          <div>
            <p className={EYEBROW}>{t("orderDate")}</p>
            <p className="text-[0.8125rem] text-neutral-900">
              {formatDisplayDate(order.createdAt, locale)}
            </p>
          </div>
          <div>
            <p className={EYEBROW}>{t("paidOn")}</p>
            <p className="text-[0.8125rem] text-neutral-900">
              {paidOnIso ? formatDisplayDate(paidOnIso, locale) : ""}
            </p>
          </div>
          <div>
            <p className={EYEBROW}>{t("payment")}</p>
            <p className="text-[0.8125rem] text-neutral-900">{paymentLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className={EYEBROW + " mb-1.5"}>{t("billTo")}</p>
            {buyerName && (
              <p className="text-[0.8125rem] font-bold text-neutral-900 leading-relaxed">
                {buyerName}
              </p>
            )}
            {renderAddress(billTo)}
            {businessBuyer?.trn && (
              <p className="text-[0.75rem] text-neutral-700 leading-relaxed">
                {t("trn")}{" "}
                <span dir="ltr" className="tabular-nums">
                  {businessBuyer.trn}
                </span>
              </p>
            )}
            {businessBuyer?.tradeLicenceNo && (
              <p className="text-[0.75rem] text-neutral-700 leading-relaxed">
                {t("tradeLicence")}{" "}
                <span dir="ltr" className="tabular-nums">
                  {businessBuyer.tradeLicenceNo}
                </span>
              </p>
            )}
          </div>
          <div>
            <p className={EYEBROW + " mb-1.5"}>{t("shipTo")}</p>
            {renderAddress(shipTo)}
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
        {taxRows ? (
          <table className="w-full min-w-[560px] print:min-w-0 border-collapse text-[0.8125rem]">
            <thead className="[display:table-header-group]">
              <tr>
                <th className="bg-neutral-100 font-bold py-2 px-2 text-start">
                  {t("item")}
                </th>
                <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                  {t("qty")}
                </th>
                <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                  {t("unitExVat")}
                </th>
                <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                  {t("exVat")}
                </th>
                <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                  {t("vatRate", { rate: effectiveRate })}
                </th>
                <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                  {t("inclVat")}
                </th>
              </tr>
            </thead>
            <tbody>
              {taxRows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-[var(--color-shop-divider)] break-inside-avoid"
                >
                  <td
                    className={
                      "py-2 px-2 " +
                      (row.indent
                        ? "ps-4 text-neutral-700"
                        : row.quantity === null
                          ? "text-neutral-700"
                          : "font-semibold")
                    }
                  >
                    {row.label}
                  </td>
                  <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
                    {row.quantity ?? ""}
                  </td>
                  <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
                    {row.unitNetFils === null
                      ? ""
                      : formatFils(row.unitNetFils, locale)}
                  </td>
                  <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
                    {formatFils(row.netFils, locale)}
                  </td>
                  <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
                    {formatFils(row.vatFils, locale)}
                  </td>
                  <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
                    {formatFils(row.grossFils, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead className="[display:table-header-group]">
            <tr>
              <th className="bg-neutral-100 font-bold py-2 px-2 text-start">
                {t("item")}
              </th>
              <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                {t("qty")}
              </th>
              <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                {t("unitPrice")}
              </th>
              <th className="bg-neutral-100 font-bold py-2 px-2 text-end">
                {t("amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {productItems.map((product) => {
              const children = addonItems.filter(
                (a) => a.parentOrderItemId === product.id,
              );
              return (
                <ItemRows
                  key={product.id}
                  product={product}
                  addons={children}
                  locale={locale}
                />
              );
            })}
          </tbody>
        </table>
        )}
        </div>

        {taxRows ? (
          <div className="ms-auto w-full max-w-[300px] mt-4 break-inside-avoid">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[0.8125rem] text-neutral-700">
                  {t("totalExVat")}
                </span>
                <span className="text-[0.8125rem] tabular-nums" dir="ltr">
                  {formatAED(totalExVatAed, locale)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[0.8125rem] text-neutral-700">
                  {t("vatAt", { rate: effectiveRate })}
                </span>
                <span className="text-[0.8125rem] tabular-nums" dir="ltr">
                  {formatAED(taxAed, locale)}
                </span>
              </div>
              <div className="flex justify-between items-baseline border-t-2 border-[#0b0b0b] pt-2 font-bold text-[1rem]">
                <span>{t("totalInclVat")}</span>
                <span className="tabular-nums" dir="ltr">
                  {formatAED(order.totalAed, locale)}
                </span>
              </div>
            </div>
          </div>
        ) : (
        <div className="ms-auto w-full max-w-[300px] mt-4 break-inside-avoid">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[0.8125rem] text-neutral-700">
                {ts("subtotal")}
              </span>
              <span
                className="text-[0.8125rem] tabular-nums"
                dir="ltr"
              >
                {formatAED(order.subtotalAed, locale)}
              </span>
            </div>

            {order.addonTotalAed > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[0.8125rem] text-neutral-700">
                  {ts("addons")}
                </span>
                <span
                  className="text-[0.8125rem] tabular-nums"
                  dir="ltr"
                >
                  {formatAED(order.addonTotalAed, locale)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div>
                <span className="text-[0.8125rem] text-neutral-700">
                  {ts("shipping")}
                </span>
                {shippingMethodName && (
                  <p className="text-[0.6875rem] text-neutral-500">
                    {shippingMethodName}
                  </p>
                )}
                {order.discountAmountAed === 0 &&
                  order.couponCode &&
                  order.shippingCostAed === 0 && (
                    <p className="text-[0.6875rem] text-[var(--color-positive)]">
                      {ts("freeShipping")}{" "}
                      <span dir="ltr">· {order.couponCode}</span>
                    </p>
                  )}
              </div>
              <span
                className="text-[0.8125rem] tabular-nums"
                dir="ltr"
              >
                {formatAED(order.shippingCostAed, locale)}
              </span>
            </div>

            {order.discountAmountAed > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[0.8125rem] text-neutral-700">
                  {ts("discount")}
                  {order.couponCode && (
                    <span className="text-neutral-500 ms-1" dir="ltr">
                      · {order.couponCode}
                    </span>
                  )}
                </span>
                <span
                  className="text-[0.8125rem] tabular-nums"
                  dir="ltr"
                  style={{ color: "var(--color-positive)" }}
                >
                  -{formatAED(order.discountAmountAed, locale)}
                </span>
              </div>
            )}

            {order.loyaltyPointsUsed > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[0.8125rem] text-neutral-700">
                  {ts("points")}
                  <span className="text-neutral-500 ms-1" dir="ltr">
                    · {order.loyaltyPointsUsed.toLocaleString("en-US")}
                  </span>
                </span>
                <span
                  className="text-[0.8125rem] tabular-nums"
                  dir="ltr"
                  style={{ color: "var(--color-positive)" }}
                >
                  -{formatAED(order.loyaltyDiscountAmountAed, locale)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-baseline border-t-2 border-[#0b0b0b] pt-2 font-bold text-[1rem]">
              <span>{ts("total")}</span>
              <span className="tabular-nums" dir="ltr">
                {formatAED(order.totalAed, locale)}
              </span>
            </div>

            {taxAed > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[0.8125rem] text-neutral-500">
                  {tc("vatIncluded", { rate: effectiveRate })}
                </span>
                <span
                  className="text-[0.8125rem] text-neutral-500 tabular-nums"
                  dir="ltr"
                >
                  {formatAED(taxAed, locale)}
                </span>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="ms-auto w-full max-w-[300px] mt-4 break-inside-avoid space-y-1 text-neutral-600 text-[0.75rem]">
          {order.paymentProvider === "NGENIUS" && order.paidAt && (
            <div className="flex justify-between items-center gap-3">
              <span>
                {t("paymentCard")} · {formatDisplayDate(order.paidAt, locale)}
              </span>
              <span className="tabular-nums" dir="ltr">
                {formatAED(order.totalAed, locale)}
              </span>
            </div>
          )}
          {order.paymentProvider === "MANUAL" &&
            order.settlements.map((settlement) => (
              <div
                key={`${settlement.externalReference}-${settlement.paidAt}`}
                className="flex justify-between items-center gap-3"
              >
                <span>
                  {t("settlementLine", {
                    reference: settlement.externalReference,
                    date: formatDisplayDate(settlement.paidAt, locale),
                  })}
                </span>
                <span className="tabular-nums" dir="ltr">
                  {formatAED(settlement.amountAed, locale)}
                </span>
              </div>
            ))}
          {order.refunds.map((refund, index) => (
            <div
              key={`${refund.refundedAt}-${index}`}
              className="flex justify-between items-center gap-3"
            >
              <span>
                {t("refundLine", {
                  date: formatDisplayDate(refund.refundedAt, locale),
                })}
              </span>
              <span className="tabular-nums" dir="ltr">
                -{formatAED(refund.amountAed, locale)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-[var(--color-shop-divider)] pt-4 text-center text-[0.75rem] text-neutral-600 leading-relaxed break-inside-avoid">
          <p className="text-neutral-600">
            {t("thanks", { store: store.name })}
          </p>
          {store.invoiceNote && (
            <p className="whitespace-pre-line text-neutral-600">
              {store.invoiceNote}
            </p>
          )}
          <p className="text-neutral-600">{t("amountsInAed")}</p>
          <p className="text-neutral-600">{t("issued")}</p>
        </div>
      </div>
    </div>
          </td>
        </tr>
      </tbody>
      <tfoot className="hidden print:table-footer-group">
        <tr>
          <td>
            <div className="h-[16mm]" />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

interface TaxInvoiceRow {
  key: string;
  label: string;
  indent: boolean;
  quantity: number | null;
  unitNetFils: number | null;
  netFils: number;
  vatFils: number;
  grossFils: number;
}

interface TaxInvoiceInput {
  products: OrderConfirmationProjection["items"];
  addons: OrderConfirmationProjection["items"];
  rate: number;
  discountFils: number;
  discountLabel: string;
  pointsFils: number;
  pointsLabel: string;
  shippingFils: number;
  shippingLabel: string;
  taxFils: number;
  totalFils: number;
}

function formatFils(fils: number, locale: "en" | "ar" | "ru"): string {
  return fils < 0
    ? `-${formatAED(-fils / 100, locale)}`
    : formatAED(fils / 100, locale);
}

function buildTaxInvoiceRows(input: TaxInvoiceInput): TaxInvoiceRow[] | null {
  const rows: TaxInvoiceRow[] = [];
  const vatOf = (grossFils: number) =>
    Math.round(grossFils - grossFils / (1 + input.rate));
  const push = (
    key: string,
    label: string,
    indent: boolean,
    quantity: number | null,
    grossFils: number,
  ) => {
    rows.push({
      key,
      label,
      indent,
      quantity,
      unitNetFils: null,
      netFils: 0,
      vatFils: vatOf(grossFils),
      grossFils,
    });
  };

  for (const product of input.products) {
    push(
      product.id,
      product.name,
      false,
      product.quantity,
      Math.round(product.lineTotalAed * 100),
    );
    for (const addon of input.addons) {
      if (addon.parentOrderItemId === product.id) {
        push(
          addon.id,
          `+ ${addon.name}`,
          true,
          addon.quantity,
          Math.round(addon.lineTotalAed * 100),
        );
      }
    }
  }
  if (input.discountFils > 0) {
    push("discount", input.discountLabel, false, null, -input.discountFils);
  }
  if (input.pointsFils > 0) {
    push("points", input.pointsLabel, false, null, -input.pointsFils);
  }

  if (rows.length === 0) return null;

  const diff =
    input.taxFils - rows.reduce((sum, row) => sum + row.vatFils, 0);
  if (Math.abs(diff) > rows.length) return null;
  if (diff !== 0) {
    let target = rows[0];
    for (const row of rows) {
      if (row.grossFils > target.grossFils) target = row;
    }
    target.vatFils += diff;
  }

  for (const row of rows) {
    row.netFils = row.grossFils - row.vatFils;
    if (row.quantity !== null && row.quantity > 0) {
      row.unitNetFils = Math.round(row.netFils / row.quantity);
    }
  }

  if (input.shippingFils > 0) {
    rows.push({
      key: "shipping",
      label: input.shippingLabel,
      indent: false,
      quantity: null,
      unitNetFils: null,
      netFils: input.shippingFils,
      vatFils: 0,
      grossFils: input.shippingFils,
    });
  }

  const netSum = rows.reduce((sum, row) => sum + row.netFils, 0);
  if (netSum !== input.totalFils - input.taxFils) return null;

  return rows;
}

interface ItemRowsProps {
  product: OrderConfirmationProjection["items"][number];
  addons: OrderConfirmationProjection["items"];
  locale: "en" | "ar" | "ru";
}

function ItemRows({ product, addons, locale }: ItemRowsProps) {
  const rowClass =
    "border-b border-[var(--color-shop-divider)] break-inside-avoid";
  return (
    <>
      <tr className={rowClass}>
        <td className="py-2 px-2 font-semibold">{product.name}</td>
        <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
          {product.quantity}
        </td>
        <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
          {formatAED(product.unitPriceAed, locale)}
        </td>
        <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
          {formatAED(product.lineTotalAed, locale)}
        </td>
      </tr>
      {addons.map((addon) => (
        <tr key={addon.id} className={rowClass}>
          <td className="py-2 px-2 ps-4 text-neutral-700">+ {addon.name}</td>
          <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
            {addon.quantity}
          </td>
          <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
            {formatAED(addon.unitPriceAed, locale)}
          </td>
          <td className="py-2 px-2 text-end tabular-nums" dir="ltr">
            {formatAED(addon.lineTotalAed, locale)}
          </td>
        </tr>
      ))}
    </>
  );
}
