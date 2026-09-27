import type { NextRequest } from "next/server";
import { apiError, apiSuccess, ADMIN_NO_STORE_HEADERS } from "@/lib/api-response";
import { listRegistrations } from "@/lib/server/google-sheets";
import { getCurrentAdmin } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);

    const search = request.nextUrl.searchParams.get("search")?.trim().toLocaleLowerCase("kk-KZ") ?? "";
    const provinceId = request.nextUrl.searchParams.get("provinceId")?.trim() ?? "";
    const districtId = request.nextUrl.searchParams.get("districtId")?.trim() ?? "";
    const schoolId = request.nextUrl.searchParams.get("schoolId")?.trim() ?? "";
    const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = 50;
    const all = await listRegistrations();
    const filterOptions = {
      provinces: uniqueOptions(all, "provinceId", "provinceName"),
      districts: uniqueOptions(all, "districtId", "districtName", "provinceId"),
      schools: uniqueOptions(all, "schoolId", "schoolName", "districtId")
    };
    const filtered = all.filter((row) => {
      if (provinceId && row.provinceId !== provinceId) return false;
      if (districtId && row.districtId !== districtId) return false;
      if (schoolId && row.schoolId !== schoolId) return false;
      if (!search) return true;
      return [row.submissionId, row.schoolName, row.classTeacherFullName, row.classTeacherPhone]
        .join(" ")
        .toLocaleLowerCase("kk-KZ")
        .includes(search);
    });
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map(({ students, ...summary }) => {
      void students;
      return summary;
    });
    return apiSuccess(
      {
        items,
        total: filtered.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        filterOptions
      },
      200,
      ADMIN_NO_STORE_HEADERS
    );
  } catch {
    return apiError("REGISTRATIONS_UNAVAILABLE", "Өтінімдерді жүктеу мүмкін болмады", 503, ADMIN_NO_STORE_HEADERS);
  }
}

function uniqueOptions<T extends Record<string, unknown>>(
  items: T[],
  idKey: keyof T,
  nameKey: keyof T,
  parentKey?: keyof T
) {
  return [
    ...new Map(
      items.map((item) => {
        const id = String(item[idKey]);
        return [id, {
          id,
          name: String(item[nameKey]),
          ...(parentKey ? { parentId: String(item[parentKey]) } : {})
        }];
      })
    ).values()
  ].sort((a, b) => a.name.localeCompare(b.name, "kk-KZ", { numeric: true }));
}
