import "server-only";
import { db } from "@/lib/db/client";
import {
  SETTING_KEYS,
  isAllowedSettingKey,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings/keys";

export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValue<K>> {
  if (!isAllowedSettingKey(key))
    throw new Error(`Disallowed setting key: ${key}`);
  const schema = SETTING_KEYS[key];
  const row = await db.projectConfig.findUnique({ where: { key } });
  const parsed = schema.safeParse(row?.value ?? {});
  if (parsed.success) return parsed.data as SettingValue<K>;
  console.error(
    `[settings] corrupt config row for key "${key}", falling back to defaults`,
  );
  return schema.parse({}) as SettingValue<K>;
}
