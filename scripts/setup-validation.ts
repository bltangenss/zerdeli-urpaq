import { PURCHASE_HEADERS, REGISTRATION_HEADERS, SETTINGS_KEYS } from "../lib/sheets-schema";

export type SheetSetupConfig = {
  spreadsheetId: string;
  email: string;
  privateKey: string;
  registrationsTab: string;
  purchasesTab: string;
  settingsTab: string;
};

const INVALID_SHEET_TITLE_CHARACTERS = /[:\\/?*\[\]]/u;

export function assertSheetSetupConfig(config: SheetSetupConfig) {
  if (!config.spreadsheetId.trim()) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID бос болмауы керек");
  if (!/^\S+@\S+\.\S+$/u.test(config.email)) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL email форматына сәйкес емес");
  }
  if (!config.privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
      !config.privateKey.includes("-----END PRIVATE KEY-----")) {
    throw new Error("GOOGLE_PRIVATE_KEY толық PEM private key болуы керек");
  }
  assertSheetTitle(config.registrationsTab, "GOOGLE_SHEETS_REGISTRATIONS_TAB");
  assertSheetTitle(config.purchasesTab, "GOOGLE_SHEETS_PURCHASES_TAB");
  assertSheetTitle(config.settingsTab, "GOOGLE_SHEETS_SETTINGS_TAB");
  if (new Set([config.registrationsTab, config.purchasesTab, config.settingsTab]).size !== 3) {
    throw new Error("Registrations, Purchases және Settings парақтарының атаулары әртүрлі болуы керек");
  }
}

export function assertRegistrationHeader(header: readonly unknown[]) {
  const actual = trimTrailingEmptyCells(header);
  if (!actual.length) return;
  const expected = [...REGISTRATION_HEADERS];
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(
      `Registrations sheet header-і күтілетін құрылымға сәйкес емес: ${expected.length} баған дәл сәйкес болуы керек.`
    );
  }
}

export function assertPurchaseHeader(header: readonly unknown[]) {
  const actual = trimTrailingEmptyCells(header);
  if (!actual.length) return;
  const expected = [...PURCHASE_HEADERS];
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(
      `Purchases sheet header-і күтілетін құрылымға сәйкес емес: ${expected.length} баған дәл сәйкес болуы керек.`
    );
  }
}

export function assertSettingsSchema(rows: readonly (readonly unknown[])[]) {
  const populatedRows = rows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!populatedRows.length) return;

  const keys = populatedRows.map((row) => String(row[0] ?? "").trim());
  const expected = new Set<string>(SETTINGS_KEYS);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  const missing = SETTINGS_KEYS.filter((key) => !keys.includes(key));
  const unknown = keys.filter((key) => !expected.has(key));

  if (duplicates.length || missing.length || unknown.length) {
    throw new Error(
      [
        "Settings sheet құрылымы сәйкес емес.",
        missing.length ? `Жоқ keys: ${missing.join(", ")}.` : "",
        unknown.length ? `Белгісіз keys: ${unknown.join(", ")}.` : "",
        duplicates.length ? `Қайталанған keys: ${[...new Set(duplicates)].join(", ")}.` : ""
      ].filter(Boolean).join(" ")
    );
  }
}

export function hasSheetValues(rows: readonly (readonly unknown[])[]) {
  return rows.some((row) => row.some((cell) => String(cell ?? "").trim()));
}

export function assertAdminPassword(password: string) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Құпиясөз 72 UTF-8 байттан аспауы керек");
  }
  if (password.length < 10) throw new Error("Құпиясөз кемінде 10 таңба болуы керек");
}

function assertSheetTitle(title: string, variableName: string) {
  if (!title || title.length > 100 || INVALID_SHEET_TITLE_CHARACTERS.test(title)) {
    throw new Error(`${variableName} жарамсыз Google Sheets парақ атауы`);
  }
}

function trimTrailingEmptyCells(values: readonly unknown[]) {
  const normalized = values.map((value) => String(value ?? ""));
  while (normalized.at(-1) === "") normalized.pop();
  return normalized;
}
