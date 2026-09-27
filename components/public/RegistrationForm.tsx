"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { District, Province, School } from "@/lib/location-types";
import { registrationSchema, type RegistrationInput } from "@/lib/validation";
import { PhoneInput } from "@/components/form/PhoneInput";
import { SearchableSelect } from "@/components/form/SearchableSelect";

type RegistrationFormProps = {
  provinces: Province[];
  districts: District[];
};

type SuccessSummary = {
  submissionId: string;
  provinceName: string;
  districtName: string;
  schoolName: string;
  classTeacherFullName: string;
};

const defaultStudents = Array.from({ length: 10 }, () => ({ fullName: "", phone: "+7" }));

export function RegistrationForm({ provinces, districts }: RegistrationFormProps) {
  const schoolsRequestRef = useRef<AbortController | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState("");
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState<SuccessSummary | null>(null);
  const [publicSettings, setPublicSettings] = useState({
    registrationOpen: true,
    announcement: "",
    closedMessage: "Тіркеу уақытша жабық"
  });
  const [publicSettingsLoading, setPublicSettingsLoading] = useState(true);
  const [publicSettingsError, setPublicSettingsError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    shouldFocusError: true,
    defaultValues: {
      provinceId: "",
      districtId: "",
      schoolId: "",
      classTeacherFullName: "",
      classTeacherPhone: "+7",
      students: defaultStudents,
      website: ""
    }
  });

  const provinceId = useWatch({ control, name: "provinceId" });
  const districtId = useWatch({ control, name: "districtId" });
  const filteredDistricts = useMemo(
    () => districts.filter((district) => district.provinceId === provinceId),
    [districts, provinceId]
  );
  const filteredSchools = useMemo(
    () => schools.filter((school) => school.districtId === districtId),
    [districtId, schools]
  );

  const loadPublicSettings = useCallback(async () => {
    setPublicSettingsLoading(true);
    setPublicSettingsError("");
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { registrationOpen: boolean; announcement: string; closedMessage: string };
      } | null;
      if (!response.ok || !payload?.success || !payload.data) throw new Error("SETTINGS_LOAD_FAILED");
      setPublicSettings(payload.data);
    } catch {
      setPublicSettingsError(
        "Google Sheets әлі қосылмаған. Форманы толтыра аласыз, бірақ өтінім Sheets қосылғаннан кейін ғана сақталады."
      );
    } finally {
      setPublicSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPublicSettings(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPublicSettings]);

  useEffect(() => () => schoolsRequestRef.current?.abort(), []);

  async function loadSchools(nextProvinceId: string) {
    schoolsRequestRef.current?.abort();
    const request = new AbortController();
    schoolsRequestRef.current = request;
    setSchoolsLoading(true);
    setSchoolsError("");
    try {
      const response = await fetch(`/api/locations/schools?provinceId=${encodeURIComponent(nextProvinceId)}`, {
        signal: request.signal
      });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { schools: School[] };
      } | null;
      if (!response.ok || !payload?.success || !payload.data) throw new Error("SCHOOLS_LOAD_FAILED");
      setSchools(payload.data.schools);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSchools([]);
      setSchoolsError("Мектептер тізімін жүктеу мүмкін болмады.");
    } finally {
      if (schoolsRequestRef.current === request) setSchoolsLoading(false);
    }
  }

  async function handleProvinceChange(nextProvinceId: string) {
    setValue("provinceId", nextProvinceId, { shouldDirty: true, shouldValidate: true });
    setValue("districtId", "", { shouldDirty: true });
    setValue("schoolId", "", { shouldDirty: true });
    setSchools([]);
    setSchoolsError("");
    if (!nextProvinceId) {
      schoolsRequestRef.current?.abort();
      setSchoolsLoading(false);
      return;
    }
    await loadSchools(nextProvinceId);
  }

  async function onSubmit(values: RegistrationInput) {
    setServerError("");
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey
        },
        body: JSON.stringify(values)
      });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: SuccessSummary;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        setServerError(payload?.error?.message ?? "Өтінімді жіберу мүмкін болмады. Қайта көріңіз.");
        return;
      }

      setSuccess(payload.data);
    } catch {
      setServerError("Өтінімді жіберу мүмкін болмады. Интернет байланысын тексеріп, қайта көріңіз.");
    }
  }

  function startNewRegistration() {
    reset({
      provinceId: "",
      districtId: "",
      schoolId: "",
      classTeacherFullName: "",
      classTeacherPhone: "+7",
      students: defaultStudents,
      website: ""
    });
    setSchools([]);
    setSchoolsError("");
    setSuccess(null);
    setRequestKey(crypto.randomUUID());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: document.getElementById("registration-form")?.offsetTop ?? 0,
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }

  return (
    <section className="registration shell" aria-labelledby="registration-title">
      {publicSettings.announcement ? (
        <div className="announcement-banner" role="status">
          {publicSettings.announcement}
        </div>
      ) : null}
      <div className="registration-heading">
        <p className="section-kicker">ZERDELI URPAQ · 2026</p>
        <h2 id="registration-title">Қатысушыларды тіркеу</h2>
        <p>Барлық өрісті толтырып, жібермес бұрын деректерді тексеріңіз.</p>
      </div>

      {publicSettingsLoading ? (
        <div className="registration-load-status" role="status">
          <LoaderCircle className="spin" aria-hidden="true" /> Тіркеу күйі тексеріліп жатыр...
        </div>
      ) : null}

      {publicSettingsError ? (
        <div className="registration-load-error" role="alert">
          <span>{publicSettingsError}</span>
          <button type="button" onClick={() => void loadPublicSettings()}>Қайта жүктеу</button>
        </div>
      ) : null}

      {!publicSettingsLoading && !publicSettingsError && !publicSettings.registrationOpen ? (
        <div className="registration-closed" role="status">
          <strong>Тіркеу аяқталды</strong>
          <span>{publicSettings.closedMessage}</span>
        </div>
      ) : null}

      <form id="registration-form" noValidate onSubmit={handleSubmit(onSubmit)} aria-busy={publicSettingsLoading}>
        <input
          {...register("website")}
          className="honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <fieldset className="form-fieldset" disabled={publicSettingsLoading || !publicSettings.registrationOpen}>

        <FormSection number="01" title="Мектеп туралы ақпарат">
          <div className="school-grid">
            <Field label="Облыс немесе қала атауы" htmlFor="province" error={errors.provinceId?.message}>
              <Controller
                name="provinceId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    id="province"
                    value={field.value}
                    options={provinces}
                    invalid={Boolean(errors.provinceId)}
                    required
                    triggerRef={field.ref}
                    onBlur={field.onBlur}
                    placeholder="Облысты немесе қаланы таңдаңыз"
                    searchPlaceholder="Облыс немесе қала атауын жазыңыз"
                    emptyText="Облыс немесе қала табылмады"
                    onChange={(value) => void handleProvinceChange(value)}
                  />
                )}
              />
            </Field>

            <Field label="Аудан атауы" htmlFor="district" error={errors.districtId?.message}>
              <Controller
                name="districtId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    id="district"
                    value={field.value}
                    options={filteredDistricts}
                    disabled={!provinceId}
                    invalid={Boolean(errors.districtId)}
                    required
                    triggerRef={field.ref}
                    onBlur={field.onBlur}
                    placeholder="Ауданды таңдаңыз"
                    searchPlaceholder="Аудан атауын жазыңыз"
                    emptyText="Аудан табылмады"
                    onChange={(value) => {
                      field.onChange(value);
                      setValue("schoolId", "", { shouldDirty: true });
                    }}
                  />
                )}
              />
            </Field>

            <Field label="Мектеп атауы" htmlFor="school" error={errors.schoolId?.message}>
              <Controller
                name="schoolId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    id="school"
                    value={field.value}
                    options={filteredSchools}
                    disabled={!districtId || schoolsLoading || Boolean(schoolsError)}
                    loading={schoolsLoading}
                    invalid={Boolean(errors.schoolId)}
                    required
                    triggerRef={field.ref}
                    onBlur={field.onBlur}
                    placeholder="Мектепті іздеңіз немесе таңдаңыз"
                    searchPlaceholder="Мектеп атауын жазыңыз"
                    emptyText="Мектеп табылмады"
                    onChange={field.onChange}
                  />
                )}
              />
              {schoolsError ? (
                <div className="school-load-error" role="alert">
                  <span>{schoolsError}</span>
                  <button type="button" disabled={schoolsLoading} onClick={() => void loadSchools(provinceId)}>
                    Қайта жүктеу
                  </button>
                </div>
              ) : null}
            </Field>
          </div>
        </FormSection>

        <FormSection number="02" title="Сынып жетекшісі">
          <div className="teacher-grid">
            <Field
              label="Сынып жетекшінің аты-жөні"
              htmlFor="teacher-name"
              error={errors.classTeacherFullName?.message}
            >
              <input
                {...register("classTeacherFullName")}
                id="teacher-name"
                autoComplete="name"
                placeholder="Мысалы: Айгүл Серікқызы Ахметова"
                required
                aria-required="true"
                aria-invalid={Boolean(errors.classTeacherFullName) || undefined}
                aria-describedby={errors.classTeacherFullName ? "teacher-name-error" : undefined}
              />
            </Field>
            <Field
              label="Сынып жетекшінің телефон нөмірі"
              htmlFor="teacher-phone"
              helper="Байланыс нөмірін енгізіңіз"
              error={errors.classTeacherPhone?.message}
            >
              <Controller
                name="classTeacherPhone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    ref={field.ref}
                    id="teacher-phone"
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errors.classTeacherPhone) || undefined}
                    aria-describedby={errors.classTeacherPhone ? "teacher-phone-error" : "teacher-phone-helper"}
                  />
                )}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection number="03" title="Оқушылар тізімі" description="Zerdeli App-та тіркелген 10 оқушының дерегін енгізіңіз.">
          <div className="student-list">
            {defaultStudents.map((_, index) => {
              const number = String(index + 1).padStart(2, "0");
              const nameError = errors.students?.[index]?.fullName?.message;
              const phoneError = errors.students?.[index]?.phone?.message;
              return (
                <div className="student-row" key={number}>
                  <div className="student-number" aria-hidden="true">
                    <strong>{number}</strong>
                    <span>ОҚУШЫ</span>
                  </div>
                  <Field
                    label={`${index + 1}-ші оқушының аты-жөні`}
                    htmlFor={`student-${index}-name`}
                    error={nameError}
                  >
                    <input
                      {...register(`students.${index}.fullName`)}
                      id={`student-${index}-name`}
                      placeholder="Оқушының толық аты-жөні"
                      autoComplete="off"
                      required
                      aria-required="true"
                      aria-invalid={Boolean(nameError) || undefined}
                      aria-describedby={nameError ? `student-${index}-name-error` : undefined}
                    />
                  </Field>
                  <Field
                    label={`${index + 1}-ші оқушының Zerdeli App-қа тіркелген телефон нөмірі`}
                    htmlFor={`student-${index}-phone`}
                    helper="Zerdeli App-та тіркелген нөмірді енгізіңіз"
                    error={phoneError}
                  >
                    <Controller
                      name={`students.${index}.phone`}
                      control={control}
                      render={({ field }) => (
                        <PhoneInput
                          ref={field.ref}
                          id={`student-${index}-phone`}
                          name={field.name}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          required
                          aria-required="true"
                          aria-invalid={Boolean(phoneError) || undefined}
                          aria-describedby={phoneError ? `student-${index}-phone-error` : `student-${index}-phone-helper`}
                        />
                      )}
                    />
                  </Field>
                </div>
              );
            })}
          </div>

          <div className="submit-area">
            <p>Деректерді жібермес бұрын олардың дұрыстығын тексеріңіз.</p>
            {serverError ? (
              <p className="server-error" role="alert">
                {serverError}
              </p>
            ) : null}
            <button className="primary-button submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="spin" aria-hidden="true" /> Жіберіліп жатыр...
                </>
              ) : (
                <>
                  Өтінімді жіберу <Send aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </FormSection>
        </fieldset>
      </form>

      <Dialog.Root open={Boolean(success)} onOpenChange={(open) => !open && startNewRegistration()}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="success-dialog" aria-describedby="success-description">
            <Dialog.Close className="dialog-close" aria-label="Терезені жабу">
              <X aria-hidden="true" />
            </Dialog.Close>
            <CheckCircle2 className="success-icon" aria-hidden="true" />
            <Dialog.Title>Өтінім қабылданды</Dialog.Title>
            <Dialog.Description id="success-description">
              Олимпиадаға қатысушылардың деректері сәтті тіркелді.
            </Dialog.Description>
            {success ? (
              <dl className="success-summary">
                <div className="submission-code">
                  <dt>Тіркеу нөмірі</dt>
                  <dd>{success.submissionId}</dd>
                </div>
                <div>
                  <dt>Облыс/қала</dt>
                  <dd>{success.provinceName}</dd>
                </div>
                <div>
                  <dt>Аудан</dt>
                  <dd>{success.districtName}</dd>
                </div>
                <div>
                  <dt>Мектеп</dt>
                  <dd>{success.schoolName}</dd>
                </div>
                <div>
                  <dt>Сынып жетекшісі</dt>
                  <dd>{success.classTeacherFullName}</dd>
                </div>
              </dl>
            ) : null}
            <button className="primary-button dialog-action" type="button" onClick={startNewRegistration}>
              Жаңа өтінім толтыру
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function FormSection({
  number,
  title,
  description,
  children
}: {
  number: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section" aria-labelledby={`section-${number}`}>
      <div className="form-section-heading">
        <span>{number}</span>
        <div>
          <h3 id={`section-${number}`}>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  helper,
  error,
  children
}: {
  label: string;
  htmlFor: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label} <span aria-hidden="true">*</span>
      </label>
      {children}
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className="field-helper" id={`${htmlFor}-helper`}>{helper}</p>
      ) : null}
    </div>
  );
}
