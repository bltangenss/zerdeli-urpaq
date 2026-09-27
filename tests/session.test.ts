import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser } from "@/lib/server/admin-users";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  findAdminBySubject: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet
  })
}));
vi.mock("@/lib/server/env", () => ({
  getServerConfig: () => ({ SESSION_SECRET: "s".repeat(32) })
}));
vi.mock("@/lib/server/admin-users", () => ({
  findAdminBySubject: mocks.findAdminBySubject
}));

import {
  createSession,
  deleteSession,
  getCurrentAdmin,
  sessionCookieName
} from "@/lib/server/session";

const user: AdminUser = {
  email: "admin@example.kz",
  passwordHash: "$2b$12$.....................................................",
  subject: "admin-subject",
  authVersion: "auth-version"
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAdminBySubject.mockReturnValue(user);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin session cookie", () => {
  it("issues and verifies a signed production __Host cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession(user);

    const [name, token, options] = mocks.cookieSet.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>
    ];
    expect(name).toBe("__Host-zerdeli-admin");
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60
    });

    mocks.cookieGet.mockReturnValue({ value: token });
    await expect(getCurrentAdmin()).resolves.toEqual({
      email: user.email,
      subject: user.subject
    });
  });

  it("rejects a tampered token and a password-version mismatch", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession(user);
    const token = String(mocks.cookieSet.mock.calls[0]?.[1]);

    mocks.cookieGet.mockReturnValue({ value: `${token}tampered` });
    await expect(getCurrentAdmin()).resolves.toBeNull();

    mocks.cookieGet.mockReturnValue({ value: token });
    mocks.findAdminBySubject.mockReturnValue({ ...user, authVersion: "rotated" });
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("deletes the same cookie attributes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieName()).toBe("__Host-zerdeli-admin");
    await deleteSession();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "__Host-zerdeli-admin",
      "",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0
      })
    );
  });
});
