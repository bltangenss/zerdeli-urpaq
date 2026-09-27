import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { registrationSchema } from "@/lib/validation";
import { createSubmissionIdFromKey } from "@/lib/submission-id";
import {
  registrationMatchesPayload,
  registrationPayloadKey,
  type RegistrationLocationNames
} from "@/lib/registration-idempotency";
import { getServerConfig } from "@/lib/server/env";
import {
  appendRegistration,
  findRegistrationById,
  readSettings
} from "@/lib/server/google-sheets";
import { validateLocationHierarchy } from "@/lib/server/location-data";
import { hasAllowedOrigin, readJsonBody, RequestBodyError } from "@/lib/server/origin";
import { checkRateLimit, requestIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SafeSummary = {
  submissionId: string;
  provinceName: string;
  districtName: string;
  schoolName: string;
  classTeacherFullName: string;
};

const MAX_SUBMISSION_ID_ATTEMPTS = 16;
const pending = new Map<string, { payloadKey: string; promise: Promise<SafeSummary> }>();

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return apiError("FORBIDDEN_ORIGIN", "Сұрау қабылданбады", 403);
  }

  const limit = checkRateLimit(`registration:${requestIp(request.headers)}`, 5, 60_000);
  if (!limit.allowed) {
    return apiError("RATE_LIMITED", "Бір минуттан кейін қайта көріңіз", 429, {
      "Retry-After": String(limit.retryAfter)
    });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
    return apiError("INVALID_IDEMPOTENCY_KEY", "Сұрауды қайта жаңартып көріңіз", 400);
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return apiError(error.code, "Сұрау деректері дұрыс емес", error.status);
    }
    return apiError("INVALID_REQUEST", "Сұрау деректері дұрыс емес", 400);
  }

  const parsed = registrationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Толтырылмаған немесе қате өрістер бар", 400);
  }
  if (parsed.data.website) return apiError("VALIDATION_ERROR", "Сұрау қабылданбады", 400);

  try {
    const config = getServerConfig();
    const location = await validateLocationHierarchy(
      parsed.data.provinceId,
      parsed.data.districtId,
      parsed.data.schoolId
    );
    if (!location) {
      return apiError("LOCATION_MISMATCH", "Мектеп деректерін қайта таңдаңыз", 400);
    }

    const settings = await readSettings();
    const deadlinePassed = settings.registrationDeadline
      ? Date.parse(settings.registrationDeadline) <= Date.now()
      : false;
    if (!settings.registrationOpen || deadlinePassed) {
      return apiError("REGISTRATION_CLOSED", settings.closedMessage || "Тіркеу аяқталды", 403);
    }

    const payloadKey = registrationPayloadKey(parsed.data);
    for (let attempt = 0; attempt < MAX_SUBMISSION_ID_ATTEMPTS; attempt += 1) {
      const submissionId = createSubmissionIdFromKey(idempotencyKey, config.SESSION_SECRET, attempt);
      const existing = await findRegistrationById(submissionId);
      if (existing) {
        if (registrationMatchesPayload(existing, parsed.data)) {
          return apiSuccess(toSummary(submissionId, parsed.data.classTeacherFullName, location), 200);
        }
        continue;
      }

      const inFlight = pending.get(submissionId);
      if (inFlight) {
        if (inFlight.payloadKey === payloadKey) {
          return apiSuccess(await inFlight.promise, 200);
        }
        continue;
      }

      const task = (async () => {
        const createdAt = new Date().toISOString();
        await appendRegistration(submissionId, createdAt, parsed.data, location);
        return toSummary(submissionId, parsed.data.classTeacherFullName, location);
      })();
      pending.set(submissionId, { payloadKey, promise: task });
      try {
        return apiSuccess(await task, 201);
      } finally {
        if (pending.get(submissionId)?.promise === task) pending.delete(submissionId);
      }
    }

    return apiError(
      "SUBMISSION_ID_COLLISION",
      "Өтінімді тіркеу нөмірін жасау мүмкін болмады. Қайта көріңіз.",
      503
    );
  } catch {
    return apiError(
      "REGISTRATION_UNAVAILABLE",
      "Өтінімді жіберу мүмкін болмады. Қайта көріңіз.",
      503
    );
  }
}

function toSummary(
  submissionId: string,
  classTeacherFullName: string,
  location: RegistrationLocationNames
): SafeSummary {
  return {
    submissionId,
    provinceName: location.provinceName,
    districtName: location.districtName,
    schoolName: location.schoolName,
    classTeacherFullName
  };
}
