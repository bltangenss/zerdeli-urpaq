import * as cheerio from "cheerio";
import type {
  District,
  LocationImportReport,
  Province,
  School
} from "../lib/location-types";

export type HtmlRecord = Record<string, string>;

export const PROVINCE_SOURCE_FILE = "oblys.xls";
export const DISTRICT_SOURCE_FILE = "audan.xls";
export const SCHOOL_SOURCE_FILES = [
  "websql_query_result_2026_9_26_2 (1).xls",
  "websql_query_result_2026_9_26_24.xls",
  "websql_query_result_2026_9_26_12.xls",
  "websql_query_result_2026_9_26_36.xls",
  "websql_query_result_2026_9_26_17.xls",
  "websql_query_result_2026_9_26_3.xls",
  "websql_query_result_2026_9_26_52.xls",
  "websql_query_result_2026_9_26_37 (1).xls",
  "websql_query_result_2026_9_26_16 (1).xls"
] as const;
export const EXPECTED_LOCATION_SOURCE_FILES = [
  PROVINCE_SOURCE_FILE,
  DISTRICT_SOURCE_FILE,
  ...SCHOOL_SOURCE_FILES
] as const;

export const PROVINCE_SOURCE_HEADERS = ["id", "name"] as const;
export const DISTRICT_SOURCE_HEADERS = ["id", "name", "province"] as const;
export const SCHOOL_SOURCE_HEADERS = ["id", "name", "district", "province"] as const;

const TEST_NAMES = new Set(
  ["New District", "uttara", "New School", "bright star"].map((value) =>
    normalizeKey(value)
  )
);

