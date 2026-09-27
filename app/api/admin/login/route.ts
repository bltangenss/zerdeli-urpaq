import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { apiError, apiSuccess, ADMIN_NO_STORE_HEADERS } from "@/lib/api-response";
import { loginSchema } from "@/lib/validation";
import { findAdminByEmail } from "@/lib/server/admin-users";
import { hasAllowedOrigin, readJsonBody, RequestBodyError } from "@/lib/server/origin";
import { checkRateLimit, requestIp } from "@/lib/server/rate-limit";
import { createSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUMMY_HASH = bcrypt.hashSync("zerdeli-dummy-password", 12);

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return apiError("FORBIDDEN_ORIGIN", "Сұрау қабылданбады", 403, ADMIN_NO_STORE_HEADERS);
  }

  const ip = requestIp(request.headers);
  const ipLimit = checkRateLimit(`admin-login-ip:${ip}`, 5, 15 * 60_000);
  if (!ipLimit.allowed) {
    return apiError("RATE_LIMITED", "Кейінірек қайта көріңіз", 429, {
      ...ADMIN_NO_STORE_HEADERS,
      "Retry-After": String(ipLimit.retryAfter)
    });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 4096);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return apiError("INVALID_REQUEST", "Email немесе құпиясөз қате", status, ADMIN_NO_STORE_HEADERS);
  }

  const parsed = loginSchema.safeParse(body);
  const email = parsed.success ? parsed.data.email : "invalid@example.invalid";
  const emailLimit = checkRateLimit(`admin-login-email:${email}`, 10, 60 * 60_000);
  if (!emailLimit.allowed) {
    return apiError("RATE_LIMITED", "Кейінірек қайта көріңіз", 429, {
      ...ADMIN_NO_STORE_HEADERS,
      "Retry-After": String(emailLimit.retryAfter)
    });
  }

  try {
    const user = parsed.success ? findAdminByEmail(parsed.data.email) : undefined;
    const password = parsed.success ? parsed.data.password : "invalid-password";
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!parsed.success || !user || !valid) {
      return apiError("INVALID_CREDENTIALS", "Email немесе құпиясөз қате", 401, ADMIN_NO_STORE_HEADERS);
    }
    await createSession(user);
    return apiSuccess({ email: user.email }, 200, ADMIN_NO_STORE_HEADERS);
  } catch {
    return apiError("LOGIN_UNAVAILABLE", "Кіру мүмкін болмады. Қайта көріңіз.", 503, ADMIN_NO_STORE_HEADERS);
  }
}
