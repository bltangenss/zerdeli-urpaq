import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import districtsJson from "@/src/generated/districts.json";
import provincesJson from "@/src/generated/provinces.json";
import type { District, Province, School } from "@/lib/location-types";

const provinces = provincesJson as Province[];
const districts = districtsJson as District[];

export function validateProvinceDistrict(provinceId: string, districtId: string) {
  const province = provinces.find((item) => item.id === provinceId);
  if (!province) return null;
  const district = districts.find((item) => item.id === districtId && item.provinceId === provinceId);
  if (!district) return null;
  return { provinceName: province.name, districtName: district.name };
}

export async function validateLocationHierarchy(provinceId: string, districtId: string, schoolId: string) {
  const location = validateProvinceDistrict(provinceId, districtId);
  if (!location) return null;

  try {
    const filePath = path.join(process.cwd(), "src", "generated", "schools-by-province", `${provinceId}.json`);
    const schools = JSON.parse(await readFile(filePath, "utf8")) as School[];
    const school = schools.find(
      (item) => item.id === schoolId && item.provinceId === provinceId && item.districtId === districtId
    );
    if (!school) return null;
    return {
      provinceName: location.provinceName,
      districtName: location.districtName,
      schoolName: school.name
    };
  } catch {
    return null;
  }
}

export function locationCatalog() {
  return { provinces, districts };
}
