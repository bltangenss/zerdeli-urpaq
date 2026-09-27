export const PHONE_PATTERN = /^\+7 \d{3} \d{3} \d{2} \d{2}$/;

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  let national = digits;

  if (national.startsWith("8") && national.length >= 11) national = `7${national.slice(1)}`;
  if (!national.startsWith("7")) national = `7${national}`;
  national = national.slice(0, 11);

  const body = national.slice(1);
  const parts = [body.slice(0, 3), body.slice(3, 6), body.slice(6, 8), body.slice(8, 10)].filter(
    Boolean
  );
  return `+7${parts.length ? ` ${parts.join(" ")}` : ""}`;
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(value));
}
