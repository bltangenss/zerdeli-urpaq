import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, apiSuccess, ADMIN_NO_STORE_HEADERS } from "@/lib/api-response";
import { settingsSchema } from "@/lib/validation";
import { checkSheetsConnection, readSettings, writeSettings } from "@/lib/server/google-sheets";
import { hasAllowedOrigin, readJsonBody, RequestBodyError } from "@/lib/server/origin";
import { getCurrentAdmin } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);
    const [settings, checkedAt] = await Promise.all([readSettings(), checkSheetsConnection()]);
    return apiSuccess(
      { settings, connection: { status: "connected", checkedAt } },
      200,
      ADMIN_NO_STORE_HEADERS
    );
  } catch {
    return apiError("SETTINGS_UNAVAILABLE", "Баптауларды жүктеу мүмкін болмады", 503, ADMIN_NO_STORE_HEADERS);
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return apiError("FORBIDDEN_ORIGIN", "Сұрау қабылданбады", 403, ADMIN_NO_STORE_HEADERS);
  }
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);
    const body = await readJsonBody(request, 8192);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return apiError("VALIDATION_ERROR", "Баптауларды тексеріңіз", 400, ADMIN_NO_STORE_HEADERS);
    const settings = await writeSettings(parsed.data);
    revalidatePath("/api/settings");
    return apiSuccess({ settings }, 200, ADMIN_NO_STORE_HEADERS);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 503;
    return apiError("SETTINGS_UNAVAILABLE", "Баптауларды сақтау мүмкін болмады", status, ADMIN_NO_STORE_HEADERS);
  }
}
