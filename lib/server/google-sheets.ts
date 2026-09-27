import "server-only";
import { google, type sheets_v4 } from "googleapis";
import {
  type PurchaseData,
  settingsSchema,
  type RegistrationData,
  type RegistrationSettings
} from "@/lib/validation";
import { DEFAULT_SETTINGS, PURCHASE_HEADERS, REGISTRATION_HEADERS } from "@/lib/sheets-schema";
import type { PurchaseRecord } from "@/lib/purchases";
import {
  registrationSheetValues,
  type RegistrationLocationNames
} from "@/lib/registration-idempotency";
import { sanitizeSheetValue } from "@/lib/sanitize";
import { getServerConfig } from "./env";

export type RegistrationRecord = {
  submissionId: string;
  createdAt: string;
  provinceId: string;
  provinceName: string;
  districtId: string;
  districtName: string;
  schoolId: string;
  schoolName: string;
  classTeacherFullName: string;
  classTeacherPhone: string;
  students: Array<{ fullName: string; phone: string }>;
};

type PurchaseLocationNames = {
  provinceName: string;
  districtName: string;
};

let sheetsClient: sheets_v4.Sheets | undefined;

function client() {
  if (sheetsClient) return sheetsClient;
  const config = getServerConfig();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: config.GOOGLE_PRIVATE_KEY
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export async function appendRegistration(
  submissionId: string,
  createdAt: string,
  data: RegistrationData,
  location: RegistrationLocationNames
) {
  const config = getServerConfig();
  const headerResponse = await client().spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_REGISTRATIONS_TAB)}!A1:AD1`,
    majorDimension: "ROWS"
  });
  assertRegistrationHeader(
    (headerResponse.data.values?.[0] ?? []) as string[],
    REGISTRATION_HEADERS
  );
  const row = [
    submissionId,
    createdAt,
    ...registrationSheetValues(data, location)
  ];

  await client().spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_REGISTRATIONS_TAB)}!A:AD`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    includeValuesInResponse: false,
    requestBody: { majorDimension: "ROWS", values: [row] }
  });
}

export async function findRegistrationById(submissionId: string): Promise<RegistrationRecord | null> {
  const config = getServerConfig();
  const idColumn = await client().spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_REGISTRATIONS_TAB)}!A:A`,
    majorDimension: "ROWS"
  });
  const idRows = (idColumn.data.values ?? []) as string[][];
  assertRegistrationHeader(idRows[0] ?? [], REGISTRATION_HEADERS.slice(0, 1));
  const rowIndex = idRows.slice(1).findIndex((row) => row[0] === submissionId);
  if (rowIndex < 0) return null;

  const sheetRow = rowIndex + 2;
  const response = await client().spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_REGISTRATIONS_TAB)}!A${sheetRow}:AD${sheetRow}`,
    majorDimension: "ROWS"
  });
  const row = (response.data.values?.[0] ?? []) as string[];
  return row.length ? parseRegistrationRow(row) : null;
}

export async function listRegistrations(): Promise<RegistrationRecord[]> {
  const rows = await getRegistrationRows("A:J");
  return rows.map(parseRegistrationRow).filter((row): row is RegistrationRecord => Boolean(row));
}

export async function appendPurchase(
  purchaseId: string,
  createdAt: string,
  data: PurchaseData,
  location: PurchaseLocationNames
): Promise<PurchaseRecord> {
  const config = getServerConfig();
  const headerResponse = await client().spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_PURCHASES_TAB)}!A1:J1`,
    majorDimension: "ROWS"
  });
  assertPurchaseHeader((headerResponse.data.values?.[0] ?? []) as string[]);

  const record: PurchaseRecord = {
    purchaseId,
    purchasedAt: data.purchasedAt,
    buyerFullName: data.buyerFullName,
    buyerPhone: data.buyerPhone,
    provinceId: data.provinceId,
    provinceName: location.provinceName,
    districtId: data.districtId,
    districtName: location.districtName,
    note: data.note,
    createdAt
  };
  const row = [
    record.purchaseId,
    record.purchasedAt,
    sanitizeSheetValue(record.buyerFullName),
    record.buyerPhone,
    record.provinceId,
    sanitizeSheetValue(record.provinceName),
    record.districtId,
    sanitizeSheetValue(record.districtName),
    sanitizeSheetValue(record.note),
    record.createdAt
  ];

  await client().spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_PURCHASES_TAB)}!A:J`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    includeValuesInResponse: false,
    requestBody: { majorDimension: "ROWS", values: [row] }
  });
  return { ...record, buyerFullName: row[2], provinceName: row[5], districtName: row[7], note: row[8] };
}

