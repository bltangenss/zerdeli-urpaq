import { apiError, apiSuccess, ADMIN_NO_STORE_HEADERS } from "@/lib/api-response";
import { findRegistrationById } from "@/lib/server/google-sheets";
import { getCurrentAdmin } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/admin/registrations/[submissionId]">) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return apiError("UNAUTHORIZED", "Авторизация қажет", 401, ADMIN_NO_STORE_HEADERS);
    const { submissionId } = await context.params;
    if (!/^ZU-2026-[A-Z2-9]{6}$/.test(submissionId)) {
      return apiError("NOT_FOUND", "Өтінім табылмады", 404, ADMIN_NO_STORE_HEADERS);
    }
    const record = await findRegistrationById(submissionId);
    if (!record) return apiError("NOT_FOUND", "Өтінім табылмады", 404, ADMIN_NO_STORE_HEADERS);
    return apiSuccess(record, 200, ADMIN_NO_STORE_HEADERS);
  } catch {
    return apiError("REGISTRATION_UNAVAILABLE", "Өтінімді жүктеу мүмкін болмады", 503, ADMIN_NO_STORE_HEADERS);
  }
}
