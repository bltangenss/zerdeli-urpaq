import type { NextRequest } from "next/server";
import { apiError, apiSuccess, ADMIN_NO_STORE_HEADERS } from "@/lib/api-response";
import { hasAllowedOrigin } from "@/lib/server/origin";
import { deleteSession } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return apiError("FORBIDDEN_ORIGIN", "Сұрау қабылданбады", 403, ADMIN_NO_STORE_HEADERS);
  }
  await deleteSession();
  return apiSuccess({ loggedOut: true }, 200, ADMIN_NO_STORE_HEADERS);
}
