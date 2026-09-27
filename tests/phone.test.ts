import { describe, expect, it } from "vitest";
import { isValidPhone, normalizePhone } from "@/lib/phone";

describe("phone normalization", () => {
  it.each([
    ["87777777777", "+7 777 777 77 77"],
    ["77777777777", "+7 777 777 77 77"],
    ["+7 (777) 777-77-77", "+7 777 777 77 77"]
  ])("normalizes %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it("rejects an incomplete phone", () => expect(isValidPhone("+7 777 12")).toBe(false));
});
