import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { District, LocationImportReport, Province, School } from "@/lib/location-types";
import {
  buildLocationData,
  cleanDisplayText,
  DISTRICT_SOURCE_FILE,
  DISTRICT_SOURCE_HEADERS,
  EXPECTED_LOCATION_SOURCE_FILES,
  type HtmlRecord,
  parseHtmlTable,
  PROVINCE_SOURCE_FILE,
  PROVINCE_SOURCE_HEADERS,
  SCHOOL_SOURCE_FILES,
  SCHOOL_SOURCE_HEADERS,
  type BuiltLocationData
} from "@/scripts/location-data-core";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "data", "source");
const generatedDir = path.join(rootDir, "src", "generated");
const schoolsDir = path.join(generatedDir, "schools-by-province");

let sourceFileNames: string[];
let provinceRows: HtmlRecord[];
let districtRows: HtmlRecord[];
let schoolRows: HtmlRecord[];
let built: BuiltLocationData;

async function readSourceRows(fileName: string, expectedHeaders: readonly string[]) {
  return parseHtmlTable(await readFile(path.join(sourceDir, fileName), "utf8"), {
    expectedHeaders,
    sourceName: fileName
  });
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

beforeAll(async () => {
  sourceFileNames = (await readdir(sourceDir)).filter((name) => name.toLocaleLowerCase().endsWith(".xls"));
  [provinceRows, districtRows] = await Promise.all([
    readSourceRows(PROVINCE_SOURCE_FILE, PROVINCE_SOURCE_HEADERS),
    readSourceRows(DISTRICT_SOURCE_FILE, DISTRICT_SOURCE_HEADERS)
  ]);
  schoolRows = (
    await Promise.all(SCHOOL_SOURCE_FILES.map((name) => readSourceRows(name, SCHOOL_SOURCE_HEADERS)))
  ).flat();
  built = buildLocationData({
    provinceRows,
    districtRows,
    schoolRows,
    processedFiles: EXPECTED_LOCATION_SOURCE_FILES.length,
    generatedAt: "2026-09-26T00:00:00.000Z"
  });
});

describe("real XLS/HTML location import", () => {
  it("uses the exact eleven source files and expected source row counts", () => {
    expect([...sourceFileNames].sort()).toEqual([...EXPECTED_LOCATION_SOURCE_FILES].sort());
    expect(built.report.processedFiles).toBe(11);
    expect(built.report.sourceRows).toEqual({ provinces: 20, districts: 236, schools: 8281 });
  });

  it("produces the expected cleaned counts, removals, duplicates and fallback", () => {
    expect(built.report.outputRows).toEqual({ provinces: 20, districts: 231, schools: 8279 });
    expect(built.report.removedRows.map((row) => row.id).sort((a, b) => Number(a) - Number(b))).toEqual([
      "233",
      "234",
      "8111",
      "8112"
    ]);
    expect(built.report.duplicates).toEqual([
      expect.objectContaining({ source: "district", keptId: "11", removedId: "239" }),
      expect.objectContaining({ source: "district", keptId: "228", removedId: "231" }),
      expect.objectContaining({ source: "district", keptId: "236", removedId: "237" }),
      expect.objectContaining({ source: "district", keptId: "152", removedId: "229" })
    ]);
    expect(built.report.fallbackDistricts).toEqual([
      expect.objectContaining({
        id: "fallback-4-жетісу-1vwi9nw",
        name: "Жетісу",
        provinceId: "4",
        schoolCount: 1
      })
    ]);
    expect(built.report.unmatchedSchools).toEqual([
      expect.objectContaining({ schoolId: "8261", districtName: "Жетісу", reason: "district_not_found" })
    ]);
  });

  it("keeps every generated school inside its generated province and district", () => {
    const provinceIds = new Set(built.provinces.map((province) => province.id));
    const districtById = new Map(built.districts.map((district) => [district.id, district]));
    const schools = [...built.schoolsByProvince.values()].flat();

    expect(new Set(schools.map((school) => school.id)).size).toBe(8279);
    for (const school of schools) {
      const district = districtById.get(school.districtId);
      expect(provinceIds.has(school.provinceId)).toBe(true);
      expect(district).toBeDefined();
      expect(district?.provinceId).toBe(school.provinceId);
      expect(district?.name).toBe(school.districtName);
    }

    const fallbackSchool = schools.find((school) => school.id === "8261");
    expect(fallbackSchool).toMatchObject({
      name: "№225 жалпы білім беретін мектеп",
      districtId: "fallback-4-жетісу-1vwi9nw",
      provinceId: "4"
    });
  });

  it("preserves source display names including the numero sign", () => {
    const schools = [...built.schoolsByProvince.values()].flat();
    const schoolById = new Map(schools.map((school) => [school.id, school]));
    const removedSchoolIds = new Set(
      built.report.removedRows.filter((row) => row.source === "school").map((row) => row.id)
    );

    for (const row of schoolRows) {
      const id = cleanDisplayText(row.id);
      if (removedSchoolIds.has(id)) continue;
      expect(schoolById.get(id)?.name).toBe(cleanDisplayText(row.name));
    }

    expect(schools.filter((school) => school.name.includes("№"))).toHaveLength(2814);
    expect(schoolById.get("93")?.name).toBe("№ 2 Ақкөл жалпы орта білім беретін мектебі");
  });

  it("keeps generated JSON, manifest and report synchronized with the real import", async () => {
    const [generatedProvinces, generatedDistricts, generatedManifest, generatedReport] = await Promise.all([
      readJson<Province[]>(path.join(generatedDir, "provinces.json")),
      readJson<District[]>(path.join(generatedDir, "districts.json")),
      readJson<Array<{ provinceId: string; file: string; count: number }>>(
        path.join(generatedDir, "schools-manifest.json")
      ),
      readJson<LocationImportReport>(path.join(generatedDir, "data-import-report.json"))
    ]);

    expect(generatedProvinces).toEqual(built.provinces);
    expect(generatedDistricts).toEqual(built.districts);
    expect(generatedManifest).toEqual(
      built.provinces.map((province) => ({
        provinceId: province.id,
        file: `${province.id}.json`,
        count: built.schoolsByProvince.get(province.id)?.length ?? 0
      }))
    );

    const generatedSchoolFiles = (await readdir(schoolsDir)).filter((name) => name.endsWith(".json"));
    expect([...generatedSchoolFiles].sort()).toEqual(generatedManifest.map((entry) => entry.file).sort());
    for (const entry of generatedManifest) {
      const generatedSchools = await readJson<School[]>(path.join(schoolsDir, entry.file));
      expect(generatedSchools).toEqual(built.schoolsByProvince.get(entry.provinceId));
      expect(generatedSchools).toHaveLength(entry.count);
    }

    const { generatedAt: actualGeneratedAt, ...actualReport } = generatedReport;
    const { generatedAt: _expectedGeneratedAt, ...expectedReport } = built.report;
    expect(_expectedGeneratedAt).toBe("2026-09-26T00:00:00.000Z");
    expect(Number.isNaN(Date.parse(actualGeneratedAt))).toBe(false);
    expect(actualReport).toEqual(expectedReport);
  });
});
