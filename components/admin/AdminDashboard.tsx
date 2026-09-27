"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import { Eye, LoaderCircle, LogOut, RefreshCw, Save, Search, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuyersPanel } from "@/components/admin/BuyersPanel";
import { BrandMark } from "@/components/public/SiteHeader";
import type { District, Province } from "@/lib/location-types";

type Summary = {
  submissionId: string;
  createdAt: string;
  provinceId: string;
  provinceName: string;
  districtId: string;
  districtName: string;
  schoolId: string;
  schoolName: string;
  classTeacherFullName: string;
  classTeacherPhone: string;
};

type Detail = Summary & { students: Array<{ fullName: string; phone: string }> };

type FilterOption = { id: string; name: string; parentId?: string };
type FilterOptions = {
  provinces: FilterOption[];
  districts: FilterOption[];
  schools: FilterOption[];
};

type SettingsPayload = {
  registrationOpen: boolean;
  registrationDeadline: string;
  announcement: string;
  closedMessage: string;
  updatedAt?: string;
};

const EMPTY_SETTINGS: SettingsPayload = {
  registrationOpen: true,
  registrationDeadline: "",
  announcement: "",
  closedMessage: "Тіркеу уақытша жабық"
};

export function AdminDashboard({
  email,
  provinces: purchaseProvinces,
  districts: purchaseDistricts
}: {
  email: string;
  provinces: Province[];
  districts: District[];
}) {
  const router = useRouter();
  const registrationsRequestRef = useRef<AbortController | null>(null);
  const detailRequestRef = useRef<AbortController | null>(null);
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ provinces: [], districts: [], schools: [] });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailSubmissionId, setDetailSubmissionId] = useState("");
  const [settings, setSettings] = useState<SettingsPayload>(EMPTY_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsLoadError, setSettingsLoadError] = useState("");
  const [connection, setConnection] = useState<{ status: string; checkedAt: string } | null>(null);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsMessageError, setSettingsMessageError] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const loadRegistrations = useCallback(async () => {
    registrationsRequestRef.current?.abort();
    const request = new AbortController();
    registrationsRequestRef.current = request;
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (provinceId) params.set("provinceId", provinceId);
    if (districtId) params.set("districtId", districtId);
    if (schoolId) params.set("schoolId", schoolId);
    params.set("page", String(page));
    try {
      const response = await fetch(`/api/admin/registrations?${params}`, {
        cache: "no-store",
        signal: request.signal
      });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { items: Summary[]; total: number; totalPages: number; filterOptions: FilterOptions };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error?.message);
      setItems(payload.data.items);
      setTotal(payload.data.total);
      setTotalPages(payload.data.totalPages);
      setFilterOptions(payload.data.filterOptions);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setLoadError("Өтінімдерді жүктеу мүмкін болмады");
    } finally {
      if (registrationsRequestRef.current === request) setLoading(false);
    }
  }, [districtId, page, provinceId, schoolId, search]);

  useEffect(() => {
    registrationsRequestRef.current?.abort();
    const timer = window.setTimeout(() => void loadRegistrations(), 220);
    return () => window.clearTimeout(timer);
  }, [loadRegistrations]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsLoadError("");
    setSettingsMessage("");
    setSettingsMessageError(false);
    setConnection(null);
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { settings: SettingsPayload; connection: { status: string; checkedAt: string } };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error?.message);
      setSettings(payload.data.settings);
      setConnection(payload.data.connection);
    } catch {
      setSettingsLoadError("Баптауларды жүктеу мүмкін болмады");
      setConnection({ status: "error", checkedAt: new Date().toISOString() });
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0);
    return () => {
      window.clearTimeout(timer);
      registrationsRequestRef.current?.abort();
      detailRequestRef.current?.abort();
    };
  }, [loadSettings]);

  const provinces = filterOptions.provinces;
  const districts = useMemo(
    () => filterOptions.districts.filter((option) => !provinceId || option.parentId === provinceId),
    [filterOptions.districts, provinceId]
  );
  const schools = useMemo(
    () => {
      if (districtId) return filterOptions.schools.filter((option) => option.parentId === districtId);
      if (!provinceId) return filterOptions.schools;
      const districtIds = new Set(districts.map((option) => option.id));
      return filterOptions.schools.filter((option) => Boolean(option.parentId && districtIds.has(option.parentId)));
    },
    [districtId, districts, filterOptions.schools, provinceId]
  );

  async function openDetail(submissionId: string) {
    detailRequestRef.current?.abort();
    const request = new AbortController();
    detailRequestRef.current = request;
    setDetailSubmissionId(submissionId);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    try {
      const response = await fetch(`/api/admin/registrations/${submissionId}`, {
        cache: "no-store",
        signal: request.signal
      });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: Detail;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error?.message);
      setDetail(payload.data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDetailError("Өтінім туралы толық ақпаратты жүктеу мүмкін болмады");
    } finally {
      if (detailRequestRef.current === request) setDetailLoading(false);
    }
  }

  async function logout() {
    setLogoutPending(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setLogoutError("Жүйеден шығу мүмкін болмады");
    } finally {
      setLogoutPending(false);
    }
  }

  async function saveSettings() {
    const closedMessage = settings.closedMessage.trim();
    if (!closedMessage) {
      setSettingsMessage("Тіркеу жабық кездегі мәтінді толтырыңыз");
      setSettingsMessageError(true);
      return;
    }
    setSettingsPending(true);
    setSettingsMessage("");
    setSettingsMessageError(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, closedMessage })
      });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { settings: SettingsPayload };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data) {
        setSettingsMessage(payload?.error?.message ?? "Баптауларды сақтау мүмкін болмады");
        setSettingsMessageError(true);
        return;
      }
      setSettings(payload.data.settings);
      setSettingsMessage("Баптаулар сақталды");
    } catch {
      setSettingsMessage("Баптауларды сақтау мүмкін болмады");
      setSettingsMessageError(true);
    } finally {
      setSettingsPending(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link href="/" aria-label="Басты бет"><BrandMark /></Link>
        <div className="admin-account">
          <div className="admin-account-copy">
            <span>{email}</span>
            {logoutError ? <small className="admin-account-error" role="alert">{logoutError}</small> : null}
          </div>
          <button type="button" onClick={() => void logout()} disabled={logoutPending} aria-busy={logoutPending}>
            {logoutPending ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />} Шығу
          </button>
        </div>
      </header>

      <Tabs.Root defaultValue="registrations" className="admin-tabs">
        <Tabs.List aria-label="Әкімші панелі">
          <Tabs.Trigger value="registrations">Өтінімдер</Tabs.Trigger>
          <Tabs.Trigger value="buyers">Сатып алғандар</Tabs.Trigger>
          <Tabs.Trigger value="settings">Баптаулар</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="registrations" className="admin-panel">
          <div className="admin-title-row"><div><h1>Өтінімдер</h1><p>Google Sheets-ке тіркелген өтінімдер тізімі</p></div><button className="icon-button" type="button" onClick={() => void loadRegistrations()} aria-label="Тізімді жаңарту" aria-busy={loading} disabled={loading}><RefreshCw className={loading ? "spin" : undefined} aria-hidden="true" /></button></div>
          <div className="admin-filters">
            <label className="admin-search" htmlFor="admin-search">
              <span className="sr-only">Өтінімдерді іздеу</span>
              <Search aria-hidden="true" />
              <input id="admin-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Мектеп, жетекші, нөмір немесе телефон" />
            </label>
            <label className="admin-filter-select" htmlFor="admin-province-filter">
              <span className="sr-only">Облыс немесе қала бойынша сүзгі</span>
              <select id="admin-province-filter" value={provinceId} onChange={(event) => { setProvinceId(event.target.value); setDistrictId(""); setSchoolId(""); setPage(1); }}><option value="">Барлық облыс/қала</option>{provinces.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
            </label>
            <label className="admin-filter-select" htmlFor="admin-district-filter">
              <span className="sr-only">Аудан бойынша сүзгі</span>
              <select id="admin-district-filter" value={districtId} onChange={(event) => { setDistrictId(event.target.value); setSchoolId(""); setPage(1); }}><option value="">Барлық аудан</option>{districts.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
            </label>
            <label className="admin-filter-select" htmlFor="admin-school-filter">
              <span className="sr-only">Мектеп бойынша сүзгі</span>
              <select id="admin-school-filter" value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setPage(1); }}><option value="">Барлық мектеп</option>{schools.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
            </label>
            <button className="clear-button" type="button" onClick={() => { setSearch(""); setProvinceId(""); setDistrictId(""); setSchoolId(""); setPage(1); }}>Тазалау</button>
          </div>
          {loadError ? <p className="admin-notice error" role="alert">{loadError}</p> : null}
          <div className="admin-table-wrap" aria-busy={loading}>
            {loading ? <div className="admin-loading" role="status"><LoaderCircle className="spin" aria-hidden="true" /> Жүктеліп жатыр...</div> : items.length ? <>
              <table className="admin-table"><caption className="sr-only">Тіркелген өтінімдер</caption><thead><tr><th>Тіркеу нөмірі</th><th>Күні</th><th>Облыс/қала</th><th>Аудан</th><th>Мектеп</th><th>Сынып жетекшісі</th><th>Телефон</th><th>Әрекет</th></tr></thead><tbody>{items.map((item) => <tr key={item.submissionId}><td><strong>{item.submissionId}</strong></td><td>{formatDate(item.createdAt)}</td><td>{item.provinceName}</td><td>{item.districtName}</td><td className="school-cell">{item.schoolName}</td><td>{item.classTeacherFullName}</td><td>{item.classTeacherPhone}</td><td><button className="view-button" type="button" onClick={() => void openDetail(item.submissionId)}><Eye aria-hidden="true" /> Толық көру</button></td></tr>)}</tbody></table>
              <div className="admin-cards">{items.map((item) => <article key={item.submissionId}><div><strong>{item.submissionId}</strong><span>{formatDate(item.createdAt)}</span></div><h3>{item.schoolName}</h3><p>{item.provinceName}, {item.districtName}</p><p>{item.classTeacherFullName}<br />{item.classTeacherPhone}</p><button className="view-button" type="button" onClick={() => void openDetail(item.submissionId)}><Eye aria-hidden="true" /> Толық көру</button></article>)}</div>
            </> : <div className="admin-empty">Өтінімдер табылмады</div>}
          </div>
          {!loading && !loadError ? (
            <nav className="admin-pagination" aria-label="Өтінімдер беттері">
              <p>Барлығы: <strong>{total}</strong></p>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Алдыңғы</button>
                <span aria-live="polite">{page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Келесі</button>
              </div>
            </nav>
          ) : null}
        </Tabs.Content>

        <Tabs.Content value="buyers" className="admin-panel">
          <BuyersPanel provinces={purchaseProvinces} districts={purchaseDistricts} />
        </Tabs.Content>

        <Tabs.Content value="settings" className="admin-panel">
          <div className="admin-title-row"><div><h1>Баптаулар</h1><p>Тіркелудің қолжетімділігін басқарыңыз</p></div></div>
          <div className="settings-layout">
            <section className="settings-card">
              {settingsLoading ? <p className="admin-loading compact" role="status"><LoaderCircle className="spin" aria-hidden="true" /> Баптаулар жүктеліп жатыр...</p> : null}
              {settingsLoadError ? <div className="admin-settings-error"><p className="admin-notice error" role="alert">{settingsLoadError}</p><button className="clear-button" type="button" onClick={() => void loadSettings()}>Қайта жүктеу</button></div> : null}
              <fieldset className="settings-fieldset" disabled={settingsLoading || Boolean(settingsLoadError)}>
                <legend className="sr-only">Тіркелу баптаулары</legend>
                <div className="switch-row"><span id="registration-open-label"><strong>Тіркеу ашық</strong><small>Қоғамдық форма арқылы жаңа өтінім қабылдау</small></span><Switch.Root aria-labelledby="registration-open-label" checked={settings.registrationOpen} onCheckedChange={(checked) => setSettings((value) => ({ ...value, registrationOpen: checked }))}><Switch.Thumb className="switch-thumb" /></Switch.Root></div>
                <div className="field"><label htmlFor="deadline">Тіркеудің аяқталу уақыты</label><input id="deadline" type="datetime-local" value={toAlmatyInput(settings.registrationDeadline)} onChange={(event) => setSettings((value) => ({ ...value, registrationDeadline: fromAlmatyInput(event.target.value) }))} /><p className="field-helper">Алматы уақыты (UTC+5)</p></div>
                <div className="field"><label htmlFor="announcement">Хабарландыру мәтіні</label><textarea id="announcement" rows={3} value={settings.announcement} onChange={(event) => setSettings((value) => ({ ...value, announcement: event.target.value }))} /></div>
                <div className="field"><label htmlFor="closed-message">Тіркеу жабық кездегі мәтін <span aria-hidden="true">*</span></label><textarea id="closed-message" rows={3} required aria-required="true" value={settings.closedMessage} onChange={(event) => setSettings((value) => ({ ...value, closedMessage: event.target.value }))} /></div>
              </fieldset>
              {settingsMessage ? <p className={`admin-notice${settingsMessageError ? " error" : ""}`} role={settingsMessageError ? "alert" : "status"}>{settingsMessage}</p> : null}
              <button className="admin-primary-button" type="button" onClick={() => void saveSettings()} disabled={settingsLoading || Boolean(settingsLoadError) || settingsPending} aria-busy={settingsPending}>{settingsPending ? <><LoaderCircle className="spin" aria-hidden="true" /> Сақталып жатыр...</> : <><Save aria-hidden="true" /> Өзгерістерді сақтау</>}</button>
            </section>
            <aside className="connection-card"><Settings2 /><h2>Google Sheets байланысы</h2><p className={!connection ? "checking" : connection.status === "connected" ? "connected" : "error"}>{!connection ? "Тексерілуде…" : connection.status === "connected" ? "Қосылған" : "Қате"}</p><small>Соңғы тексерілген уақыт</small><time>{connection?.checkedAt ? formatDate(connection.checkedAt) : "—"}</time></aside>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <Dialog.Root open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { detailRequestRef.current?.abort(); setDetailLoading(false); setDetail(null); setDetailError(""); } }}>
        <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="details-drawer" aria-busy={detailLoading}><Dialog.Close className="dialog-close" aria-label="Жабу"><X aria-hidden="true" /></Dialog.Close>{detailLoading ? <><Dialog.Title>Өтінім жүктелуде</Dialog.Title><Dialog.Description>Толық ақпарат дайындалып жатыр.</Dialog.Description><div className="admin-loading" role="status"><LoaderCircle className="spin" aria-hidden="true" /> Жүктеліп жатыр...</div></> : detailError ? <><Dialog.Title>Өтінімді ашу мүмкін болмады</Dialog.Title><Dialog.Description className="admin-notice error" role="alert">{detailError}</Dialog.Description><button className="admin-primary-button detail-retry" type="button" onClick={() => void openDetail(detailSubmissionId)}>Қайта жүктеу</button></> : detail ? <><Dialog.Title>{detail.submissionId}</Dialog.Title><Dialog.Description>{formatDate(detail.createdAt)}</Dialog.Description><dl className="details-meta"><div><dt>Облыс/қала</dt><dd>{detail.provinceName}</dd></div><div><dt>Аудан</dt><dd>{detail.districtName}</dd></div><div><dt>Мектеп</dt><dd>{detail.schoolName}</dd></div><div><dt>Сынып жетекшісі</dt><dd>{detail.classTeacherFullName}<br />{detail.classTeacherPhone}</dd></div></dl><h3>Оқушылар тізімі</h3><ol className="details-students">{detail.students.map((student, index) => <li key={`${student.fullName}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{student.fullName}</strong><small>{student.phone}</small></div></li>)}</ol></> : null}</Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("kk-KZ", { timeZone: "Asia/Almaty", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function toAlmatyInput(value: string) {
  if (!value) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(value)).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function fromAlmatyInput(value: string) {
  return value ? new Date(`${value}:00+05:00`).toISOString() : "";
}
