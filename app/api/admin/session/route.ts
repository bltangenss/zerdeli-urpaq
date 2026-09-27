import { apiError, apiSuccess, ADMIN_NO_STORE_HEADERS } from "@/lib/api-response";
import { getCurrentAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);
    return apiSuccess({ email: admin.email }, 200, ADMIN_NO_STORE_HEADERS);
  } catch {
    return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);
  }
}
