import { readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildLocationData,
  DISTRICT_SOURCE_HEADERS,
  EXPECTED_LOCATION_SOURCE_FILES,
  parseHtmlTable,
  PROVINCE_SOURCE_HEADERS,
  SCHOOL_SOURCE_HEADERS,
  validateLocationSourceFileNames
} from "./location-data-core";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "data", "source");
const generatedDir = path.join(rootDir, "src", "generated");
const schoolsDir = path.join(generatedDir, "schools-by-province");

async function readRows(filePath: string, expectedHeaders: readonly string[]) {
  return parseHtmlTable(await readFile(filePath, "utf8"), {
    expectedHeaders,
    sourceName: path.basename(filePath)
  });
}

async function main() {
  const fileNames = (await readdir(sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const { provinceFile, districtFile, schoolFiles } = validateLocationSourceFileNames(fileNames);

  const [provinceRows, districtRows, ...schoolGroups] = await Promise.all([
    readRows(path.join(sourceDir, provinceFile), PROVINCE_SOURCE_HEADERS),
    readRows(path.join(sourceDir, districtFile), DISTRICT_SOURCE_HEADERS),
    ...schoolFiles.map((name) => readRows(path.join(sourceDir, name), SCHOOL_SOURCE_HEADERS))
  ]);

  const result = buildLocationData({
    provinceRows,
    districtRows,
    schoolRows: schoolGroups.flat(),
    processedFiles: EXPECTED_LOCATION_SOURCE_FILES.length
  });

  await rm(generatedDir, { recursive: true, force: true });
  await mkdir(schoolsDir, { recursive: true });

  await Promise.all([
    writeJson(path.join(generatedDir, "provinces.json"), result.provinces),
    writeJson(path.join(generatedDir, "districts.json"), result.districts),
    writeJson(path.join(generatedDir, "data-import-report.json"), result.report),
    writeJson(
      path.join(generatedDir, "schools-manifest.json"),
      result.provinces.map((province) => ({
        provinceId: province.id,
        file: `${province.id}.json`,
        count: result.schoolsByProvince.get(province.id)?.length ?? 0
      }))
    ),
    ...[...result.schoolsByProvince.entries()].map(([provinceId, schools]) =>
      writeJson(path.join(schoolsDir, `${provinceId}.json`), schools)
    )
  ]);

  console.log(
    `Өңделді: ${EXPECTED_LOCATION_SOURCE_FILES.length} файл, ${result.provinces.length} облыс/қала, ${result.districts.length} аудан, ${result.report.outputRows.schools} мектеп.`
  );
  console.log(
    `Тазартылды: ${result.report.removedRows.length} жол, қайталанғаны: ${result.report.duplicates.length}, fallback аудан: ${result.report.fallbackDistricts.length}.`
  );
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Белгісіз қате";
  console.error(`Деректерді дайындау қатесі: ${message}`);
  process.exitCode = 1;
});
