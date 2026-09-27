import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  listRegistrations: vi.fn(),
  appendPurchase: vi.fn(),
  validateProvinceDistrict: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/session", () => ({ getCurrentAdmin: routeMocks.getCurrentAdmin }));
vi.mock("@/lib/server/google-sheets", () => ({
  listRegistrations: routeMocks.listRegistrations,
  appendPurchase: routeMocks.appendPurchase
}));
vi.mock("@/lib/server/location-data", () => ({
  validateProvinceDistrict: routeMocks.validateProvinceDistrict
}));

import { GET, POST } from "@/app/api/admin/purchases/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", "https://registration.example.kz");
  routeMocks.getCurrentAdmin.mockResolvedValue({ email: "admin@example.kz", subject: "admin-subject" });
  routeMocks.listRegistrations.mockResolvedValue([]);
  routeMocks.validateProvinceDistrict.mockReturnValue({ provinceName: "Облыс", districtName: "Аудан" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin purchases API", () => {
  it("returns global analytics independently from list filters", async () => {
    routeMocks.listRegistrations.mockResolvedValue([
      record("PUR-1", "1", "Алматы облысы", "11", "Қарасай ауданы", "Алуа"),
      record("PUR-2", "1", "Алматы облысы", "11", "Қарасай ауданы", "Дана"),
      record("PUR-3", "2", "Ақмола облысы", "21", "Аршалы ауданы", "Мәдина")
    ]);
    const response = await GET(new NextRequest(
      "https://registration.example.kz/api/admin/purchases?search=Мәдина&page=1"
    ));
    const payload = await response.json() as {
      data: {
        items: unknown[];
        total: number;
        stats: { total: number; totalAccessUsers: number; topProvince: { count: number } };
      };
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.total).toBe(1);
    expect(payload.data.stats.total).toBe(3);
    expect(payload.data.stats.totalAccessUsers).toBe(30);
    expect(payload.data.stats.topProvince.count).toBe(2);
  });

  it("rejects unauthenticated reads", async () => {
    routeMocks.getCurrentAdmin.mockResolvedValue(null);
    const response = await GET(new NextRequest("https://registration.example.kz/api/admin/purchases"));
    expect(response.status).toBe(401);
    expect(routeMocks.listRegistrations).not.toHaveBeenCalled();
  });

  it("validates and appends a canonicalized purchase", async () => {
    routeMocks.appendPurchase.mockImplementation(async (
      purchaseId: string,
      createdAt: string,
      data: Record<string, string>,
      location: Record<string, string>
    ) => ({ purchaseId, createdAt, ...data, ...location }));
    const response = await POST(new NextRequest("https://registration.example.kz/api/admin/purchases", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://registration.example.kz",
        "sec-fetch-site": "same-origin"
      },
      body: JSON.stringify({
        purchasedAt: "2026-09-27",
        buyerFullName: "Алуа Серікқызы",
        buyerPhone: "87010000001",
        provinceId: "1",
        districtId: "11",
        note: ""
      })
    }));
    expect(response.status).toBe(201);
    expect(routeMocks.appendPurchase).toHaveBeenCalledWith(
      expect.stringMatching(/^PUR-2026-[A-F0-9]{8}$/u),
      expect.any(String),
      expect.objectContaining({ buyerPhone: "+7 701 000 00 01" }),
      { provinceName: "Облыс", districtName: "Аудан" }
    );
  });
});

function record(
  purchaseId: string,
  provinceId: string,
  provinceName: string,
  districtId: string,
  districtName: string,
  buyerFullName: string
) {
  return {
    submissionId: purchaseId,
    createdAt: "2026-09-27T10:00:00.000Z",
    provinceId,
    provinceName,
    districtId,
    districtName,
    schoolId: "100",
    schoolName: "№1 мектеп",
    classTeacherFullName: buyerFullName,
    classTeacherPhone: "+7 701 000 00 01",
    students: []
  };
}
