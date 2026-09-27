export type Province = {
  id: string;
  name: string;
};

export type District = {
  id: string;
  name: string;
  provinceId: string;
  provinceName: string;
  fallback?: boolean;
};

export type School = {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  provinceId: string;
  provinceName: string;
};

export type LocationImportReport = {
  generatedAt: string;
  processedFiles: number;
  sourceRows: {
    provinces: number;
    districts: number;
    schools: number;
  };
  outputRows: {
    provinces: number;
    districts: number;
    schools: number;
  };
  removedRows: Array<{
    source: "province" | "district" | "school";
    reason: string;
    id?: string;
    name?: string;
  }>;
  duplicates: Array<{
    source: "province" | "district" | "school";
    key: string;
    keptId?: string;
    removedId?: string;
  }>;
  fallbackDistricts: Array<{
    id: string;
    name: string;
    provinceId: string;
    provinceName: string;
    schoolCount: number;
  }>;
  unmatchedSchools: Array<{
    schoolId: string;
    schoolName: string;
    provinceName: string;
    districtName: string;
    reason: "province_not_found" | "district_not_found";
  }>;
};
