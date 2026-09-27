const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/gu;
const DANGEROUS_SHEET_PREFIX = /^[=+\-@]/u;

export function normalizeUserText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function sanitizeSheetValue(value: string): string {
  const normalized = normalizeUserText(value);
  return DANGEROUS_SHEET_PREFIX.test(normalized) ? `'${normalized}` : normalized;
}
