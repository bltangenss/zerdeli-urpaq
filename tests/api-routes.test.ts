import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  listRegistrations: vi.fn(),
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
  checkSheetsConnection: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: routeMocks.revalidatePath }));
vi.mock("@/lib/server/session", () => ({
  getCurrentAdmin: routeMocks.getCurrentAdmin
}));
vi.mock("@/lib/server/google-sheets", () => ({
  listRegistrations: routeMocks.listRegistrations,
  readSettings: routeMocks.readSettings,
  writeSettings: routeMocks.writeSettings,
  checkSheetsConnection: routeMocks.checkSheetsConnection
}));

import { apiSuccess } from "@/lib/api-response";
import { GET as getPublicSettings } from "@/app/api/settings/route";
import { PATCH as patchAdminSettings } from "@/app/api/admin/settings/route";
import { GET as getAdminRegistrations } from "@/app/api/admin/registrations/route";

const settings = {
  registrationOpen: true,
  registrationDeadline: "",
  announcement: "",
  closedMessage: "Тіркеу уақытша жабық",
  updatedAt: "2026-09-26T00:00:00.000Z"
};

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getCurrentAdmin.mockResolvedValue({
    email: "admin@example.kz",
    subject: "admin-subject"
  });
  routeMocks.readSettings.mockResolvedValue(settings);
  routeMocks.writeSettings.mockResolvedValue(settings);
  routeMocks.checkSheetsConnection.mockResolvedValue("2026-09-26T00:00:00.000Z");
  routeMocks.listRegistrations.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API caching and DTO boundaries", () => {
  it("defaults uncategorized JSON API responses to no-store", () => {
    const response = apiSuccess({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("allows only the public settings GET to use the short shared cache", async () => {
    const response = await getPublicSettings();
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=20, stale-while-revalidate=30"
    );
  });

  it("revalidates the public settings route after an authenticated update", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://registration.example.kz");
    const request = new NextRequest("https://registration.example.kz/api/admin/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: "https://registration.example.kz",
        "sec-fetch-site": "same-origin"
      },
      body: JSON.stringify({
        registrationOpen: true,
        registrationDeadline: "",
        announcement: "",
        closedMessage: "Тіркеу уақытша жабық"
      })
    });

    const response = await patchAdminSettings(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(routeMocks.writeSettings).toHaveBeenCalledOnce();
    expect(routeMocks.revalidatePath).toHaveBeenCalledWith("/api/settings");
  });

  it.each(["Infinity", "1.5", "0", "not-a-number"])(
    "normalizes an invalid admin page value (%s) to page 1",
    async (page) => {
      const request = new NextRequest(
        `https://registration.example.kz/api/admin/registrations?page=${encodeURIComponent(page)}`
      );
      const response = await getAdminRegistrations(request);
      const payload = await response.json() as { data: { page: number } };
      expect(response.status).toBe(200);
      expect(payload.data.page).toBe(1);
    }
  );
});
