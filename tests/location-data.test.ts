import { describe, expect, it } from "vitest";
import {
  buildLocationData,
  cleanDisplayText,
  EXPECTED_LOCATION_SOURCE_FILES,
  normalizeKey,
  parseHtmlTable,
  SCHOOL_SOURCE_HEADERS,
  validateLocationSourceFileNames
} from "@/scripts/location-data-core";

describe("HTML/XLS location parser", () => {
  it("parses an HTML table", () => {
    expect(parseHtmlTable("<table><thead><tr><th>id</th><th>name</th></tr></thead><tbody><tr><td>1</td><td>  Абай  </td></tr></tbody></table>"))
      .toEqual([{ id: "1", name: "Абай" }]);
  });
  it("cleans display whitespace without changing the numero sign", () => {
    expect(cleanDisplayText("  № 1   мектеп  ")).toBe("№ 1 мектеп");
    expect(normalizeKey("  № 1   мектеп  ")).toBe("no 1 мектеп");
  });
  it("rejects a mismatched table schema", () => {
    expect(() =>
      parseHtmlTable(
        "<table><thead><tr><th>id</th><th>name</th><th>province</th></tr></thead><tbody><tr><td>1</td><td>Мектеп</td><td>Алматы</td></tr></tbody></table>",
        { expectedHeaders: SCHOOL_SOURCE_HEADERS, sourceName: "school.xls" }
      )
    ).toThrow("схемасы сәйкес емес");
  });
  it("rejects a row with the wrong number of cells", () => {
    expect(() =>
      parseHtmlTable(
        "<table><thead><tr><th>id</th><th>name</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>"
      )
    ).toThrow("жолының схемасы сәйкес емес");
  });
  it("requires the exact eleven source basenames", () => {
    expect(validateLocationSourceFileNames(EXPECTED_LOCATION_SOURCE_FILES).schoolFiles).toHaveLength(9);
    expect(() => validateLocationSourceFileNames(EXPECTED_LOCATION_SOURCE_FILES.slice(0, -1))).toThrow(
      "жетіспейді"
    );
    expect(() => validateLocationSourceFileNames([...EXPECTED_LOCATION_SOURCE_FILES, "extra.xls"])).toThrow(
      "артық"
    );
  });
  it("removes test/null rows and creates a fallback district", () => {
    const result = buildLocationData({
      provinceRows: [{ id: "1", name: "Алматы" }],
      districtRows: [
        { id: "1", name: "Аудан", province: "Алматы" },
        { id: "2", name: "New District", province: "null" }
      ],
      schoolRows: [
        { id: "10", name: "Мектеп", district: "Аудан", province: "Алматы" },
        { id: "11", name: "Басқа мектеп", district: "Жаңа аудан", province: "Алматы" },
        { id: "12", name: "bright star", district: "uttara", province: "null" }
      ],
      processedFiles: 3,
      generatedAt: "2026-01-01T00:00:00.000Z"
    });
    expect(result.provinces).toHaveLength(1);
    expect(result.report.outputRows.schools).toBe(2);
    expect(result.report.fallbackDistricts).toHaveLength(1);
    expect(result.report.removedRows).toHaveLength(2);
    const schools = result.schoolsByProvince.get("1") ?? [];
    expect(schools.find((school) => school.id === "10")).toMatchObject({
      districtId: "1",
      provinceId: "1"
    });
    const fallbackSchool = schools.find((school) => school.id === "11");
    expect(fallbackSchool?.provinceId).toBe("1");
    expect(fallbackSchool?.districtId).toBe(result.report.fallbackDistricts[0]?.id);
    expect(result.report.unmatchedSchools).toEqual([
      expect.objectContaining({ schoolId: "11", reason: "district_not_found" })
    ]);
  });
  it("deduplicates districts only inside the same province", () => {
    const result = buildLocationData({
      provinceRows: [{ id: "1", name: "А" }, { id: "2", name: "Б" }],
      districtRows: [
        { id: "1", name: "Абай", province: "А" },
        { id: "2", name: "Абай", province: "Б" }
      ],
      schoolRows: [],
      processedFiles: 2
    });
    expect(result.districts).toEqual([
      expect.objectContaining({ id: "1", name: "Абай", provinceId: "1" }),
      expect.objectContaining({ id: "2", name: "Абай", provinceId: "2" })
    ]);
  });
});
