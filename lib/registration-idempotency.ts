import type { RegistrationData } from "./validation";
import { sanitizeSheetValue } from "./sanitize";

export type StoredRegistrationPayload = {
  provinceId: string;
  districtId: string;
  schoolId: string;
  classTeacherFullName: string;
  classTeacherPhone: string;
  students: Array<{ fullName: string; phone: string }>;
};

export type RegistrationLocationNames = {
  provinceName: string;
  districtName: string;
  schoolName: string;
};

export function registrationPayloadKey(data: RegistrationData): string {
  return JSON.stringify(registrationIdentityValues(data));
}

export function registrationMatchesPayload(
  record: StoredRegistrationPayload,
  data: RegistrationData
): boolean {
  return JSON.stringify(recordIdentityValues(record)) === registrationPayloadKey(data);
}

export function registrationSheetValues(
  data: RegistrationData,
  location: RegistrationLocationNames
): string[] {
  return [
    data.provinceId,
    sanitizeSheetValue(location.provinceName),
    data.districtId,
    sanitizeSheetValue(location.districtName),
    data.schoolId,
    sanitizeSheetValue(location.schoolName),
    sanitizeSheetValue(data.classTeacherFullName),
    data.classTeacherPhone,
    ...data.students.flatMap((student) => [sanitizeSheetValue(student.fullName), student.phone])
  ];
}

function registrationIdentityValues(data: RegistrationData): string[] {
  return [
    data.provinceId,
    data.districtId,
    data.schoolId,
    sanitizeSheetValue(data.classTeacherFullName),
    data.classTeacherPhone,
    ...data.students.flatMap((student) => [sanitizeSheetValue(student.fullName), student.phone])
  ];
}

function recordIdentityValues(record: StoredRegistrationPayload): string[] {
  return [
    record.provinceId,
    record.districtId,
    record.schoolId,
    record.classTeacherFullName,
    record.classTeacherPhone,
    ...record.students.flatMap((student) => [student.fullName, student.phone])
  ];
}
