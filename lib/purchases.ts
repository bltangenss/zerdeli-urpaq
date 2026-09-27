export type PurchaseRecord = {
  purchaseId: string;
  purchasedAt: string;
  buyerFullName: string;
  buyerPhone: string;
  provinceId: string;
  provinceName: string;
  districtId: string;
  districtName: string;
  note: string;
  createdAt: string;
};

export const PURCHASE_GROUP_SIZE = 10;

export type PurchaseCount = {
  id: string;
  name: string;
  count: number;
};

export type DistrictPurchaseCount = PurchaseCount & {
  provinceId: string;
  provinceName: string;
};

export type PurchaseStats = {
  total: number;
  totalAccessUsers: number;
  topProvince: PurchaseCount | null;
  topDistrict: DistrictPurchaseCount | null;
  byProvince: PurchaseCount[];
  byDistrict: DistrictPurchaseCount[];
};

export function purchaseStats(records: readonly PurchaseRecord[]): PurchaseStats {
  const provinceCounts = new Map<string, PurchaseCount>();
  const districtCounts = new Map<string, DistrictPurchaseCount>();

  for (const record of records) {
    const province = provinceCounts.get(record.provinceId);
    if (province) province.count += 1;
    else {
      provinceCounts.set(record.provinceId, {
        id: record.provinceId,
        name: record.provinceName,
        count: 1
      });
    }

    const districtKey = `${record.provinceId}\u0000${record.districtId}`;
    const district = districtCounts.get(districtKey);
    if (district) district.count += 1;
    else {
      districtCounts.set(districtKey, {
        id: record.districtId,
        name: record.districtName,
        provinceId: record.provinceId,
        provinceName: record.provinceName,
        count: 1
      });
    }
  }

  const byProvince = [...provinceCounts.values()].sort(compareCounts);
  const byDistrict = [...districtCounts.values()].sort(compareCounts);
  return {
    total: records.length,
    totalAccessUsers: records.length * PURCHASE_GROUP_SIZE,
    topProvince: byProvince[0] ?? null,
    topDistrict: byDistrict[0] ?? null,
    byProvince,
    byDistrict
  };
}

function compareCounts<T extends PurchaseCount>(left: T, right: T) {
  return right.count - left.count || left.name.localeCompare(right.name, "kk-KZ", { numeric: true });
}
