import { CalendarDays, Loader2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

import "react-datepicker/dist/react-datepicker.css";

import { AppHeader } from "../../../components/layout/AppHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { apiJson } from "../../../lib/api/client";
import { creatableRolesForAdmin, creatableRolesForSuperAdmin } from "../../../lib/auth/permissions";
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
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>({
    role: "GESTOR",
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
  const needsInstitutionSelection = isSuperAdminUser;
  const needsSupervisorSelection = form.role === "AVALIADOR";
  const isBrazil = form.country === "BR";

  const allowedRoles = useMemo((): Role[] => {
    if (isSuperAdminUser) return creatableRolesForSuperAdmin();
    if (isAdminUser) return creatableRolesForAdmin();
    if (isManagerUser) return ["SUPERVISOR", "AVALIADOR"];
    return [];
  }, [isSuperAdminUser, isAdminUser, isManagerUser]);

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
        setError("Não foi possível carregar países/estados.");
      } finally {
        setLoadingCountries(false);
        setLoadingStates(false);
      }
    }

    void loadCountriesAndStates();
  }, []);

  useEffect(() => {
    async function loadInstitutions() {
      if (!isSuperAdminUser) {
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
  }, [isSuperAdminUser]);

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
    if ((user?.role === "ADMIN" || user?.role === "GESTOR") && user.institution_id) {
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
        setError("Não foi possível carregar as cidades.");
      } finally {
        setLoadingCities(false);
      }
    }

    void loadCities();
  }, [form.state, isBrazil]);

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

    if (
      !form.role ||
      !form.name.trim() ||
      !form.email.trim() ||
      !form.cpf.trim() ||
      !form.birthDate ||
      !form.phone.trim() ||
      !form.country.trim() ||
      !form.city.trim()
    ) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (needsInstitutionSelection && !form.institutionId) {
      setError("Selecione a instituição.");
      return;
    }

    if (isBrazil && !form.state.trim()) {
      setError("Selecione o estado.");
      return;
    }

    if (!initialPassword) {
      setError("Não foi possível gerar a senha inicial.");
      return;
    }

    if (needsSupervisorSelection && !form.supervisorId) {
      setError("Selecione o supervisor do avaliador.");
      return;
    }

    const institutionId =
      isSuperAdminUser ? form.institutionId : user?.institution_id ?? "";
    if (!institutionId) {
      setError("Instituição inválida para o cadastro.");
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
          role: form.role,
          institutionId,
          supervisorId:
            form.role === "AVALIADOR" && form.supervisorId ? form.supervisorId : undefined,
          cpf: onlyDigits(form.cpf),
          phone: form.phone.trim(),
          country: form.country,
          city: form.city.trim(),
          state: isBrazil ? form.state.trim().toUpperCase() : null,
          birth_date: form.birthDate,
        }),
      });

      setSuccess("Usuário criado com sucesso.");

      setForm({
        role: isSuperAdminUser ? "ADMIN" : isAdminUser ? "GESTOR" : "SUPERVISOR",
        name: "",
        email: "",
        cpf: "",
        birthDate: "",
        institutionId: isSuperAdminUser ? "" : user?.institution_id ?? "",
        phone: "",
        country: "BR",
        city: "",
        state: "",
        supervisorId: "",
      });

      setBrazilCities([]);
    } catch (err) {
      console.error("Erro ao cadastrar usuário:", err);
      setError(err instanceof Error ? err.message : "Erro ao cadastrar usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title="Criar usuário"
        subtitle="Cadastre perfis vinculados à instituição"
      />

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
                <FieldLabel required>Nome</FieldLabel>
                <TextField
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <FieldLabel required>Email</FieldLabel>
                <TextField
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <FieldLabel required>CPF</FieldLabel>
                <TextField
                  value={form.cpf}
                  onChange={(e) => updateField("cpf", formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </div>

              <div>
                <FieldLabel required>Celular</FieldLabel>
                <TextField
                  value={form.phone}
                  onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                  placeholder="(41) 99999-9999"
                  inputMode="tel"
                />
              </div>

              {needsInstitutionSelection ? (
                <div className="md:col-span-2">
                  <FieldLabel required>Instituição</FieldLabel>
                  <SelectField
                    value={form.institutionId}
                    onChange={(e) => updateField("institutionId", e.target.value)}
                    disabled={loadingInstitutions}
                  >
                    <option value="">
                      {loadingInstitutions ? "Carregando..." : "Selecione a instituição"}
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
                <FieldLabel required>País</FieldLabel>
                <SelectField
                  value={form.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  disabled={loadingCountries}
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
              </div>

              {isBrazil ? (
                <div>
                  <FieldLabel required>Estado</FieldLabel>
                  <SelectField
                    value={form.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={loadingStates}
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
                </div>
              ) : null}

              <div className={isBrazil ? "" : "md:col-span-2"}>
                <FieldLabel required>Cidade</FieldLabel>
                {isBrazil ? (
                  <SelectField
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    disabled={!form.state || loadingCities}
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
                  />
                )}
              </div>

              <div>
                <FieldLabel required>Data de nascimento</FieldLabel>
                <div className="relative">
                  <DatePicker
                    selected={isoToDate(form.birthDate)}
                    onChange={(date: Date | null) => updateField("birthDate", dateToIso(date))}
                    dateFormat="dd/MM/yyyy"
                    locale={ptBR}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    placeholderText="Selecione a data"
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
                <FieldLabel required>Perfil</FieldLabel>
                <SelectField
                  value={form.role}
                  onChange={(e) => updateField("role", e.target.value as RoleOption)}
                >
                  {allowedRoles.map((role) => (
                    <option key={role} value={role}>
                      {role === "ADMIN"
                        ? "Administrador"
                        : role === "GESTOR"
                          ? "Gestor"
                          : role === "SUPERVISOR"
                            ? "Supervisor"
                            : "Avaliador / Pesquisador"}
                    </option>
                  ))}
                </SelectField>
              </div>

              {needsSupervisorSelection ? (
                <div className="md:col-span-2">
                  <FieldLabel required>Supervisor responsável</FieldLabel>
                  <SelectField
                    value={form.supervisorId}
                    onChange={(e) => updateField("supervisorId", e.target.value)}
                    disabled={loadingSupervisors}
                  >
                    <option value="">
                      {loadingSupervisors
                        ? "Carregando supervisores..."
                        : "Selecione um supervisor"}
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
                    Senha inicial automática
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    A senha inicial será gerada com as 2 primeiras letras do primeiro nome + data de nascimento + #:
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
                onClick={() => navigate(routes.users)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Criar usuário
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