export function cleanDisplayText(value: unknown): string {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

export function normalizeKey(value: unknown): string {
  return cleanDisplayText(value).normalize("NFKC").toLocaleLowerCase("kk-KZ");
}

export function isNullishText(value: unknown): boolean {
  const normalized = normalizeKey(value);
  return normalized === "" || normalized === "null" || normalized === "undefined";
}

export function isTestName(value: unknown): boolean {
  return TEST_NAMES.has(normalizeKey(value));
}

type ParseHtmlTableOptions = {
  expectedHeaders?: readonly string[];
  sourceName?: string;
};

export function validateLocationSourceFileNames(fileNames: readonly string[]) {
  const xlsFileNames = fileNames.filter((name) => name.toLocaleLowerCase().endsWith(".xls"));
  const expected = new Set<string>(EXPECTED_LOCATION_SOURCE_FILES);
  const actual = new Set(xlsFileNames);
  const missing = EXPECTED_LOCATION_SOURCE_FILES.filter((name) => !actual.has(name));
  const unexpected = xlsFileNames.filter((name) => !expected.has(name));

  if (missing.length || unexpected.length || xlsFileNames.length !== EXPECTED_LOCATION_SOURCE_FILES.length) {
    const details = [
      missing.length ? `жетіспейді: ${missing.join(", ")}` : "",
      unexpected.length ? `артық: ${unexpected.join(", ")}` : ""
    ].filter(Boolean);
    throw new Error(`Location source файлдарының тізімі сәйкес емес (${details.join("; ") || "қайталанған файл"})`);
  }

  return {
    provinceFile: PROVINCE_SOURCE_FILE,
    districtFile: DISTRICT_SOURCE_FILE,
    schoolFiles: [...SCHOOL_SOURCE_FILES]
  };
}

export function parseHtmlTable(html: string, options: ParseHtmlTableOptions = {}): HtmlRecord[] {
  const $ = cheerio.load(html);
  const tables = $("table");
  const sourceLabel = options.sourceName ? ` (${options.sourceName})` : "";
  if (tables.length !== 1) {
    throw new Error(`Дәл бір HTML table болуы керек${sourceLabel}; табылды: ${tables.length}`);
  }
  const table = tables.first();

  const headers = table
    .find("thead")
    .first()
    .find("tr")
    .first()
    .children("th")
    .toArray()
    .map((cell) => cleanDisplayText($(cell).text()));

  if (!headers.length) {
    throw new Error(`HTML table баған атаулары табылмады${sourceLabel}`);
  }
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) {
    throw new Error(`HTML table баған атаулары бос немесе қайталанған${sourceLabel}`);
  }
  if (
    options.expectedHeaders &&
    (headers.length !== options.expectedHeaders.length ||
      headers.some((header, index) => header !== options.expectedHeaders?.[index]))
  ) {
    throw new Error(
      `HTML table схемасы сәйкес емес${sourceLabel}: күтілді [${options.expectedHeaders.join(", ")}], табылды [${headers.join(", ")}]`
    );
  }

  const rows = table.find("tbody").first().children("tr").toArray();
  if (!rows.length) {
    throw new Error(`HTML table ішінде дерек жолдары жоқ${sourceLabel}`);
  }

  return rows.map((row, rowIndex) => {
    const values = $(row)
      .children("td")
      .toArray()
      .map((cell) => cleanDisplayText($(cell).text()));

    if (values.length !== headers.length) {
      throw new Error(
        `HTML table жолының схемасы сәйкес емес${sourceLabel}, data row ${rowIndex + 1}: күтілді ${headers.length}, табылды ${values.length}`
      );
    }

    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

type BuildInput = {
  provinceRows: HtmlRecord[];
  districtRows: HtmlRecord[];
  schoolRows: HtmlRecord[];
  processedFiles: number;
  generatedAt?: string;
};

export type BuiltLocationData = {
  provinces: Province[];
  districts: District[];
  schoolsByProvince: Map<string, School[]>;
  report: LocationImportReport;
};

export function buildLocationData({
  provinceRows,
  districtRows,
  schoolRows,
  processedFiles,
  generatedAt = new Date().toISOString()
}: BuildInput): BuiltLocationData {
  const collator = new Intl.Collator("kk-KZ", { numeric: true, sensitivity: "base" });
  const removedRows: LocationImportReport["removedRows"] = [];
  const duplicates: LocationImportReport["duplicates"] = [];
  const unmatchedSchools: LocationImportReport["unmatchedSchools"] = [];

  const provincesById = new Map<string, Province>();
  for (const row of provinceRows) {
    const id = cleanDisplayText(row.id);
    const name = cleanDisplayText(row.name);
    if (!id || isNullishText(name) || isTestName(name)) {
      removedRows.push({ source: "province", reason: "missing_or_test_value", id, name });
      continue;
    }
    if (provincesById.has(id)) {
      duplicates.push({ source: "province", key: id, keptId: id, removedId: id });
      continue;
    }
    provincesById.set(id, { id, name });
  }

  const provinces = [...provincesById.values()].sort((a, b) => collator.compare(a.name, b.name));
  const provinceByName = new Map(provinces.map((item) => [normalizeKey(item.name), item]));

  const districtsByKey = new Map<string, District>();
  for (const row of districtRows) {
    const id = cleanDisplayText(row.id);
    const name = cleanDisplayText(row.name);
    const provinceName = cleanDisplayText(row.province);
    if (!id || isNullishText(name) || isNullishText(provinceName) || isTestName(name)) {
      removedRows.push({ source: "district", reason: "missing_null_or_test_value", id, name });
      continue;
    }
    const province = provinceByName.get(normalizeKey(provinceName));
    if (!province) {
      removedRows.push({ source: "district", reason: "province_not_found", id, name });
      continue;
    }
    const key = `${province.id}:${normalizeKey(name)}`;
    if (districtsByKey.has(key)) {
      duplicates.push({
        source: "district",
        key,
        keptId: districtsByKey.get(key)?.id,
        removedId: id
      });
      continue;
    }
    districtsByKey.set(key, {
      id,
      name,
      provinceId: province.id,
      provinceName: province.name
    });
  }

  const schoolById = new Map<string, School>();
  const fallbackSchoolCounts = new Map<string, number>();

  for (const row of schoolRows) {
    const id = cleanDisplayText(row.id);
    const name = cleanDisplayText(row.name);
    const districtName = cleanDisplayText(row.district);
    const provinceName = cleanDisplayText(row.province);

    if (
      !id ||
      isNullishText(name) ||
      isNullishText(provinceName) ||
      isNullishText(districtName) ||
      isTestName(name)
    ) {
      removedRows.push({ source: "school", reason: "missing_null_or_test_value", id, name });
      continue;
    }

    if (schoolById.has(id)) {
      duplicates.push({ source: "school", key: id, keptId: id, removedId: id });
      continue;
    }

    const province = provinceByName.get(normalizeKey(provinceName));
    if (!province) {
      unmatchedSchools.push({
        schoolId: id,
        schoolName: name,
        provinceName,
        districtName,
        reason: "province_not_found"
      });
      removedRows.push({ source: "school", reason: "province_not_found", id, name });
      continue;
    }

    const districtKey = `${province.id}:${normalizeKey(districtName)}`;
    let district = districtsByKey.get(districtKey);
    if (!district) {
      const fallbackId = `fallback-${province.id}-${stableSlug(districtName)}`;
      district = {
        id: fallbackId,
        name: districtName,
        provinceId: province.id,
        provinceName: province.name,
        fallback: true
      };
      districtsByKey.set(districtKey, district);
      fallbackSchoolCounts.set(fallbackId, 0);
      unmatchedSchools.push({
        schoolId: id,
        schoolName: name,
        provinceName: province.name,
        districtName,
        reason: "district_not_found"
      });
    }

    if (district.fallback) {
      fallbackSchoolCounts.set(district.id, (fallbackSchoolCounts.get(district.id) ?? 0) + 1);
    }

    schoolById.set(id, {
      id,
      name,
      districtId: district.id,
      districtName: district.name,
      provinceId: province.id,
      provinceName: province.name
    });
  }

  const districts = [...districtsByKey.values()].sort(
    (a, b) => collator.compare(a.provinceName, b.provinceName) || collator.compare(a.name, b.name)
  );
  const schoolsByProvince = new Map<string, School[]>();
  for (const province of provinces) schoolsByProvince.set(province.id, []);
  for (const school of schoolById.values()) schoolsByProvince.get(school.provinceId)?.push(school);
  for (const schools of schoolsByProvince.values()) {
    schools.sort(
      (a, b) => collator.compare(a.districtName, b.districtName) || collator.compare(a.name, b.name)
    );
  }

  const fallbackDistricts = districts
    .filter((district) => district.fallback)
    .map((district) => ({
      id: district.id,
      name: district.name,
      provinceId: district.provinceId,
      provinceName: district.provinceName,
      schoolCount: fallbackSchoolCounts.get(district.id) ?? 0
    }));

  return {
    provinces,
    districts,
    schoolsByProvince,
    report: {
      generatedAt,
      processedFiles,
      sourceRows: {
        provinces: provinceRows.length,
        districts: districtRows.length,
        schools: schoolRows.length
      },
      outputRows: {
        provinces: provinces.length,
        districts: districts.length,
        schools: schoolById.size
      },
      removedRows,
      duplicates,
      fallbackDistricts,
      unmatchedSchools
    }
  };
}

function stableSlug(value: string): string {
  const slug = normalizeKey(value)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${slug || "district"}-${(hash >>> 0).toString(36)}`;
}
