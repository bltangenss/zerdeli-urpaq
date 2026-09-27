export const REGISTRATION_HEADERS = [
  "submission_id",
  "created_at",
  "province_id",
  "province_name",
  "district_id",
  "district_name",
  "school_id",
  "school_name",
  "class_teacher_full_name",
  "class_teacher_phone",
  ...Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return [`student_${number}_full_name`, `student_${number}_phone`];
  }).flat()
] as const;

export const PURCHASE_HEADERS = [
  "purchase_id",
  "purchased_at",
  "buyer_full_name",
  "buyer_phone",
  "province_id",
  "province_name",
  "district_id",
  "district_name",
  "note",
  "created_at"
] as const;

export const DEFAULT_SETTINGS = {
  registrationOpen: true,
  registrationDeadline: "",
  announcement: "",
  closedMessage: "Тіркеу уақытша жабық",
  updatedAt: ""
};

export const SETTINGS_KEYS = [
  "registration_open",
  "registration_deadline",
  "announcement",
  "closed_message",
  "updated_at"
] as const;
