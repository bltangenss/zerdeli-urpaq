import { z } from "zod";
import { normalizePhone, PHONE_PATTERN } from "./phone";
import { normalizeUserText } from "./sanitize";

const fullNameSchema = z
  .string()
  .transform(normalizeUserText)
  .pipe(
    z
      .string()
      .min(3, "Аты-жөнін толық енгізіңіз")
      .max(120, "Аты-жөні 120 таңбадан аспауы керек")
      .refine((value) => /\p{L}/u.test(value), "Аты-жөнін толық енгізіңіз")
  );

const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(PHONE_PATTERN, "Телефон нөмірі +7 777 777 77 77 форматында болуы керек"));

export const studentSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema
});

export const registrationSchema = z.object({
  provinceId: z.string().min(1, "Облысты немесе қаланы таңдаңыз"),
  districtId: z.string().min(1, "Ауданды таңдаңыз"),
  schoolId: z.string().min(1, "Мектепті таңдаңыз"),
  classTeacherFullName: fullNameSchema,
  classTeacherPhone: phoneSchema,
  students: z.array(studentSchema).length(10, "Дәл 10 оқушының дерегін енгізіңіз"),
  website: z.string().max(0).optional().default("")
});

export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationData = z.output<typeof registrationSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email мекенжайын дұрыс енгізіңіз"),
  password: z.string().min(1, "Құпиясөзді енгізіңіз").max(72, "Құпиясөз тым ұзын")
});

export const settingsSchema = z.object({
  registrationOpen: z.boolean(),
  registrationDeadline: z
    .union([z.string().datetime({ offset: true }), z.literal("")])
    .default(""),
  announcement: z.string().transform(normalizeUserText).pipe(z.string().max(500)),
  closedMessage: z
    .string()
    .transform(normalizeUserText)
    .pipe(z.string().min(1).max(500))
});

export type RegistrationSettings = z.infer<typeof settingsSchema> & { updatedAt?: string };

const purchaseDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Сатып алу күнін таңдаңыз")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Сатып алу күні дұрыс емес");

export const purchaseSchema = z.object({
  purchasedAt: purchaseDateSchema,
  buyerFullName: fullNameSchema,
  buyerPhone: phoneSchema,
  provinceId: z.string().min(1, "Облысты немесе қаланы таңдаңыз"),
  districtId: z.string().min(1, "Ауданды таңдаңыз"),
  note: z.string().transform(normalizeUserText).pipe(z.string().max(500)).default("")
});

export type PurchaseInput = z.input<typeof purchaseSchema>;
export type PurchaseData = z.output<typeof purchaseSchema>;
