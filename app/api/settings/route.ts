import { apiError, apiSuccess } from "@/lib/api-response";
import { readSettings } from "@/lib/server/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await readSettings();
    const deadlinePassed = settings.registrationDeadline
      ? Date.parse(settings.registrationDeadline) <= Date.now()
      : false;
    return apiSuccess(
      { ...settings, registrationOpen: settings.registrationOpen && !deadlinePassed },
      200,
      { "Cache-Control": "public, max-age=0, s-maxage=20, stale-while-revalidate=30" }
    );
  } catch {
    return apiError(
      "SETTINGS_UNAVAILABLE",
      "Тіркелу баптауларын жүктеу мүмкін болмады",
      503,
      { "Cache-Control": "no-store" }
    );
  }
}
