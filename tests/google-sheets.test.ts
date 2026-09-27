import { beforeEach, describe, expect, it, vi } from "vitest";
import { PURCHASE_HEADERS, REGISTRATION_HEADERS } from "@/lib/sheets-schema";
import type { PurchaseData, RegistrationData } from "@/lib/validation";

const sheetMocks = vi.hoisted(() => ({
  valuesGet: vi.fn(),
  valuesAppend: vi.fn(),
  valuesUpdate: vi.fn(),
  spreadsheetGet: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: class GoogleAuth {} },
    sheets: () => ({
      spreadsheets: {
        values: {
          get: sheetMocks.valuesGet,
          append: sheetMocks.valuesAppend,
          update: sheetMocks.valuesUpdate
        },
        get: sheetMocks.spreadsheetGet
      }
    })
  }
}));
vi.mock("@/lib/server/env", () => ({
  getServerConfig: () => ({
    GOOGLE_SHEETS_SPREADSHEET_ID: "spreadsheet-id",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "service@example.iam.gserviceaccount.com",
    GOOGLE_PRIVATE_KEY: "private-key",
    GOOGLE_SHEETS_REGISTRATIONS_TAB: "Registrations",
    GOOGLE_SHEETS_PURCHASES_TAB: "Purchases",
    GOOGLE_SHEETS_SETTINGS_TAB: "Settings"
  })
}));

import {
  appendPurchase,
  appendRegistration,
  findRegistrationById,
  listPurchases,
  listRegistrations,
  readSettings
} from "@/lib/server/google-sheets";

const data: RegistrationData = {
  provinceId: "1",
  districtId: "2",
  schoolId: "3",
  classTeacherFullName: "=Айгүл Ахметова",
  classTeacherPhone: "+7 777 777 77 77",
  students: Array.from({ length: 10 }, (_, index) => ({
    fullName: `Оқушы ${index + 1}`,
    phone: `+7 700 000 00 ${String(index).padStart(2, "0")}`
  })),
  website: ""
};

const purchaseData: PurchaseData = {
  purchasedAt: "2026-09-27",
  buyerFullName: "=Алуа Серікқызы",
  buyerPhone: "+7 701 000 00 01",
  provinceId: "1",
  districtId: "2",
  note: "@арнайы"
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Google Sheets registration safety", () => {
  it("fails closed instead of appending under a mismatched header", async () => {
    sheetMocks.valuesGet.mockResolvedValueOnce({ data: { values: [["unexpected_header"]] } });

    await expect(appendRegistration("ZU-2026-ABC234", "2026-09-26T00:00:00.000Z", data, {
      provinceName: "Облыс",
      districtName: "Аудан",
      schoolName: "Мектеп"
    })).rejects.toThrow("REGISTRATIONS_HEADER_MISMATCH");
    expect(sheetMocks.valuesAppend).not.toHaveBeenCalled();
  });

  it("checks all 30 columns and appends one RAW, formula-safe row", async () => {
    sheetMocks.valuesGet.mockResolvedValueOnce({ data: { values: [[...REGISTRATION_HEADERS]] } });
    sheetMocks.valuesAppend.mockResolvedValueOnce({ data: {} });

    await appendRegistration("ZU-2026-ABC234", "2026-09-26T00:00:00.000Z", data, {
      provinceName: "Облыс",
      districtName: "Аудан",
      schoolName: "Мектеп"
    });

    expect(sheetMocks.valuesGet).toHaveBeenCalledWith(expect.objectContaining({
      range: "'Registrations'!A1:AD1"
    }));
    expect(sheetMocks.valuesAppend).toHaveBeenCalledWith(expect.objectContaining({
      range: "'Registrations'!A:AD",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: expect.objectContaining({
        values: [expect.arrayContaining(["ZU-2026-ABC234", "'=Айгүл Ахметова"])]
      })
    }));
    const request = sheetMocks.valuesAppend.mock.calls[0]?.[0] as {
      requestBody: { values: string[][] };
    };
    expect(request.requestBody.values[0]).toHaveLength(REGISTRATION_HEADERS.length);
  });

  it("finds the exact row after reading only the ID column", async () => {
    const row = registrationRow("ZU-2026-ABC234");
    sheetMocks.valuesGet
      .mockResolvedValueOnce({
        data: { values: [[REGISTRATION_HEADERS[0]], ["ZU-2026-ABC234"]] }
      })
      .mockResolvedValueOnce({ data: { values: [row] } });

    await expect(findRegistrationById("ZU-2026-ABC234")).resolves.toMatchObject({
      submissionId: "ZU-2026-ABC234",
      classTeacherFullName: "Айгүл Ахметова"
    });
    expect(sheetMocks.valuesGet.mock.calls.map(([request]) => request.range)).toEqual([
      "'Registrations'!A:A",
      "'Registrations'!A2:AD2"
    ]);
  });

  it("requires the A:J header before returning admin summaries", async () => {
    sheetMocks.valuesGet.mockResolvedValueOnce({
      data: { values: [[...REGISTRATION_HEADERS.slice(0, 10)], registrationRow("ZU-2026-ABC234").slice(0, 10)] }
    });
    const records = await listRegistrations();
    expect(records).toHaveLength(1);
    expect(records[0]?.students).toHaveLength(10);
    expect(sheetMocks.valuesGet).toHaveBeenCalledWith(expect.objectContaining({
      range: "'Registrations'!A:J"
    }));
  });

  it("fails closed when manually edited settings no longer match the schema", async () => {
    sheetMocks.valuesGet.mockResolvedValueOnce({
      data: {
        values: [
          ["registration_open", "true"],
          ["registration_deadline", "not-an-iso-date"],
          ["announcement", ""],
          ["closed_message", "Тіркеу жабық"]
        ]
      }
    });
    await expect(readSettings()).rejects.toThrow("SETTINGS_SCHEMA_MISMATCH");
  });
});

