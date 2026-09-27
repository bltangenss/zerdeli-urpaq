import { describe, expect, it } from "vitest";
import {
  registrationMatchesPayload,
  registrationPayloadKey,
  registrationSheetValues,
  type StoredRegistrationPayload
} from "@/lib/registration-idempotency";
import type { RegistrationData } from "@/lib/validation";

const data: RegistrationData = {
  provinceId: "1",
  districtId: "2",
  schoolId: "3",
  classTeacherFullName: "=Айгүл Ахметова",
  classTeacherPhone: "+7 777 777 77 77",
  students: Array.from({ length: 10 }, (_, index) => ({
    fullName: `Оқушы ${index + 1}`,
    phone: `+7 700 000 00 ${String(index).padStart(2, "0")}`
  })),
  website: ""
};

function storedRecord(): StoredRegistrationPayload {
  return {
    provinceId: data.provinceId,
    districtId: data.districtId,
    schoolId: data.schoolId,
    classTeacherFullName: "'=Айгүл Ахметова",
    classTeacherPhone: data.classTeacherPhone,
    students: data.students.map((student) => ({ ...student }))
  };
}

describe("registration idempotency payload", () => {
  it("matches the complete normalized payload stored in Sheets", () => {
    expect(registrationMatchesPayload(storedRecord(), data)).toBe(true);
  });

  it("does not treat a six-character ID collision as the same request", () => {
    const changed = {
      ...data,
      students: data.students.map((student, index) =>
        index === 9 ? { ...student, phone: "+7 701 111 11 11" } : student
      )
    };
    expect(registrationMatchesPayload(storedRecord(), changed)).toBe(false);
    expect(registrationPayloadKey(changed)).not.toBe(registrationPayloadKey(data));
  });

  it("keeps the exact fixed Sheets column order", () => {
    const values = registrationSheetValues(data, {
      provinceName: "Облыс",
      districtName: "Аудан",
      schoolName: "Мектеп"
    });
    expect(values).toHaveLength(28);
    expect(values.slice(0, 8)).toEqual([
      "1",
      "Облыс",
      "2",
      "Аудан",
      "3",
      "Мектеп",
      "'=Айгүл Ахметова",
      "+7 777 777 77 77"
    ]);
  });
});
