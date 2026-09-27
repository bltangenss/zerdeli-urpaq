import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubmissionIdFromKey } from "@/lib/submission-id";
import type { RegistrationData } from "@/lib/validation";

const routeMocks = vi.hoisted(() => ({
  appendRegistration: vi.fn(),
  findRegistrationById: vi.fn(),
  readSettings: vi.fn(),
  validateLocationHierarchy: vi.fn(),
  readJsonBody: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/env", () => ({
  getServerConfig: () => ({ SESSION_SECRET: "s".repeat(32) })
}));
vi.mock("@/lib/server/google-sheets", () => ({
  appendRegistration: routeMocks.appendRegistration,
  findRegistrationById: routeMocks.findRegistrationById,
  readSettings: routeMocks.readSettings
}));
vi.mock("@/lib/server/location-data", () => ({
  validateLocationHierarchy: routeMocks.validateLocationHierarchy
}));
vi.mock("@/lib/server/origin", () => ({
  hasAllowedOrigin: () => true,
  readJsonBody: routeMocks.readJsonBody,
  RequestBodyError: class RequestBodyError extends Error {}
}));
vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, retryAfter: 0 }),
  requestIp: () => "203.0.113.4"
}));

import { POST } from "@/app/api/registrations/route";

const idempotencyKey = "request-key-123456";
const data: RegistrationData = {
  provinceId: "1",
  districtId: "2",
  schoolId: "3",
  classTeacherFullName: "Айгүл Ахметова",
  classTeacherPhone: "+7 777 777 77 77",
  students: Array.from({ length: 10 }, (_, index) => ({
    fullName: `Оқушы ${index + 1}`,
    phone: `+7 700 000 00 ${String(index).padStart(2, "0")}`
  })),
  website: ""
};
const location = {
  provinceName: "Облыс",
  districtName: "Аудан",
  schoolName: "Мектеп"
};

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.readJsonBody.mockResolvedValue(data);
  routeMocks.readSettings.mockResolvedValue({
    registrationOpen: true,
    registrationDeadline: "",
    announcement: "",
    closedMessage: "Тіркеу жабық"
  });
  routeMocks.validateLocationHierarchy.mockResolvedValue(location);
  routeMocks.appendRegistration.mockResolvedValue(undefined);
});

describe("registration route idempotency", () => {
  it("skips a real six-character collision and appends with the deterministic next ID", async () => {
    const firstId = createSubmissionIdFromKey(idempotencyKey, "s".repeat(32), 0);
    const secondId = createSubmissionIdFromKey(idempotencyKey, "s".repeat(32), 1);
    routeMocks.findRegistrationById.mockImplementation(async (submissionId: string) =>
      submissionId === firstId ? storedRecord("+7 701 111 11 11") : null
    );

    const response = await POST(request());
    const payload = await response.json() as { data: { submissionId: string } };

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(payload.data.submissionId).toBe(secondId);
    expect(routeMocks.appendRegistration).toHaveBeenCalledWith(
      secondId,
      expect.any(String),
      data,
      location
    );
  });

  it("returns the existing ID only when every stored payload field matches", async () => {
    const firstId = createSubmissionIdFromKey(idempotencyKey, "s".repeat(32), 0);
    routeMocks.findRegistrationById.mockResolvedValue(storedRecord(data.students[9]!.phone));

    const response = await POST(request());
    const payload = await response.json() as { data: { submissionId: string } };

    expect(response.status).toBe(200);
    expect(payload.data.submissionId).toBe(firstId);
    expect(routeMocks.appendRegistration).not.toHaveBeenCalled();
  });
});

function request() {
  return new NextRequest("https://registration.example.kz/api/registrations", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey }
  });
}

function storedRecord(lastStudentPhone: string) {
  return {
    submissionId: "ignored",
    createdAt: "2026-09-26T00:00:00.000Z",
    provinceId: data.provinceId,
    provinceName: location.provinceName,
    districtId: data.districtId,
    districtName: location.districtName,
    schoolId: data.schoolId,
    schoolName: location.schoolName,
    classTeacherFullName: data.classTeacherFullName,
    classTeacherPhone: data.classTeacherPhone,
    students: data.students.map((student, index) => ({
      ...student,
      phone: index === 9 ? lastStudentPhone : student.phone
    }))
  };
}
