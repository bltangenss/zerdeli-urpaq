import { describe, expect, it } from "vitest";
import { registrationSchema } from "@/lib/validation";

const validInput = {
  provinceId: "1",
  districtId: "2",
  schoolId: "3",
  classTeacherFullName: "Айгүл Серікқызы",
  classTeacherPhone: "87777777777",
  students: Array.from({ length: 10 }, (_, index) => ({
    fullName: `Оқушы Аты ${index + 1}`,
    phone: "77777777777"
  })),
  website: ""
};

describe("registration schema", () => {
  it("accepts ten students and normalizes phones", () => {
    const result = registrationSchema.parse(validInput);
    expect(result.students).toHaveLength(10);
    expect(result.classTeacherPhone).toBe("+7 777 777 77 77");
  });
  it("rejects fewer than ten students", () => {
    expect(registrationSchema.safeParse({ ...validInput, students: validInput.students.slice(0, 9) }).success).toBe(false);
  });
  it("rejects a honeypot value", () => {
    expect(registrationSchema.safeParse({ ...validInput, website: "bot" }).success).toBe(false);
  });
});
