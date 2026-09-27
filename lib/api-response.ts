import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json({ success: true, data }, { status, headers: headers ?? NO_STORE_HEADERS });
}

export function apiError(code: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: headers ?? NO_STORE_HEADERS }
  );
}

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0"
};

export const ADMIN_NO_STORE_HEADERS = {
  ...NO_STORE_HEADERS,
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie"
};
