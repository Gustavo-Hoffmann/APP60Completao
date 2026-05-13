import { CalendarDays, Loader2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import "react-datepicker/dist/react-datepicker.css";

import { AppHeader } from "../../../components/layout/AppHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { apiJson } from "../../../lib/api/client";
import {
  creatableRolesForAdmin,
  creatableRolesForGestor,
  creatableRolesForSuperAdmin,
  creatableRolesForSupervisor,
  roleRequiresInstitution,
} from "../../../lib/auth/permissions";
import { routes } from "../../../navigation/routes";
import type { Role } from "../../../types/auth";

type RoleOption = Role;

type FormState = {
  role: RoleOption;
  name: string;
  email: string;
  cpf: string;
  birthDate: string;
  institutionId: string;
  phone: string;
  country: string;
  city: string;
  state: string;
  supervisorId: string;
};

type UserOption = {
  id: string;
  name: string;
  email: string | null;
};

type InstitutionOption = {
  id: string;
  name: string;
};

type CountryOption = {
  code: string;
  name: string;
};

type BrazilStateOption = {
  sigla: string;
  nome: string;
};

type BrazilCityOption = {
  id: number;
  nome: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function birthDateToInitialPassword(fullName: string, date: string) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const normalizedFirstName = firstName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "");

  if (normalizedFirstName.length < 2 || !date) return "";
  const [yyyy, mm, dd] = date.split("-");
  const prefix =
    normalizedFirstName.charAt(0).toUpperCase() +
    normalizedFirstName.charAt(1).toLowerCase();
  return `${prefix}${dd}${mm}${yyyy.slice(-2)}#`;
}

function isoToDate(value: string) {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

  return d;
}

function dateToIso(value: Date | null) {
  if (!value) return "";
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchCountries(): Promise<CountryOption[]> {
  const response = await fetch(
    "https://restcountries.com/v3.1/all?fields=name,cca2"
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os países.");
  }

  const data = (await response.json()) as Array<{
    cca2: string;
    name?: { common?: string };
  }>;

  return data
    .map((country) => ({
      code: country.cca2,
      name: country.name?.common ?? country.cca2,
    }))
    .filter((country) => country.name)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function fetchBrazilStates(): Promise<BrazilStateOption[]> {
  const response = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome"
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os estados.");
  }

  return (await response.json()) as BrazilStateOption[];
}

async function fetchBrazilCities(uf: string): Promise<BrazilCityOption[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar as cidades.");
  }

  return (await response.json()) as BrazilCityOption[];
}

function FieldLabel({
  children,
  required = false,
}: {
  children: string;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {children}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </label>
  );
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${props.className ?? ""}`}
    />
  );
}

function SelectField(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${props.className ?? ""}`}
    />
  );
}

