import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hasAllowedOrigin,
  readJsonBody
} from "@/lib/server/origin";
import { checkRateLimit, requestIp } from "@/lib/server/rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("same-origin protection", () => {
  it("normalizes the configured URL but requires an exact HTTP origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://registration.example.kz/admin/");

    expect(hasAllowedOrigin(originRequest("https://registration.example.kz"))).toBe(true);
    expect(hasAllowedOrigin(originRequest("https://evil.example.kz"))).toBe(false);
    expect(
      hasAllowedOrigin(originRequest("https://registration.example.kz", "cross-site"))
    ).toBe(false);
  });

  it("fails closed when Origin is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://registration.example.kz");
    const request = {
      headers: new Headers(),
      nextUrl: new URL("https://registration.example.kz/api/registrations")
    } as NextRequest;
    expect(hasAllowedOrigin(request)).toBe(false);
  });

  it("accepts Vercel's generated and production project origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "zerdeli-preview-abc.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "zerdeli-urpaq.vercel.app");
    expect(hasAllowedOrigin(originRequest("https://zerdeli-preview-abc.vercel.app"))).toBe(true);
    expect(hasAllowedOrigin(originRequest("https://zerdeli-urpaq.vercel.app"))).toBe(true);
  });
});

describe("bounded JSON body reader", () => {
  it("accepts JSON with a charset parameter", async () => {
    const request = bodyRequest([new TextEncoder().encode('{"ok":true}')], {
      "content-type": "application/json; charset=utf-8"
    });
    await expect(readJsonBody(request, 64)).resolves.toEqual({ ok: true });
  });

  it("rejects lookalike media types with 415", async () => {
    const request = bodyRequest([new TextEncoder().encode("{}")], {
      "content-type": "application/jsonevil"
    });
    await expect(readJsonBody(request)).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_TYPE",
      status: 415
    });
  });

  it("stops a streamed body as soon as the byte limit is crossed", async () => {
    const request = bodyRequest(
      [new TextEncoder().encode('{"value":"'), new Uint8Array(64)],
      { "content-type": "application/json" }
    );
    await expect(readJsonBody(request, 16)).rejects.toMatchObject({
      code: "BODY_TOO_LARGE",
      status: 413
    });
  });

  it("rejects an invalid declared content length", async () => {
    const request = bodyRequest([new TextEncoder().encode("{}")], {
      "content-type": "application/json",
      "content-length": "not-a-number"
    });
    await expect(readJsonBody(request)).rejects.toMatchObject({
      code: "INVALID_CONTENT_LENGTH",
      status: 400
    });
  });
});

describe("best-effort server rate limiting", () => {
  it("blocks a key after its configured allowance", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("prefers Vercel's forwarded client address", () => {
    expect(requestIp(new Headers({
      "x-vercel-forwarded-for": "203.0.113.4, 10.0.0.1",
      "x-forwarded-for": "198.51.100.8"
    }))).toBe("203.0.113.4");
  });
});

function originRequest(origin: string, fetchSite = "same-origin") {
  return {
    headers: new Headers({ origin, "sec-fetch-site": fetchSite }),
    nextUrl: new URL("https://registration.example.kz/api/registrations")
  } as NextRequest;
}

function bodyRequest(chunks: Uint8Array[], headers: HeadersInit) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  return { headers: new Headers(headers), body } as NextRequest;
}