describe("Google Sheets purchase safety", () => {
  it("validates the Purchases header and appends a formula-safe RAW row", async () => {
    sheetMocks.valuesGet.mockResolvedValueOnce({ data: { values: [[...PURCHASE_HEADERS]] } });
    sheetMocks.valuesAppend.mockResolvedValueOnce({ data: {} });

    await appendPurchase("PUR-2026-ABC23456", "2026-09-27T10:00:00.000Z", purchaseData, {
      provinceName: "Облыс",
      districtName: "Аудан"
    });

    expect(sheetMocks.valuesGet).toHaveBeenCalledWith(expect.objectContaining({
      range: "'Purchases'!A1:J1"
    }));
    expect(sheetMocks.valuesAppend).toHaveBeenCalledWith(expect.objectContaining({
      range: "'Purchases'!A:J",
      valueInputOption: "RAW",
      requestBody: expect.objectContaining({
        values: [expect.arrayContaining(["'=Алуа Серікқызы", "'@арнайы"])]
      })
    }));
  });

  it("fails closed for duplicate purchase IDs", async () => {
    const row = purchaseRow("PUR-2026-ABC23456");
    sheetMocks.valuesGet.mockResolvedValueOnce({
      data: { values: [[...PURCHASE_HEADERS], row, row] }
    });
    await expect(listPurchases()).rejects.toThrow("PURCHASES_DUPLICATE_ID");
  });
});

function registrationRow(submissionId: string) {
  return [
    submissionId,
    "2026-09-26T00:00:00.000Z",
    "1",
    "Облыс",
    "2",
    "Аудан",
    "3",
    "Мектеп",
    "Айгүл Ахметова",
    "+7 777 777 77 77",
    ...data.students.flatMap((student) => [student.fullName, student.phone])
  ];
}

function purchaseRow(purchaseId: string) {
  return [
    purchaseId,
    "2026-09-27",
    "Алуа Серікқызы",
    "+7 701 000 00 01",
    "1",
    "Облыс",
    "2",
    "Аудан",
    "",
    "2026-09-27T10:00:00.000Z"
  ];
}
