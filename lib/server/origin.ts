import "server-only";
import type { NextRequest } from "next/server";

export function hasAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const allowed = new Set<string>();
  if (process.env.NODE_ENV !== "production") allowed.add(request.nextUrl.origin);
  const appOrigin = normalizeHttpOrigin(process.env.APP_ORIGIN);
  if (appOrigin) allowed.add(appOrigin);
  const vercelOrigin = normalizeHttpOrigin(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : undefined
  );
  if (vercelOrigin) allowed.add(vercelOrigin);
  const vercelBranchOrigin = normalizeHttpOrigin(
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL.trim()}` : undefined
  );
  if (vercelBranchOrigin) allowed.add(vercelBranchOrigin);
  const vercelProductionOrigin = normalizeHttpOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : undefined
  );
  if (vercelProductionOrigin) allowed.add(vercelProductionOrigin);

  try {
    const requestOrigin = normalizeHttpOrigin(origin);
    return requestOrigin !== null && allowed.has(requestOrigin);
  } catch {
    return false;
  }
}

function normalizeHttpOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export async function readJsonBody(request: NextRequest, maxBytes = 32_768): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new RequestBodyError("UNSUPPORTED_MEDIA_TYPE", 415);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const normalizedLength = contentLength.trim();
    if (!/^\d+$/.test(normalizedLength)) {
      throw new RequestBodyError("INVALID_CONTENT_LENGTH", 400);
    }
    if (Number(normalizedLength) > maxBytes) {
      throw new RequestBodyError("BODY_TOO_LARGE", 413);
    }
  }

  const body = await readBodyText(request, maxBytes);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RequestBodyError("INVALID_JSON", 400);
  }
}

async function readBodyText(request: NextRequest, maxBytes: number): Promise<string> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError("BODY_TOO_LARGE", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export class RequestBodyError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
}
