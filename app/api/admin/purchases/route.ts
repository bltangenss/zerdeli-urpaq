import type { NextRequest } from "next/server";
import { apiError, apiSuccess, ADMIN_NO_STORE_HEADERS } from "@/lib/api-response";
import { purchaseStats } from "@/lib/purchases";
import { purchaseSchema } from "@/lib/validation";
import { appendPurchase, listRegistrations } from "@/lib/server/google-sheets";
import { validateProvinceDistrict } from "@/lib/server/location-data";
import { hasAllowedOrigin, readJsonBody, RequestBodyError } from "@/lib/server/origin";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getCurrentAdmin } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);

    const search = request.nextUrl.searchParams.get("search")?.trim().toLocaleLowerCase("kk-KZ") ?? "";
    const provinceId = request.nextUrl.searchParams.get("provinceId")?.trim() ?? "";
    const districtId = request.nextUrl.searchParams.get("districtId")?.trim() ?? "";
    const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const registrations = await listRegistrations();
    const all = registrations.map((registration) => ({
      purchaseId: registration.submissionId,
      purchasedAt: registration.createdAt.slice(0, 10),
      buyerFullName: registration.classTeacherFullName,
      buyerPhone: registration.classTeacherPhone,
      provinceId: registration.provinceId,
      provinceName: registration.provinceName,
      districtId: registration.districtId,
      districtName: registration.districtName,
      note: registration.schoolName,
      createdAt: registration.createdAt
    }));
    const stats = purchaseStats(all);
    const filtered = all.filter((record) => {
      if (provinceId && record.provinceId !== provinceId) return false;
      if (districtId && record.districtId !== districtId) return false;
      if (!search) return true;
      return [
        record.purchaseId,
        record.buyerFullName,
        record.buyerPhone,
        record.provinceName,
        record.districtName,
        record.note
      ].join(" ").toLocaleLowerCase("kk-KZ").includes(search);
    });
    filtered.sort(
      (left, right) =>
        right.purchasedAt.localeCompare(left.purchasedAt) || right.createdAt.localeCompare(left.createdAt)
    );
    const start = (page - 1) * PAGE_SIZE;

    return apiSuccess(
      {
        items: filtered.slice(start, start + PAGE_SIZE),
        total: filtered.length,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
        stats
      },
      200,
      ADMIN_NO_STORE_HEADERS
    );
  } catch {
    return apiError(
      "PURCHASES_UNAVAILABLE",
      "Сатып алушылар тізімін жүктеу мүмкін болмады",
      503,
      ADMIN_NO_STORE_HEADERS
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return apiError("FORBIDDEN_ORIGIN", "Сұрау қабылданбады", 403, ADMIN_NO_STORE_HEADERS);
  }

  let admin: Awaited<ReturnType<typeof getCurrentAdmin>>;
  try {
    admin = await getCurrentAdmin();
  } catch {
    return apiError("PURCHASES_UNAVAILABLE", "Сатып алушыны сақтау мүмкін болмады", 503, ADMIN_NO_STORE_HEADERS);
  }
  if (!admin) return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);

  const limit = checkRateLimit(`admin-purchases:${admin.subject}`, 30, 60_000);
  if (!limit.allowed) {
    return apiError("RATE_LIMITED", "Бір минуттан кейін қайта көріңіз", 429, {
      ...ADMIN_NO_STORE_HEADERS,
      "Retry-After": String(limit.retryAfter)
    });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 16_384);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return apiError("INVALID_REQUEST", "Сатып алушы деректерін тексеріңіз", status, ADMIN_NO_STORE_HEADERS);
  }

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Сатып алушы деректерін тексеріңіз", 400, ADMIN_NO_STORE_HEADERS);
  }
  const location = validateProvinceDistrict(parsed.data.provinceId, parsed.data.districtId);
  if (!location) {
    return apiError("LOCATION_MISMATCH", "Облыс пен ауданды қайта таңдаңыз", 400, ADMIN_NO_STORE_HEADERS);
  }

  try {
    const purchaseId = `PUR-${parsed.data.purchasedAt.slice(0, 4)}-${crypto.randomUUID()
      .replaceAll("-", "")
      .slice(0, 8)
      .toUpperCase()}`;
    const record = await appendPurchase(purchaseId, new Date().toISOString(), parsed.data, location);
    return apiSuccess(record, 201, ADMIN_NO_STORE_HEADERS);
  } catch {
    return apiError(
      "PURCHASES_UNAVAILABLE",
      "Сатып алушыны сақтау мүмкін болмады",
      503,
      ADMIN_NO_STORE_HEADERS
    );
  }
}
