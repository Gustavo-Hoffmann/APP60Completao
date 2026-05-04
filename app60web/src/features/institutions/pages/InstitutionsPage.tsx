import {
  AlertTriangle,
  BarChart3,
  Building2,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppHeader } from "../../../components/layout/AppHeader";
import { apiJson } from "../../../lib/api/client";
import { routes } from "../../../navigation/routes";

type InstitutionRow = {
  id: string;
  name: string;
  acronym: string;
  unit: string | null;
  country: string;
  state_or_county: string | null;
  city: string;
  street: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  street_number: string | null;
  complement: string | null;
  is_active: boolean;
  manager_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CollectionsStatRow = {
  id: string;
  acronym: string;
  country: string;
  collections_count: number;
};

type ParticipantsStatRow = {
  id: string;
  acronym: string;
  country: string;
  participants_count: number;
};

function countryLabel(code: string, t: (key: string) => string) {
  const c = (code ?? "").toUpperCase();
  if (c === "BR") return "BR";
  if (c === "US" || c === "USA") return t("institutions.country.usa");
  if (c === "UK" || c === "GB") return t("institutions.country.uk");
  return c || "—";
}

function groupByCountry<T extends { country: string }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const key = (r.country ?? "").toUpperCase();
    m.set(key, [...(m.get(key) ?? []), r]);
  }
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export function InstitutionsPage() {
  const { t } = useTranslation("modules");
  const navigate = useNavigate();

  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [stats, setStats] = useState<CollectionsStatRow[]>([]);
  const [participantsStats, setParticipantsStats] = useState<ParticipantsStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [inst, st, pst] = await Promise.all([
        apiJson<InstitutionRow[]>("/api/institutions"),
        apiJson<CollectionsStatRow[]>("/api/institutions/stats/collections-by-institution"),
        apiJson<ParticipantsStatRow[]>("/api/institutions/stats/participants-by-institution"),
      ]);
      setInstitutions(inst ?? []);
      setStats(st ?? []);
      setParticipantsStats(pst ?? []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("institutions.loadErrorTitle"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [t]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return institutions;
    return institutions.filter((i) => {
      return (
        i.name.toLowerCase().includes(term) ||
        i.acronym.toLowerCase().includes(term) ||
        (i.unit ?? "").toLowerCase().includes(term) ||
        countryLabel(i.country, t).toLowerCase().includes(term) ||
        i.city.toLowerCase().includes(term)
      );
    });
  }, [institutions, search, t]);

  const chartGroups = useMemo(() => groupByCountry(stats), [stats]);
  const participantsChartGroups = useMemo(() => groupByCountry(participantsStats), [participantsStats]);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader title={t("institutions.title")} subtitle={t("institutions.subtitle")} />

      <main className="space-y-6 px-6 py-8">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <button
            type="button"
            onClick={() => navigate(routes.institutionCreate)}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={18} />
            {t("institutions.createButton")}
          </button>

          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder={t("institutions.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <BarChart3 size={16} className="chart-section-icon text-blue-600" />
            {t("institutions.chartTitle")}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              {t("institutions.chartLoading")}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : stats.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {t("institutions.chartEmpty")}
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              {chartGroups.map(([country, rows]) => (
                <div key={country} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {countryLabel(country, t)}
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="acronym" tick={{ fontSize: 12 }} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [`${value}`, t("institutions.collectionsLabel")]}
                          labelFormatter={(label) => t("institutions.institutionLabel", { label })}
                        />
                        <Bar dataKey="collections_count" fill="var(--chart-primary)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <BarChart3 size={16} className="chart-section-icon text-blue-600" />
            {t("institutions.participantsChartTitle", { defaultValue: "Participantes cadastrados por instituição" })}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              {t("institutions.chartLoading")}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : participantsStats.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {t("institutions.participantsChartEmpty", { defaultValue: "Nenhum participante vinculado ainda." })}
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              {participantsChartGroups.map(([country, rows]) => (
                <div key={country} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {countryLabel(country, t)}
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="acronym" tick={{ fontSize: 12 }} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [`${value}`, t("institutions.participantsLabel", { defaultValue: "Participantes" })]}
                          labelFormatter={(label) => t("institutions.institutionLabel", { label })}
                        />
                        <Bar dataKey="participants_count" fill="var(--chart-secondary)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Building2 size={16} />
            {t("institutions.registeredTitle")}
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                {t("institutions.loading")}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 text-red-600" size={18} />
                <div>
                  <p className="font-semibold text-red-700">{t("institutions.loadErrorTitle")}</p>
                  <p className="mt-1 text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-700">{t("institutions.emptyTitle")}</p>
              <p className="mt-1 text-sm text-slate-500">
                {t("institutions.emptySubtitle")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => navigate(routes.institutionEdit(inst.id))}
                  className="group rounded-[28px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {countryLabel(inst.country, t)} {inst.state_or_county ? `• ${inst.state_or_county}` : ""} •{" "}
                        {inst.city}
                      </div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{inst.name}</div>
                      <div className="mt-2 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {inst.acronym}
                        {inst.unit ? ` — ${inst.unit}` : ""}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition group-hover:bg-slate-50">
                      <BarChart3 size={14} />
                      {t("institutions.edit")}
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-600">
                    {inst.street ? `${inst.street}` : t("institutions.addressUnavailable")}
                    {inst.street_number ? `, ${inst.street_number}` : ""}
                    {inst.neighborhood ? ` — ${inst.neighborhood}` : ""}
                    {inst.postal_code ? ` • ${t("institutions.postalCode", { value: inst.postal_code })}` : ""}
                  </div>

                  {inst.manager_name ? (
                    <div className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">
                        {t("institutions.managerResponsible")}
                      </span>{" "}
                      <span className="text-slate-700">{inst.manager_name}</span>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

