import { describe, expect, it } from "vitest";
import { purchaseStats, type PurchaseRecord } from "@/lib/purchases";
import { purchaseSchema } from "@/lib/validation";

describe("purchase validation and analytics", () => {
  it("normalizes buyer data and rejects impossible dates", () => {
    const parsed = purchaseSchema.parse({
      purchasedAt: "2026-09-27",
      buyerFullName: "  Алуа   Серікқызы ",
      buyerPhone: "87010000001",
      provinceId: "1",
      districtId: "2",
      note: "  Алғашқы   төлем "
    });
    expect(parsed).toMatchObject({
      buyerFullName: "Алуа Серікқызы",
      buyerPhone: "+7 701 000 00 01",
      note: "Алғашқы төлем"
    });
    expect(purchaseSchema.safeParse({ ...parsed, purchasedAt: "2026-02-31" }).success).toBe(false);
  });

  it("ranks provinces and districts by count with deterministic ties", () => {
    const records = [
      purchase("1", "Алматы облысы", "11", "Қарасай ауданы"),
      purchase("1", "Алматы облысы", "11", "Қарасай ауданы"),
      purchase("2", "Ақмола облысы", "21", "Аршалы ауданы"),
      purchase("2", "Ақмола облысы", "22", "Атбасар ауданы")
    ];
    const stats = purchaseStats(records);
    expect(stats.total).toBe(4);
    expect(stats.totalAccessUsers).toBe(40);
    expect(stats.topProvince).toMatchObject({ id: "2", count: 2 });
    expect(stats.topDistrict).toMatchObject({ id: "11", count: 2 });
    expect(stats.byDistrict).toHaveLength(3);
  });
});

function purchase(
  provinceId: string,
  provinceName: string,
  districtId: string,
  districtName: string
): PurchaseRecord {
  return {
    purchaseId: crypto.randomUUID(),
    purchasedAt: "2026-09-27",
    buyerFullName: "Алуа Серікқызы",
    buyerPhone: "+7 701 000 00 01",
    provinceId,
    provinceName,
    districtId,
    districtName,
    note: "",
    createdAt: "2026-09-27T10:00:00.000Z"
  };
}
