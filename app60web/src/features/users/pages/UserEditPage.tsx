import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  LockKeyhole,
  Save,
  ShieldAlert,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";

import "react-datepicker/dist/react-datepicker.css";

import { AppHeader } from "../../../components/layout/AppHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { apiFetch, apiJson } from "../../../lib/api/client";
import { changeOwnPassword } from "../../../lib/cognito/session";
import { routes } from "../../../navigation/routes";
import type { Role } from "../../../types/auth";

type EditableUser = {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
  primary_institution_id: string | null;
  is_active: boolean;
  cpf: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  birth_date: string | null;
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

type FormState = {
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  cpf: string;
  phone: string;
  country: string;
  city: string;
  state: string;
  birth_date: string;
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

function isoToDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
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
    .filter((country) => !!country.name)
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

function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
        props.className ?? ""
      }`}
    />
  );
}

function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
        props.className ?? ""
      }`}
    />
  );
}

function Field({
  label,
  className = "",
  required = false,
  children,
}: {
  label: string;
  className?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

export function UserEditPage() {
  const { t, i18n } = useTranslation(["modules", "navigation"]);
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { user: currentUser, refreshProfile } = useAuth();

  const isMyProfileRoute = location.pathname === routes.myProfile;
  const targetUserId = isMyProfileRoute ? currentUser?.id : id;

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    role: "AVALIADOR",
    is_active: true,
    cpf: "",
    phone: "",
    country: "BR",
    city: "",
    state: "",
    birth_date: "",
  });

  const [initialData, setInitialData] = useState<EditableUser | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [brazilStates, setBrazilStates] = useState<BrazilStateOption[]>([]);
  const [brazilCities, setBrazilCities] = useState<BrazilCityOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isOwnProfile =
    !!currentUser && !!targetUserId && currentUser.id === targetUserId;
  const isAdmin = currentUser?.role === "ADMIN";
  const isSuperAdminUser = currentUser?.role === "SUPER_ADMIN";
  const isManagerUser = currentUser?.role === "GESTOR";
  const isBrazil = form.country === "BR";

  const pageTitle = isOwnProfile ? t("modules:userEdit.myProfileTitle") : t("modules:userEdit.editTitle");
  const pageSubtitle = isOwnProfile
    ? t("modules:userEdit.myProfileSubtitle")
    : t("modules:userEdit.editSubtitle");

  useEffect(() => {
    async function loadBaseOptions() {
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
      } finally {
        setLoadingCountries(false);
        setLoadingStates(false);
      }
    }

    void loadBaseOptions();
  }, []);

  useEffect(() => {
    async function loadPage() {
      if (!targetUserId) {
        setError(t("modules:userEdit.errors.userNotFound"));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const profile = await apiJson<EditableUser>(`/api/users/${targetUserId}`);
        setInitialData(profile);

        setForm({
          name: profile.full_name ?? "",
          email: profile.email ?? "",
          role: profile.role,
          is_active: profile.is_active,
          cpf: formatCpf(profile.cpf ?? ""),
          phone: formatPhone(profile.phone ?? ""),
          country: profile.country ?? "BR",
          city: profile.city ?? "",
          state: profile.state ?? "",
          birth_date: profile.birth_date ?? "",
        });
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
        setError(
          err instanceof Error ? err.message : t("modules:userEdit.errors.loadProfileFailed")
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPage();
  }, [targetUserId, t]);

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
      } finally {
        setLoadingCities(false);
      }
    }

    void loadCities();
  }, [form.state, isBrazil]);

  const sameInstitution = useMemo(() => {
    if (!initialData?.primary_institution_id || !currentUser?.institution_id) {
      return false;
    }
    return initialData.primary_institution_id === currentUser.institution_id;
  }, [initialData, currentUser]);

  const canChangeRole = useMemo(() => {
    if (!initialData || !currentUser) return false;
    if (isOwnProfile) return false;
    if (isSuperAdminUser) return initialData.role !== "SUPER_ADMIN";
    if (isAdmin && sameInstitution) {
      return initialData.role !== "SUPER_ADMIN" && initialData.role !== "ADMIN";
    }
    if (isManagerUser && sameInstitution) {
      return initialData.role === "SUPERVISOR" || initialData.role === "AVALIADOR";
    }
    return false;
  }, [
    initialData,
    currentUser,
    isOwnProfile,
    isSuperAdminUser,
    isAdmin,
    isManagerUser,
    sameInstitution,
  ]);

  const canChangeActive = useMemo(() => {
    if (!currentUser || !initialData) return false;
    if (isOwnProfile) return false;
    if (isSuperAdminUser) return true;
    if (isAdmin && sameInstitution) {
      return initialData.role !== "SUPER_ADMIN";
    }
    if (isManagerUser && sameInstitution) {
      return initialData.role === "SUPERVISOR" || initialData.role === "AVALIADOR";
    }
    return false;
  }, [
    currentUser,
    initialData,
    isOwnProfile,
    isSuperAdminUser,
    isAdmin,
    isManagerUser,
    sameInstitution,
  ]);

  const canEditThisProfile =
    isOwnProfile || isSuperAdminUser || (isAdmin && sameInstitution) || (isManagerUser && sameInstitution);

  const backRoute =
    !isOwnProfile && isManagerUser ? routes.myInstitution : isOwnProfile ? routes.dashboard : routes.users;

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
    setBrazilCities([]);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!targetUserId) {
      setError(t("modules:userEdit.errors.invalidUser"));
      return;
    }

    if (!canEditThisProfile) {
      setError(t("modules:userEdit.errors.noPermission"));
      return;
    }

    if (
      !form.name.trim() ||
      !form.cpf.trim() ||
      !form.phone.trim() ||
      !form.country.trim() ||
      !form.city.trim() ||
      !form.birth_date
    ) {
      setError(t("modules:userEdit.errors.requiredFields"));
      return;
    }

    if (isBrazil && !form.state.trim()) {
      setError(t("modules:userEdit.errors.selectState"));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload: Record<string, unknown> = {
        fullName: form.name.trim(),
        cpf: onlyDigits(form.cpf),
        phone: form.phone.trim(),
        country: form.country,
        city: form.city.trim(),
        state: isBrazil ? form.state.trim().toUpperCase() : null,
        birth_date: form.birth_date,
      };

      if (canChangeRole) {
        payload.role = form.role;
      }

      if (canChangeActive) {
        payload.is_active = form.is_active;
      }

      const res = await apiFetch(`/api/users/${targetUserId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const responseText = await res.text();
        throw new Error(responseText || t("modules:userEdit.errors.saveFailed"));
      }

      if (isOwnProfile) {
        await refreshProfile();
      }

      setSuccess(t("modules:userEdit.success.profileUpdated"));
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      setError(
        err instanceof Error ? err.message : t("modules:userEdit.errors.saveProfileFailed")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isOwnProfile) {
      setPasswordError(t("modules:userEdit.errors.onlyOwnPassword"));
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword.trim()) {
      setPasswordError(t("modules:userEdit.errors.currentPasswordRequired"));
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError(t("modules:userEdit.errors.newPasswordRequired"));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t("modules:userEdit.errors.newPasswordMin"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("modules:userEdit.errors.passwordMismatch"));
      return;
    }

    const email = currentUser?.email?.trim();
    if (!email) {
      setPasswordError(t("modules:userEdit.errors.sessionEmailMissing"));
      return;
    }

    try {
      setChangingPassword(true);

      await changeOwnPassword(email, currentPassword, newPassword);

      setPasswordSuccess(t("modules:userEdit.success.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      setPasswordError(
        err instanceof Error ? err.message : t("modules:userEdit.errors.changePasswordFailed")
      );
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title={pageTitle} subtitle={pageSubtitle} />
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              {t("modules:userEdit.loadingProfile")}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title={pageTitle} subtitle={pageSubtitle} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-4">
          <button
            type="button"
            onClick={() =>
              navigate(backRoute)
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            {isOwnProfile ? t("modules:userEdit.backDashboard") : t("modules:userEdit.backUsers")}
          </button>
        </div>

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

            {!canEditThisProfile ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                {t("modules:userEdit.permissionsWarning")}
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              <Field label={t("modules:userForm.name")} required>
                <TextField
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder={t("modules:userForm.placeholder.fullName")}
                  disabled={!canEditThisProfile}
                />
              </Field>

              <Field label={t("modules:userForm.email")} required>
                <TextField
                  type="email"
                  value={form.email}
                  onChange={() => {}}
                  placeholder={t("modules:userForm.placeholder.email")}
                  disabled
                  title={t("modules:userEdit.emailManaged")}
                />
              </Field>

              <Field label={t("modules:userForm.cpf")} required>
                <TextField
                  value={form.cpf}
                  onChange={(e) => updateField("cpf", formatCpf(e.target.value))}
                  placeholder={t("modules:userForm.placeholder.cpf")}
                  inputMode="numeric"
                  disabled={!canEditThisProfile}
                />
              </Field>

              <Field label={t("modules:userForm.phone")} required>
                <TextField
                  value={form.phone}
                  onChange={(e) =>
                    updateField("phone", formatPhone(e.target.value))
                  }
                  placeholder={t("modules:userForm.placeholder.phone")}
                  inputMode="tel"
                  disabled={!canEditThisProfile}
                />
              </Field>

              {initialData?.primary_institution_id ? (
                <Field label={t("modules:userEdit.institutionId")} className="md:col-span-2">
                  <TextField
                    value={initialData.primary_institution_id}
                    onChange={() => {}}
                    disabled
                  />
                </Field>
              ) : null}

              <Field label={t("modules:userForm.country")} required>
                <SelectField
                  value={form.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  disabled={!canEditThisProfile || loadingCountries}
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
              </Field>

              {isBrazil ? (
                <Field label={t("modules:userForm.state")} required>
                  <SelectField
                    value={form.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={!canEditThisProfile || loadingStates}
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
                </Field>
              ) : null}

              <Field
                label={t("modules:userForm.city")}
                required
                className={isBrazil ? "" : "md:col-span-2"}
              >
                {isBrazil ? (
                  <SelectField
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    disabled={
                      !canEditThisProfile || !form.state || loadingCities
                    }
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
                    disabled={!canEditThisProfile}
                  />
                )}
              </Field>

              <Field label={t("modules:userForm.birthDate")} required>
                <div className="relative">
                  <DatePicker
                    selected={isoToDate(form.birth_date)}
                    onChange={(date: Date | null) =>
                      updateField("birth_date", dateToIso(date))
                    }
                    dateFormat="dd/MM/yyyy"
                    locale={(i18n.resolvedLanguage ?? "pt-BR").startsWith("pt") ? ptBR : undefined}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    placeholderText={t("modules:userForm.placeholder.date")}
                    maxDate={new Date()}
                    yearDropdownItemNumber={120}
                    scrollableYearDropdown
                    disabled={!canEditThisProfile}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-11 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    calendarClassName="!rounded-2xl !border !border-slate-200 !shadow-xl"
                    popperClassName="z-50"
                    wrapperClassName="w-full"
                  />
                  <CalendarDays
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </Field>

              <Field label={t("modules:userForm.role")} required>
                <SelectField
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value as Role)}
                  disabled={!canChangeRole}
                >
                  {isSuperAdminUser ? <option value="ADMIN">{t("modules:userForm.roles.admin")}</option> : null}
                  {isSuperAdminUser || isAdmin ? <option value="GESTOR">{t("modules:userForm.roles.manager")}</option> : null}
                  <option value="SUPERVISOR">{t("modules:userForm.roles.supervisor")}</option>
                  <option value="AVALIADOR">{t("modules:userForm.roles.evaluator")}</option>
                </SelectField>
              </Field>

              <Field label={t("modules:userEdit.status")} required>
                <SelectField
                  value={form.is_active ? "ATIVO" : "INATIVO"}
                  onChange={(e) =>
                    updateField("is_active", e.target.value === "ATIVO")
                  }
                  disabled={!canChangeActive}
                >
                  <option value="ATIVO">{t("modules:userEdit.statusActive")}</option>
                  <option value="INATIVO">{t("modules:userEdit.statusInactive")}</option>
                </SelectField>
              </Field>

            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  navigate(backRoute)
                }
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t("modules:userForm.actions.cancel")}
              </button>

              <button
                type="submit"
                disabled={saving || !canEditThisProfile}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t("modules:userForm.actions.saving")}
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {t("modules:userEdit.saveChanges")}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {isOwnProfile ? (
          <div className="mt-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <LockKeyhole size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {t("modules:userEdit.changePasswordTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("modules:userEdit.changePasswordSubtitle")}
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-6">
              {passwordError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {passwordError}
                </div>
              ) : null}

              {passwordSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {passwordSuccess}
                </div>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                <Field label={t("modules:userEdit.currentPassword")} required className="md:col-span-2">
                  <TextField
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    placeholder={t("modules:userEdit.currentPasswordPlaceholder")}
                    autoComplete="current-password"
                  />
                </Field>
                <Field label={t("modules:userEdit.newPassword")} required>
                  <TextField
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    placeholder={t("modules:userEdit.newPasswordPlaceholder")}
                  />
                </Field>

                <Field label={t("modules:userEdit.confirmNewPassword")} required>
                  <TextField
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    placeholder={t("modules:userEdit.confirmNewPasswordPlaceholder")}
                  />
                </Field>
              </div>

              <div className="flex justify-end border-t border-slate-200 pt-6">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {t("modules:userEdit.changingPassword")}
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={18} />
                      {t("modules:userEdit.changePasswordButton")}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}