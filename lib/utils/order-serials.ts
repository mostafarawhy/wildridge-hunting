export type SerialTrackingKind = "NONE" | "SERIAL" | "LOT";

export const NO_SERIAL_REASON = "No serial on this item";

export function noSerialNeedsOverride(tracking: SerialTrackingKind): boolean {
  return tracking !== "NONE";
}

export interface SerialRecordInput {
  unitIndex: number;
  value: string | null;
  overrideReason: string | null;
}

export interface SerialLineInput {
  id: string;
  itemType?: "PRODUCT" | "ADDON";
  productSku: string | null;
  name: string;
  quantity: number;
  serialTracking: SerialTrackingKind;
  serials: SerialRecordInput[];
}

export interface SerialUnit {
  orderItemId: string;
  productSku: string | null;
  name: string;
  tracking: SerialTrackingKind;
  kind: "SERIAL" | "LOT";
  unitIndex: number;
  value: string | null;
  overrideReason: string | null;
  noSerial: boolean;
  recorded: boolean;
}

export function serialUnitsFor(items: SerialLineInput[]): SerialUnit[] {
  const units: SerialUnit[] = [];
  for (const item of items) {
    if (item.itemType !== undefined && item.itemType !== "PRODUCT") continue;
    const byIndex = new Map(item.serials.map((s) => [s.unitIndex, s]));
    for (let unitIndex = 1; unitIndex <= item.quantity; unitIndex++) {
      const record = byIndex.get(unitIndex);
      const value = record?.value?.trim() ? record.value : null;
      const overrideReason = record?.overrideReason?.trim()
        ? record.overrideReason
        : null;
      units.push({
        orderItemId: item.id,
        productSku: item.productSku,
        name: item.name,
        tracking: item.serialTracking,
        kind: item.serialTracking === "LOT" ? "LOT" : "SERIAL",
        unitIndex,
        value,
        overrideReason,
        noSerial: overrideReason === NO_SERIAL_REASON,
        recorded: value !== null || overrideReason !== null,
      });
    }
  }
  return units;
}

export function serialProgress(items: SerialLineInput[]): {
  required: number;
  recorded: number;
} {
  const units = serialUnitsFor(items);
  return {
    required: units.length,
    recorded: units.filter((u) => u.recorded).length,
  };
}

export function serialsComplete(items: SerialLineInput[]): boolean {
  const { required, recorded } = serialProgress(items);
  return required === recorded;
}

export function normalizeSerialValue(value: string): string {
  return value.trim().toLowerCase();
}
