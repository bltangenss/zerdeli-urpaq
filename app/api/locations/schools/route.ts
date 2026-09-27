import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import provinces from "@/src/generated/provinces.json";
import type { Province, School } from "@/lib/location-types";

export const runtime = "nodejs";

const provinceIds = new Set((provinces as Province[]).map((province) => province.id));

export async function GET(request: NextRequest) {
  const provinceId = request.nextUrl.searchParams.get("provinceId")?.trim() ?? "";
  if (!provinceIds.has(provinceId)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Облыс немесе қала табылмады" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const filePath = path.join(process.cwd(), "src", "generated", "schools-by-province", `${provinceId}.json`);
    const schools = JSON.parse(await readFile(filePath, "utf8")) as School[];
    return NextResponse.json(
      { success: true, data: { schools } },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
        }
      }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "DATA_UNAVAILABLE", message: "Мектептер тізімін жүктеу мүмкін болмады" } },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
