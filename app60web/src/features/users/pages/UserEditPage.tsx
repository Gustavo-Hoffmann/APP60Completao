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

import "react-datepicker/dist/react-datepicker.css";

import { AppHeader } from "../../../components/layout/AppHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase/client";
import { routes } from "../../../navigation/routes";
import type { Role } from "../../../types/auth";

type EditableUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  professor_id: string | null;
  is_active: boolean;
  cpf: string | null;
  phone: string | null;
  institution: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  birth_date: string | null;
};

type ProfessorOption = {
  id: string;
  name: string;
  email: string | null;
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
  professor_id: string;
  is_active: boolean;
  cpf: string;
  phone: string;
  institution: string;
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
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { user: currentUser, refreshProfile } = useAuth();

  const isMyProfileRoute = location.pathname === routes.myProfile;
  const targetUserId = isMyProfileRoute ? currentUser?.id : id;

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    role: "ALUNO",
    professor_id: "",
    is_active: true,
    cpf: "",
    phone: "",
    institution: "",
    country: "BR",
    city: "",
    state: "",
    birth_date: "",
  });

  const [initialData, setInitialData] = useState<EditableUser | null>(null);
  const [professors, setProfessors] = useState<ProfessorOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [brazilStates, setBrazilStates] = useState<BrazilStateOption[]>([]);
  const [brazilCities, setBrazilCities] = useState<BrazilCityOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingProfessors, setLoadingProfessors] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const isBrazil = form.country === "BR";

  const pageTitle = isOwnProfile ? "Meu perfil" : "Editar usuário";
  const pageSubtitle = isOwnProfile
    ? "Atualize seus dados de acesso"
    : "Atualize os dados do usuário selecionado";

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
        setError("Usuário não encontrado.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadingProfessors(true);
        setError(null);

        const [
          { data: profile, error: profileError },
          { data: professorRows, error: professorError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, name, email, role, professor_id, is_active, cpf, phone, institution, country, city, state, birth_date"
            )
            .eq("id", targetUserId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("id, name, email")
            .eq("role", "PROFESSOR")
            .eq("is_active", true)
            .order("name", { ascending: true }),
        ]);

        if (profileError) throw profileError;
        if (professorError) throw professorError;
        if (!profile) throw new Error("Perfil não encontrado.");

        const castedProfile = profile as EditableUser;
        const castedProfessors = (professorRows ?? []) as ProfessorOption[];

        setInitialData(castedProfile);
        setProfessors(castedProfessors);

        setForm({
          name: castedProfile.name ?? "",
          email: castedProfile.email ?? "",
          role: castedProfile.role,
          professor_id: castedProfile.professor_id ?? "",
          is_active: castedProfile.is_active,
          cpf: formatCpf(castedProfile.cpf ?? ""),
          phone: formatPhone(castedProfile.phone ?? ""),
          institution: castedProfile.institution ?? "",
          country: castedProfile.country ?? "BR",
          city: castedProfile.city ?? "",
          state: castedProfile.state ?? "",
          birth_date: castedProfile.birth_date ?? "",
        });
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
        setError(
          err instanceof Error ? err.message : "Erro ao carregar perfil."
        );
      } finally {
        setLoading(false);
        setLoadingProfessors(false);
      }
    }

    void loadPage();
  }, [targetUserId]);

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

  const isLinkedStudentOfProfessor = useMemo(() => {
    if (!currentUser || !initialData) return false;

    return (
      currentUser.role === "PROFESSOR" &&
      initialData.role === "ALUNO" &&
      initialData.professor_id === currentUser.id
    );
  }, [currentUser, initialData]);

  const canChangeRole = useMemo(() => {
    if (!initialData || !currentUser) return false;
    if (!isAdmin) return false;
    if (isOwnProfile) return false;
    return true;
  }, [initialData, currentUser, isAdmin, isOwnProfile]);

  const canChangeActive = useMemo(() => {
    if (!currentUser || !initialData) return false;
    if (!isAdmin) return false;
    if (isOwnProfile) return false;
    return true;
  }, [currentUser, initialData, isAdmin, isOwnProfile]);

  const canEditThisProfile =
    isAdmin || isOwnProfile || isLinkedStudentOfProfessor;

  const needsProfessorSelection = form.role === "ALUNO";

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
      setError("Usuário inválido.");
      return;
    }

    if (!canEditThisProfile) {
      setError("Você não tem permissão para editar este perfil.");
      return;
    }

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.cpf.trim() ||
      !form.phone.trim() ||
      !form.institution.trim() ||
      !form.country.trim() ||
      !form.city.trim() ||
      !form.birth_date
    ) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (isBrazil && !form.state.trim()) {
      setError("Selecione o estado.");
      return;
    }

    if (needsProfessorSelection && !form.professor_id) {
      setError("Selecione o professor responsável.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        cpf: onlyDigits(form.cpf),
        phone: form.phone.trim(),
        institution: form.institution.trim(),
        country: form.country,
        city: form.city.trim(),
        state: isBrazil ? form.state.trim().toUpperCase() : null,
        birth_date: form.birth_date,
      };

      if (canChangeRole) {
        payload.role = form.role;
        payload.professor_id =
          form.role === "ALUNO" ? form.professor_id || null : null;
      }

      if (canChangeActive) {
        payload.is_active = form.is_active;
      }

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", targetUserId);

      if (error) throw error;

      if (isOwnProfile) {
        await refreshProfile();
      }

      setSuccess("Perfil atualizado com sucesso.");
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      setError(
        err instanceof Error ? err.message : "Erro ao salvar perfil."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isOwnProfile) {
      setPasswordError("Você só pode alterar a senha do seu próprio perfil.");
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError("Preencha a nova senha e a confirmação.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da senha não confere.");
      return;
    }

    try {
      setChangingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccess("Senha alterada com sucesso.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      setPasswordError(
        err instanceof Error ? err.message : "Erro ao alterar senha."
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
              Carregando perfil...
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
              navigate(isOwnProfile ? routes.dashboard : routes.users)
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            {isOwnProfile ? "Voltar ao dashboard" : "Voltar para usuários"}
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
                Você não tem permissão para editar este perfil.
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Nome" required>
                <TextField
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Nome completo"
                  disabled={!canEditThisProfile}
                />
              </Field>

              <Field label="Email" required>
                <TextField
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="email@exemplo.com"
                  disabled={!canEditThisProfile}
                />
              </Field>

              <Field label="CPF" required>
                <TextField
                  value={form.cpf}
                  onChange={(e) => updateField("cpf", formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  disabled={!canEditThisProfile}
                />
              </Field>

              <Field label="Celular" required>
                <TextField
                  value={form.phone}
                  onChange={(e) =>
                    updateField("phone", formatPhone(e.target.value))
                  }
                  placeholder="(41) 99999-9999"
                  inputMode="tel"
                  disabled={!canEditThisProfile}
                />
              </Field>

              <Field label="Instituição" className="md:col-span-2" required>
                <TextField
                  value={form.institution}
                  onChange={(e) => updateField("institution", e.target.value)}
                  placeholder="Ex.: UFPR"
                  disabled={!canEditThisProfile}
                />
              </Field>

              <Field label="País" required>
                <SelectField
                  value={form.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  disabled={!canEditThisProfile || loadingCountries}
                >
                  <option value="">
                    {loadingCountries ? "Carregando países..." : "Selecione"}
                  </option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </SelectField>
              </Field>

              {isBrazil ? (
                <Field label="Estado" required>
                  <SelectField
                    value={form.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={!canEditThisProfile || loadingStates}
                  >
                    <option value="">
                      {loadingStates ? "Carregando estados..." : "Selecione"}
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
                label="Cidade"
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
                        ? "Selecione o estado primeiro"
                        : loadingCities
                        ? "Carregando cidades..."
                        : "Selecione"}
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
                    placeholder="Digite a cidade"
                    disabled={!canEditThisProfile}
                  />
                )}
              </Field>

              <Field label="Data de nascimento" required>
                <div className="relative">
                  <DatePicker
                    selected={isoToDate(form.birth_date)}
                    onChange={(date) =>
                      updateField("birth_date", dateToIso(date))
                    }
                    dateFormat="dd/MM/yyyy"
                    locale={ptBR}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    placeholderText="Selecione a data"
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

              <Field label="Perfil" required>
                <SelectField
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value as Role)}
                  disabled={!canChangeRole}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="PROFESSOR">Professor</option>
                  <option value="ALUNO">Aluno</option>
                </SelectField>
              </Field>

              <Field label="Status" required>
                <SelectField
                  value={form.is_active ? "ATIVO" : "INATIVO"}
                  onChange={(e) =>
                    updateField("is_active", e.target.value === "ATIVO")
                  }
                  disabled={!canChangeActive}
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </SelectField>
              </Field>

              {needsProfessorSelection ? (
                <Field
                  label="Professor responsável"
                  className="md:col-span-2"
                  required
                >
                  <SelectField
                    value={form.professor_id}
                    onChange={(e) =>
                      updateField("professor_id", e.target.value)
                    }
                    disabled={!canChangeRole || loadingProfessors}
                  >
                    <option value="">
                      {loadingProfessors
                        ? "Carregando professores..."
                        : "Selecione um professor"}
                    </option>
                    {professors.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {professor.name}
                        {professor.email ? ` — ${professor.email}` : ""}
                      </option>
                    ))}
                  </SelectField>
                </Field>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  navigate(isOwnProfile ? routes.dashboard : routes.users)
                }
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || !canEditThisProfile}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Salvar alterações
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
                  Alterar senha
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Esta opção aparece só no seu próprio perfil.
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
                <Field label="Nova senha" required>
                  <TextField
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    placeholder="Digite a nova senha"
                  />
                </Field>

                <Field label="Confirmar nova senha" required>
                  <TextField
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    placeholder="Repita a nova senha"
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
                      Alterando...
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={18} />
                      Alterar senha
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