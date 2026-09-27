import nextEnv from "@next/env";
import { google } from "googleapis";
import { DEFAULT_SETTINGS, PURCHASE_HEADERS, REGISTRATION_HEADERS } from "../lib/sheets-schema";
import {
  assertPurchaseHeader,
  assertRegistrationHeader,
  assertSettingsSchema,
  assertSheetSetupConfig,
  hasSheetValues
} from "./setup-validation";

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const spreadsheetId = required("GOOGLE_SHEETS_SPREADSHEET_ID");
  const email = required("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n").trim();
  const registrationsTab = process.env.GOOGLE_SHEETS_REGISTRATIONS_TAB?.trim() || "Registrations";
  const purchasesTab = process.env.GOOGLE_SHEETS_PURCHASES_TAB?.trim() || "Purchases";
  const settingsTab = process.env.GOOGLE_SHEETS_SETTINGS_TAB?.trim() || "Settings";

  assertSheetSetupConfig({ spreadsheetId, email, privateKey, registrationsTab, purchasesTab, settingsTab });

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const existing = new Set(
    (spreadsheet.data.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean)
  );
  const missing = [registrationsTab, purchasesTab, settingsTab].filter((title) => !existing.has(title));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }
    });
  }

  const currentHeader = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(registrationsTab)}!1:1`
  });
  const header = (currentHeader.data.values?.[0] ?? []) as string[];
  assertRegistrationHeader(header);
  if (!hasSheetValues([header])) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(registrationsTab)}!A1:AD1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...REGISTRATION_HEADERS]] }
    });
  }

  const currentPurchaseHeader = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(purchasesTab)}!1:1`
  });
  const purchaseHeader = (currentPurchaseHeader.data.values?.[0] ?? []) as string[];
  assertPurchaseHeader(purchaseHeader);
  if (!hasSheetValues([purchaseHeader])) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(purchasesTab)}!A1:J1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...PURCHASE_HEADERS]] }
    });
  }

  const currentSettings = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(settingsTab)}!A:B`
  });
  const settingsRows = (currentSettings.data.values ?? []) as string[][];
  assertSettingsSchema(settingsRows);
  if (!hasSheetValues(settingsRows)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheet(settingsTab)}!A1:B5`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          ["registration_open", String(DEFAULT_SETTINGS.registrationOpen)],
          ["registration_deadline", ""],
          ["announcement", ""],
          ["closed_message", DEFAULT_SETTINGS.closedMessage],
          ["updated_at", new Date().toISOString()]
        ]
      }
    });
  }
  console.log(
    `Google Sheets дайын: "${registrationsTab}", "${purchasesTab}" және "${settingsTab}" тексерілді.`
  );
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} environment variable толтырылмаған`);
  return value;
}

function quoteSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Google Sheets initialize қатесі");
  process.exitCode = 1;
});
