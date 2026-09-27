"use client";

import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  Search,
  Trophy,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { District, Province } from "@/lib/location-types";
import {
  PURCHASE_GROUP_SIZE,
  type DistrictPurchaseCount,
  type PurchaseRecord,
  type PurchaseStats
} from "@/lib/purchases";

type BuyersPanelProps = {
  provinces: Province[];
  districts: District[];
};

type PurchasesPayload = {
  items: PurchaseRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: PurchaseStats;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

const EMPTY_STATS: PurchaseStats = {
  total: 0,
  totalAccessUsers: 0,
  topProvince: null,
  topDistrict: null,
  byProvince: [],
  byDistrict: []
};

export function BuyersPanel({ provinces, districts }: BuyersPanelProps) {
  const purchasesRequestRef = useRef<AbortController | null>(null);
  const [items, setItems] = useState<PurchaseRecord[]>([]);
  const [stats, setStats] = useState<PurchaseStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const filterDistricts = useMemo(
    () => districts.filter((district) => !provinceId || district.provinceId === provinceId),
    [districts, provinceId]
  );
  const loadPurchases = useCallback(async () => {
    purchasesRequestRef.current?.abort();
    const request = new AbortController();
    purchasesRequestRef.current = request;
    setLoading(true);
    setLoadError("");

    const params = new URLSearchParams({ page: String(page) });
    if (search.trim()) params.set("search", search.trim());
    if (provinceId) params.set("provinceId", provinceId);
    if (districtId) params.set("districtId", districtId);

    try {
      const response = await fetch(`/api/admin/purchases?${params}`, {
        cache: "no-store",
        signal: request.signal
      });
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<PurchasesPayload> | null;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message || "PURCHASES_LOAD_FAILED");
      }
      setItems(payload.data.items);
      setStats(payload.data.stats);
      setTotal(payload.data.total);
      setTotalPages(payload.data.totalPages);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setItems([]);
      setStats(EMPTY_STATS);
      setTotal(0);
      setTotalPages(1);
      setLoadError("Сатып алушылар тізімін жүктеу мүмкін болмады");
    } finally {
      if (purchasesRequestRef.current === request) setLoading(false);
    }
  }, [districtId, page, provinceId, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPurchases(), 220);
    return () => window.clearTimeout(timer);
  }, [loadPurchases]);

  useEffect(
    () => () => {
      purchasesRequestRef.current?.abort();
    },
    []
  );

  return (
    <>
      <div className="admin-title-row">
        <div>
          <h1>Курс сатып алғандар</h1>
          <p>Тіркелген әр топ курс сатып алған болып есептеледі және бұл тізімге автоматты түрде түседі</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void loadPurchases()}
          aria-label="Сатып алушылар тізімін жаңарту"
          aria-busy={loading}
          disabled={loading}
        >
          <RefreshCw className={loading ? "spin" : undefined} aria-hidden="true" />
        </button>
      </div>

      <section className="buyer-kpis" aria-label="Сатып алу көрсеткіштері">
        <KpiCard
          icon={<BadgeCheck />}
          label="Сатып алған топтар"
          value={String(stats.total)}
          detail="Тізімдегі әр жазба — төленген курс"
        />
        <KpiCard
          icon={<UsersRound />}
          label="Курсқа қолжетімді адам"
          value={String(stats.totalAccessUsers)}
          detail={`${stats.total} топ × ${PURCHASE_GROUP_SIZE} адам`}
        />
        <KpiCard
          icon={<Trophy />}
          label="Үздік облыс/қала"
          value={stats.topProvince?.name ?? "—"}
          detail={stats.topProvince ? `${stats.topProvince.count} топ · ${stats.topProvince.count * PURCHASE_GROUP_SIZE} адам` : "Әзірге дерек жоқ"}
        />
        <KpiCard
          icon={<MapPinned />}
          label="Үздік аудан"
          value={stats.topDistrict?.name ?? "—"}
          detail={stats.topDistrict ? `${stats.topDistrict.provinceName} · ${stats.topDistrict.count} топ · ${stats.topDistrict.count * PURCHASE_GROUP_SIZE} адам` : "Әзірге дерек жоқ"}
        />
      </section>

      <section className="buyer-comparisons" aria-label="Аймақтар бойынша салыстыру">
        <ComparisonCard title="Облыс пен қала бойынша" items={stats.byProvince} />
        <ComparisonCard title="Аудан бойынша" items={stats.byDistrict} showProvince />
      </section>

      <div className="buyer-list-heading">
        <div>
          <h2>Сатып алушылар тізімі</h2>
          <p>Тізімде тұрған әр адам курс сатып алған болып есептеледі</p>
        </div>
      </div>
      <div className="admin-filters buyers-filters">
        <label className="admin-search" htmlFor="buyers-search">
          <span className="sr-only">Сатып алушыларды іздеу</span>
          <Search aria-hidden="true" />
          <input
            id="buyers-search"
            value={search}
            placeholder="Аты-жөні, телефон немесе ескерту"
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
        </label>
        <label className="admin-filter-select" htmlFor="buyers-province-filter">
          <span className="sr-only">Облыс немесе қала бойынша сүзгі</span>
          <select
            id="buyers-province-filter"
            value={provinceId}
            onChange={(event) => {
              setProvinceId(event.target.value);
              setDistrictId("");
              setPage(1);
            }}
          >
            <option value="">Барлық облыс/қала</option>
            {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
        </label>
        <label className="admin-filter-select" htmlFor="buyers-district-filter">
          <span className="sr-only">Аудан бойынша сүзгі</span>
          <select
            id="buyers-district-filter"
            value={districtId}
            disabled={!provinceId}
            onChange={(event) => { setDistrictId(event.target.value); setPage(1); }}
          >
            <option value="">Барлық аудан</option>
            {filterDistricts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
        </label>
        <button
          className="clear-button"
          type="button"
          onClick={() => { setSearch(""); setProvinceId(""); setDistrictId(""); setPage(1); }}
        >
          Тазалау
        </button>
      </div>

      {loadError ? <p className="admin-notice error" role="alert">{loadError}</p> : null}
      <div className="admin-table-wrap" aria-busy={loading}>
        {loading ? (
          <div className="admin-loading" role="status"><LoaderCircle className="spin" aria-hidden="true" /> Жүктеліп жатыр...</div>
        ) : items.length ? (
          <>
            <table className="admin-table buyers-table">
              <caption className="sr-only">Курс сатып алушылар тізімі</caption>
              <thead><tr><th>Сатып алу күні</th><th>Сатып алушы</th><th>Телефон</th><th>Облыс/қала</th><th>Аудан</th><th>Қолжетімділік</th><th>Ескерту</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.purchaseId}>
                    <td><span className="buyer-date"><CalendarDays aria-hidden="true" />{formatPurchaseDate(item.purchasedAt)}</span></td>
                    <td className="buyer-person-cell"><strong>{item.buyerFullName}</strong><small>{item.purchaseId}</small></td>
                    <td>{item.buyerPhone}</td>
                    <td>{item.provinceName}</td>
                    <td>{item.districtName}</td>
                    <td>1 топ · {PURCHASE_GROUP_SIZE} адам</td>
                    <td className="buyer-note-cell">{item.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="admin-cards buyer-cards">
              {items.map((item) => (
                <article key={item.purchaseId}>
                  <div><strong>{formatPurchaseDate(item.purchasedAt)}</strong><span>{item.purchaseId}</span></div>
                  <h3>{item.buyerFullName}</h3>
                  <p>{item.buyerPhone}</p>
                  <p>{item.provinceName}, {item.districtName}</p>
                  <p>Қолжетімділік: 1 топ · {PURCHASE_GROUP_SIZE} адам</p>
                  {item.note ? <p className="buyer-card-note">{item.note}</p> : null}
                </article>
              ))}
            </div>
          </>
        ) : <div className="admin-empty">Сатып алушылар табылмады</div>}
      </div>

      {!loading && !loadError ? (
        <nav className="admin-pagination" aria-label="Сатып алушылар тізімінің беттері">
          <p>Барлығы: <strong>{total}</strong></p>
          <div>
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Алдыңғы</button>
            <span aria-live="polite">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Келесі</button>
          </div>
        </nav>
      ) : null}
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article>
      <span className="buyer-kpi-icon" aria-hidden="true">{icon}</span>
      <div><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>
    </article>
  );
}

function ComparisonCard({
  title,
  items,
  showProvince = false
}: {
  title: string;
  items: PurchaseStats["byProvince"] | PurchaseStats["byDistrict"];
  showProvince?: boolean;
}) {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="buyer-comparison-card">
      <div className="buyer-comparison-heading"><BarChart3 aria-hidden="true" /><h2>{title}</h2></div>
      {items.length ? (
        <ol className="buyer-bars">
          {items.map((item) => {
            const district = item as DistrictPurchaseCount;
            return (
              <li key={`${district.provinceId ?? "province"}-${item.id}`}>
                <div className="buyer-bar-label">
                  <span>{item.name}{showProvince && district.provinceName ? <small>{district.provinceName}</small> : null}</span>
                  <strong>{item.count} топ · {item.count * PURCHASE_GROUP_SIZE} адам</strong>
                </div>
                <div className="buyer-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(4, (item.count / maximum) * 100)}%` }} /></div>
              </li>
            );
          })}
        </ol>
      ) : <p className="buyer-chart-empty">Салыстыру үшін дерек жоқ</p>}
    </article>
  );
}

function formatPurchaseDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00+05:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("kk-KZ", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
