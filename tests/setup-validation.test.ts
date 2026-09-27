import { describe, expect, it } from "vitest";
import { PURCHASE_HEADERS, REGISTRATION_HEADERS, SETTINGS_KEYS } from "@/lib/sheets-schema";
import {
  assertAdminPassword,
  assertPurchaseHeader,
  assertRegistrationHeader,
  assertSettingsSchema,
  assertSheetSetupConfig,
  hasSheetValues
} from "@/scripts/setup-validation";

const validSheetConfig = {
  spreadsheetId: "spreadsheet-id",
  email: "service-account@example.iam.gserviceaccount.com",
  privateKey: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----",
  registrationsTab: "Registrations",
  purchasesTab: "Purchases",
  settingsTab: "Settings"
};

describe("setup validation", () => {
  it("accepts the exact registration header and rejects missing or extra columns", () => {
    expect(() => assertRegistrationHeader(REGISTRATION_HEADERS)).not.toThrow();
    expect(() => assertRegistrationHeader([...REGISTRATION_HEADERS, "unexpected"])).toThrow(/30 баған/);
    expect(() => assertRegistrationHeader(REGISTRATION_HEADERS.slice(0, -1))).toThrow(/30 баған/);
  });

  it("accepts only the exact Purchases header", () => {
    expect(() => assertPurchaseHeader(PURCHASE_HEADERS)).not.toThrow();
    expect(() => assertPurchaseHeader(PURCHASE_HEADERS.slice(0, -1))).toThrow(/10 баған/);
    expect(() => assertPurchaseHeader([...PURCHASE_HEADERS, "unexpected"])).toThrow(/10 баған/);
  });

  it("accepts an empty Settings sheet or the complete key set", () => {
    expect(hasSheetValues([])).toBe(false);
    expect(() => assertSettingsSchema([])).not.toThrow();
    expect(() => assertSettingsSchema(SETTINGS_KEYS.map((key) => [key, ""]))).not.toThrow();
  });

  it("rejects partial, unknown and duplicate Settings keys", () => {
    expect(() => assertSettingsSchema([["registration_open", "true"]])).toThrow(/Жоқ keys/);
    expect(() => assertSettingsSchema([
      ...SETTINGS_KEYS.map((key) => [key, ""]),
      ["other", "value"]
    ])).toThrow(/Белгісіз keys/);
    expect(() => assertSettingsSchema([
      ...SETTINGS_KEYS.map((key) => [key, ""]),
      ["registration_open", "false"]
    ])).toThrow(/Қайталанған keys/);
  });

  it("rejects unsafe spreadsheet configuration before making a network call", () => {
    expect(() => assertSheetSetupConfig(validSheetConfig)).not.toThrow();
    expect(() => assertSheetSetupConfig({ ...validSheetConfig, settingsTab: "Registrations" })).toThrow(/әртүрлі/);
    expect(() => assertSheetSetupConfig({ ...validSheetConfig, purchasesTab: "Registrations" })).toThrow(/әртүрлі/);
    expect(() => assertSheetSetupConfig({ ...validSheetConfig, settingsTab: "Bad/Title" })).toThrow(/жарамсыз/);
    expect(() => assertSheetSetupConfig({ ...validSheetConfig, privateKey: "not-a-key" })).toThrow(/PEM/);
  });

  it("enforces bcrypt's byte limit as well as the minimum character count", () => {
    expect(() => assertAdminPassword("strong-passphrase")).not.toThrow();
    expect(() => assertAdminPassword("short")).toThrow(/10 таңба/);
    expect(() => assertAdminPassword("ө".repeat(37))).toThrow(/72 UTF-8 байт/);
  });
});