export async function listPurchases(): Promise<PurchaseRecord[]> {
  const config = getServerConfig();
  const response = await client().spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_PURCHASES_TAB)}!A:J`,
    majorDimension: "ROWS"
  });
  const rows = (response.data.values ?? []) as string[][];
  assertPurchaseHeader(rows[0] ?? []);
  const records = rows.slice(1).map(parsePurchaseRow).filter((row): row is PurchaseRecord => Boolean(row));
  const purchaseIds = new Set<string>();
  for (const record of records) {
    if (purchaseIds.has(record.purchaseId)) throw new Error("PURCHASES_DUPLICATE_ID");
    purchaseIds.add(record.purchaseId);
  }
  return records;
}

async function getRegistrationRows(columns: "A:J" | "A:AD" = "A:AD") {
  const config = getServerConfig();
  const response = await client().spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_REGISTRATIONS_TAB)}!${columns}`,
    majorDimension: "ROWS"
  });
  const rows = (response.data.values ?? []) as string[][];
  const expectedHeader = columns === "A:J" ? REGISTRATION_HEADERS.slice(0, 10) : REGISTRATION_HEADERS;
  assertRegistrationHeader(rows[0] ?? [], expectedHeader);
  return rows.slice(1);
}

export async function readSettings(): Promise<RegistrationSettings> {
  const config = getServerConfig();
  const response = await client().spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_SETTINGS_TAB)}!A:B`,
    majorDimension: "ROWS"
  });
  const entries = Object.fromEntries(
    ((response.data.values ?? []) as string[][])
      .filter((row) => row[0])
      .map((row) => [String(row[0]), String(row[1] ?? "")])
  );
  const updatedAt = entries.updated_at ?? "";
  const parsed = settingsSchema.safeParse({
    registrationOpen: entries.registration_open === undefined
      ? DEFAULT_SETTINGS.registrationOpen
      : entries.registration_open.toLowerCase() === "true",
    registrationDeadline: entries.registration_deadline ?? "",
    announcement: entries.announcement ?? "",
    closedMessage: entries.closed_message || DEFAULT_SETTINGS.closedMessage
  });
  if (!parsed.success) throw new Error("SETTINGS_SCHEMA_MISMATCH");
  return { ...parsed.data, updatedAt };
}

export async function writeSettings(settings: RegistrationSettings) {
  const config = getServerConfig();
  const updatedAt = new Date().toISOString();
  await client().spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${quoteSheet(config.GOOGLE_SHEETS_SETTINGS_TAB)}!A1:B5`,
    valueInputOption: "RAW",
    requestBody: {
      majorDimension: "ROWS",
      values: [
        ["registration_open", String(settings.registrationOpen)],
        ["registration_deadline", settings.registrationDeadline],
        ["announcement", sanitizeSheetValue(settings.announcement)],
        ["closed_message", sanitizeSheetValue(settings.closedMessage)],
        ["updated_at", updatedAt]
      ]
    }
  });
  return { ...settings, updatedAt };
}

export async function checkSheetsConnection() {
  const config = getServerConfig();
  await client().spreadsheets.get({
    spreadsheetId: config.GOOGLE_SHEETS_SPREADSHEET_ID,
    fields: "spreadsheetId"
  });
  return new Date().toISOString();
}

function parseRegistrationRow(row: string[]): RegistrationRecord | null {
  if (!row[0]) return null;
  const students = Array.from({ length: 10 }, (_, index) => ({
    fullName: row[10 + index * 2] ?? "",
    phone: row[11 + index * 2] ?? ""
  }));
  return {
    submissionId: row[0] ?? "",
    createdAt: row[1] ?? "",
    provinceId: row[2] ?? "",
    provinceName: row[3] ?? "",
    districtId: row[4] ?? "",
    districtName: row[5] ?? "",
    schoolId: row[6] ?? "",
    schoolName: row[7] ?? "",
    classTeacherFullName: row[8] ?? "",
    classTeacherPhone: row[9] ?? "",
    students
  };
}

function parsePurchaseRow(row: string[]): PurchaseRecord | null {
  if (!row[0]) return null;
  return {
    purchaseId: row[0] ?? "",
    purchasedAt: row[1] ?? "",
    buyerFullName: row[2] ?? "",
    buyerPhone: row[3] ?? "",
    provinceId: row[4] ?? "",
    provinceName: row[5] ?? "",
    districtId: row[6] ?? "",
    districtName: row[7] ?? "",
    note: row[8] ?? "",
    createdAt: row[9] ?? ""
  };
}

function quoteSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function assertRegistrationHeader(actual: readonly string[], expected: readonly string[]) {
  assertHeader(actual, expected, "REGISTRATIONS_HEADER_MISMATCH");
}

function assertPurchaseHeader(actual: readonly string[]) {
  assertHeader(actual, PURCHASE_HEADERS, "PURCHASES_HEADER_MISMATCH");
}

function assertHeader(actual: readonly string[], expected: readonly string[], errorCode: string) {
  if (actual.length !== expected.length || expected.some((header, index) => actual[index] !== header)) {
    throw new Error(errorCode);
  }
}