export function UserCreatePage() {
  const { t, i18n } = useTranslation(["modules", "navigation"]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>({
    role: "AVALIADOR",
    name: "",
    email: "",
    cpf: "",
    birthDate: "",
    institutionId: "",
    phone: "",
    country: "BR",
    city: "",
    state: "",
    supervisorId: "",
  });

  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [supervisors, setSupervisors] = useState<UserOption[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [brazilStates, setBrazilStates] = useState<BrazilStateOption[]>([]);
  const [brazilCities, setBrazilCities] = useState<BrazilCityOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const initialPassword = useMemo(
    () => birthDateToInitialPassword(form.name, form.birthDate),
    [form.name, form.birthDate]
  );

  const isSuperAdminUser = user?.role === "SUPER_ADMIN";
  const isAdminUser = user?.role === "ADMIN";
  const isManagerUser = user?.role === "GESTOR";
  const isSupervisorUser = user?.role === "SUPERVISOR";
  const isMyInstitutionFlow = location.pathname.startsWith(routes.myInstitution);
  const needsInstitutionSelection =
    (isSuperAdminUser || isAdminUser) && roleRequiresInstitution(form.role);
  const needsSupervisorSelection = form.role === "AVALIADOR" && !isSupervisorUser;
  const isBrazil = form.country === "BR";

  const allowedRoles = useMemo((): Role[] => {
    if (isSuperAdminUser) return creatableRolesForSuperAdmin();
    if (isAdminUser) return creatableRolesForAdmin();
    if (isManagerUser) return creatableRolesForGestor();
    if (isSupervisorUser) return creatableRolesForSupervisor();
    return [];
  }, [isSuperAdminUser, isAdminUser, isManagerUser, isSupervisorUser]);

  const selectedRole = useMemo((): Role | "" => {
    if (!allowedRoles.length) return "";
    return allowedRoles.includes(form.role) ? form.role : allowedRoles[0]!;
  }, [allowedRoles, form.role]);

  useEffect(() => {
    async function loadCountriesAndStates() {
      try {
        setLoadingCountries(true);
        setLoadingStates(true);

        const [countriesData, statesData] = await Promise.all([
          fetchCountries(),
          fetchBrazilStates(),
        ]);

        setCountries(countriesData);
        setBrazilStates(statesData);
      } catch (err) {
        console.error(err);
        setError(t("modules:userCreate.errors.loadCountryState"));
      } finally {
        setLoadingCountries(false);
        setLoadingStates(false);
      }
    }

    void loadCountriesAndStates();
  }, [t]);

  useEffect(() => {
    async function loadInstitutions() {
      if (!needsInstitutionSelection) {
        setInstitutions([]);
        return;
      }
      try {
        setLoadingInstitutions(true);
        const data = await apiJson<InstitutionOption[]>("/api/institutions");
        setInstitutions(data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInstitutions(false);
      }
    }
    void loadInstitutions();
  }, [needsInstitutionSelection]);

  useEffect(() => {
    async function loadSupervisors() {
      if (!needsSupervisorSelection) {
        setSupervisors([]);
        return;
      }
      try {
        setLoadingSupervisors(true);
        const data = await apiJson<
          Array<{ id: string; full_name: string; email: string | null; role: string }>
        >("/api/users");
        const sups = (data ?? [])
          .filter((r) => r.role === "SUPERVISOR")
          .map((r) => ({ id: r.id, name: r.full_name, email: r.email }));
        setSupervisors(sups);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSupervisors(false);
      }
    }
    void loadSupervisors();
  }, [needsSupervisorSelection]);

  useEffect(() => {
    if (!allowedRoles.length) return;
    setForm((prev) => {
      if (allowedRoles.includes(prev.role)) return prev;
      return { ...prev, role: allowedRoles[0]! };
    });
  }, [allowedRoles]);

  useEffect(() => {
    if (user?.role === "GESTOR" && user.institution_id) {
      setForm((p) => ({ ...p, institutionId: user.institution_id! }));
    }
  }, [user?.role, user?.institution_id]);

  useEffect(() => {
    if (form.role !== "AVALIADOR" && form.supervisorId) {
      setForm((prev) => ({ ...prev, supervisorId: "" }));
    }
  }, [form.role, form.supervisorId]);


  useEffect(() => {
    async function loadCities() {
      if (!isBrazil || !form.state) {
        setBrazilCities([]);
        return;
      }

      try {
        setLoadingCities(true);
        const cities = await fetchBrazilCities(form.state);
        setBrazilCities(cities);
      } catch (err) {
        console.error(err);
        setError(t("modules:userCreate.errors.loadCities"));
      } finally {
        setLoadingCities(false);
      }
    }

    void loadCities();
  }, [form.state, isBrazil, t]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  }

  function handleCountryChange(value: string) {
    setForm((prev) => ({
      ...prev,
      country: value,
      state: value === "BR" ? prev.state : "",
      city: "",
    }));
    setBrazilCities([]);
    setError(null);
    setSuccess(null);
  }

  function handleStateChange(value: string) {
    setForm((prev) => ({
      ...prev,
      state: value,
      city: "",
    }));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const roleToCreate = selectedRole;
    if (!roleToCreate || !allowedRoles.includes(roleToCreate)) {
      setError(t("modules:userCreate.errors.invalidRole"));
      return;
    }

    if (
      !roleToCreate ||
      !form.name.trim() ||
      !form.email.trim() ||
      !form.cpf.trim() ||
      !form.birthDate ||
      !form.phone.trim() ||
      !form.country.trim() ||
      !form.city.trim()
    ) {
      setError(t("modules:userCreate.errors.requiredFields"));
      return;
    }

    if (needsInstitutionSelection && !form.institutionId) {
      setError(t("modules:userCreate.errors.selectInstitution"));
      return;
    }

    if (isBrazil && !form.state.trim()) {
      setError(t("modules:userCreate.errors.selectState"));
      return;
    }

    if (!initialPassword) {
      setError(t("modules:userCreate.errors.initialPassword"));
      return;
    }

    if (roleToCreate === "AVALIADOR" && needsSupervisorSelection && !form.supervisorId) {
      setError(t("modules:userCreate.errors.selectSupervisor"));
      return;
    }

    const institutionId = roleRequiresInstitution(roleToCreate)
      ? isSuperAdminUser || isAdminUser
        ? form.institutionId
        : user?.institution_id ?? ""
      : undefined;
    if (roleRequiresInstitution(roleToCreate) && !institutionId) {
      setError(t("modules:userCreate.errors.invalidInstitution"));
      return;
    }

    try {
      setSubmitting(true);

      await apiJson("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: initialPassword,
          fullName: form.name.trim(),
          role: roleToCreate,
          ...(institutionId ? { institutionId } : {}),
          supervisorId:
            roleToCreate === "AVALIADOR" && form.supervisorId ? form.supervisorId : undefined,
          cpf: onlyDigits(form.cpf),
          phone: form.phone.trim(),
          country: form.country,
          city: form.city.trim(),
          state: isBrazil ? form.state.trim().toUpperCase() : null,
          birth_date: form.birthDate,
        }),
      });

      setSuccess(t("modules:userCreate.success"));

      setForm({
        role: isSuperAdminUser ? "ADMIN" : isAdminUser ? "GESTOR" : isSupervisorUser ? "AVALIADOR" : "SUPERVISOR",
        name: "",
        email: "",
        cpf: "",
        birthDate: "",
        institutionId: "",
        phone: "",
        country: "BR",
        city: "",
        state: "",
        supervisorId: "",
      });

      setBrazilCities([]);
    } catch (err) {
      console.error("Erro ao cadastrar usuário:", err);
      setError(err instanceof Error ? err.message : t("modules:userCreate.errors.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const cancelRoute =
    isMyInstitutionFlow && (isManagerUser || isSupervisorUser) ? routes.myInstitution : routes.users;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title={t("modules:userCreate.title")} subtitle={t("modules:userCreate.subtitle")} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <FieldLabel required>{t("modules:userForm.name")}</FieldLabel>
                <TextField
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder={t("modules:userForm.placeholder.fullName")}
                />
              </div>

              <div>
                <FieldLabel required>{t("modules:userForm.email")}</FieldLabel>
                <TextField
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder={t("modules:userForm.placeholder.email")}
                />
              </div>

              <div>
                <FieldLabel required>{t("modules:userForm.cpf")}</FieldLabel>
                <TextField
                  value={form.cpf}
                  onChange={(e) => updateField("cpf", formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </div>

              <div>
                <FieldLabel required>{t("modules:userForm.phone")}</FieldLabel>
                <TextField
                  value={form.phone}
                  onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                  placeholder={t("modules:userForm.placeholder.phone")}
                  inputMode="tel"
                />
              </div>

              {needsInstitutionSelection ? (
                <div className="md:col-span-2">
                  <FieldLabel required>{t("modules:userForm.institution")}</FieldLabel>
                  <SelectField
                    value={form.institutionId}
                    onChange={(e) => updateField("institutionId", e.target.value)}
                    disabled={loadingInstitutions}
                  >
                    <option value="">
                      {loadingInstitutions
                        ? t("modules:userForm.loading.default")
                        : t("modules:userForm.select.institution")}
                    </option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : null}

              <div>
                <FieldLabel required>{t("modules:userForm.country")}</FieldLabel>
                <SelectField
                  value={form.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  disabled={loadingCountries}
                >
                  <option value="">
                    {loadingCountries ? t("modules:userForm.loading.countries") : t("modules:userForm.select.default")}
                  </option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </SelectField>
              </div>

              {isBrazil ? (
                <div>
                  <FieldLabel required>{t("modules:userForm.state")}</FieldLabel>
                  <SelectField
                    value={form.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={loadingStates}
                  >
                    <option value="">
                      {loadingStates ? t("modules:userForm.loading.states") : t("modules:userForm.select.default")}
                    </option>
                    {brazilStates.map((state) => (
                      <option key={state.sigla} value={state.sigla}>
                        {state.nome} ({state.sigla})
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : null}

              <div className={isBrazil ? "" : "md:col-span-2"}>
                <FieldLabel required>{t("modules:userForm.city")}</FieldLabel>
                {isBrazil ? (
                  <SelectField
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    disabled={!form.state || loadingCities}
                  >
                    <option value="">
                      {!form.state
                        ? t("modules:userForm.select.stateFirst")
                        : loadingCities
                        ? t("modules:userForm.loading.cities")
                        : t("modules:userForm.select.default")}
                    </option>
                    {brazilCities.map((city) => (
                      <option key={city.id} value={city.nome}>
                        {city.nome}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <TextField
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder={t("modules:userForm.placeholder.city")}
                  />
                )}
              </div>

              <div>
                <FieldLabel required>{t("modules:userForm.birthDate")}</FieldLabel>
                <div className="relative">
                  <DatePicker
                    selected={isoToDate(form.birthDate)}
                    onChange={(date: Date | null) => updateField("birthDate", dateToIso(date))}
                    dateFormat="dd/MM/yyyy"
                    locale={(i18n.resolvedLanguage ?? "pt-BR").startsWith("pt") ? ptBR : undefined}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    placeholderText={t("modules:userForm.placeholder.date")}
                    maxDate={new Date()}
                    yearDropdownItemNumber={120}
                    scrollableYearDropdown
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-11 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    calendarClassName="!border !border-slate-200 !rounded-2xl !shadow-xl"
                    popperClassName="z-50"
                    wrapperClassName="w-full"
                  />
                  <CalendarDays
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
                <FieldLabel required>{t("modules:userForm.role")}</FieldLabel>
                <SelectField
                  key={allowedRoles.join("-")}
                  value={selectedRole}
                  onChange={(e) => updateField("role", e.target.value as RoleOption)}
                >
                  {allowedRoles.map((role) => (
                    <option key={role} value={role}>
                      {role === "ADMIN"
                        ? t("modules:userForm.roles.admin")
                        : role === "GESTOR"
                          ? t("modules:userForm.roles.manager")
                          : role === "SUPERVISOR"
                            ? t("modules:userForm.roles.supervisor")
                            : t("modules:userForm.roles.evaluator")}
                    </option>
                  ))}
                </SelectField>
              </div>

              {needsSupervisorSelection ? (
                <div className="md:col-span-2">
                  <FieldLabel required>{t("modules:userForm.supervisor")}</FieldLabel>
                  <SelectField
                    value={form.supervisorId}
                    onChange={(e) => updateField("supervisorId", e.target.value)}
                    disabled={loadingSupervisors}
                  >
                    <option value="">
                      {loadingSupervisors
                        ? t("modules:userForm.loading.supervisors")
                        : t("modules:userForm.select.supervisor")}
                    </option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.email ? ` — ${s.email}` : ""}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-700">
                    {t("modules:userForm.passwordHintTitle")}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {t("modules:userForm.passwordHintBody")}
                  </div>
                  <div className="mt-2 font-mono text-lg font-bold text-brand-700">
                    {initialPassword || "An230265#"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => navigate(cancelRoute)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t("modules:userForm.actions.cancel")}
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t("modules:userForm.actions.saving")}
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    {t("modules:userCreate.createButton")}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}