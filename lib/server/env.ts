import "server-only";
import { z } from "zod";

const envSchema = z.object({
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(1),
  ADMIN_USERS_JSON: z.string().min(2),
  SESSION_SECRET: z.string().min(32),
  GOOGLE_SHEETS_REGISTRATIONS_TAB: z.string().min(1).default("Registrations"),
  GOOGLE_SHEETS_PURCHASES_TAB: z.string().min(1).default("Purchases"),
  GOOGLE_SHEETS_SETTINGS_TAB: z.string().min(1).default("Settings"),
  APP_ORIGIN: z.string().url().optional()
});

export type ServerConfig = z.infer<typeof envSchema> & { GOOGLE_PRIVATE_KEY: string };

let cachedConfig: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  if (cachedConfig) return cachedConfig;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("SERVER_CONFIGURATION_ERROR");
  }
  const privateKey = parsed.data.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n").trim();
  if (!privateKey.includes("BEGIN PRIVATE KEY")) throw new Error("SERVER_CONFIGURATION_ERROR");
  cachedConfig = { ...parsed.data, GOOGLE_PRIVATE_KEY: privateKey };
  return cachedConfig;
}
