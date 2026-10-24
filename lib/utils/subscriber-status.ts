export type KlaviyoStatus = "SENT" | "WAITING" | "FAILED";

export const KLAVIYO_STATUS_LABELS: Record<KlaviyoStatus, string> = {
  SENT: "Sent",
  WAITING: "Waiting",
  FAILED: "Failed",
};

export function klaviyoStatusOf(row: {
  unsubscribedAt: string | Date | null;
  klaviyoSyncedAt: string | Date | null;
  klaviyoError: string | null;
}): KlaviyoStatus | null {
  if (row.unsubscribedAt) return null;
  if (row.klaviyoError) return "FAILED";
  if (row.klaviyoSyncedAt) return "SENT";
  return "WAITING";
}
