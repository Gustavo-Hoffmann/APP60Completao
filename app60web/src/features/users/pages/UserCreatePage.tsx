import { CalendarDays, Loader2, Save, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";

import "react-datepicker/dist/react-datepicker.css";

import { AppHeader } from "../../../components/layout/AppHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase/client";
import { routes } from "../../../navigation/routes";

type RoleOption = "PROFESSOR" | "ALUNO";

type FormState = {
  role: RoleOption;
  name: string;
  email: string;
  cpf: string;
  birthDate: string;
  institution: string;
  phone: string;
  country: string;
  city: string;
  state: string;
  professorId: string;
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

function birthDateToInitialPassword(date: string) {
  if (!date) return "";
  const [yyyy, mm, dd] = date.split("-");
  return `${dd}${mm}${yyyy.slice(-2)}`;
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
    role: "PROFESSOR",
    name: "",
    email: "",
    cpf: "",
    birthDate: "",
    institution: "",
    phone: "",
    country: "BR",
    city: "",
    state: "",
    professorId: "",
  });

  const [professors, setProfessors] = useState<ProfessorOption[]>([]);
  const [loadingProfessors, setLoadingProfessors] = useState(false);
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
    () => birthDateToInitialPassword(form.birthDate),
    [form.birthDate]
  );

  const isAdmin = user?.role === "ADMIN";
  const needsProfessorSelection = isAdmin && form.role === "ALUNO";
  const isBrazil = form.country === "BR";

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
    async function loadProfessors() {
      if (!isAdmin) {
        setProfessors([]);
        return;
      }

      try {
        setLoadingProfessors(true);

        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, email")
          .eq("role", "PROFESSOR")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;

        setProfessors((data ?? []) as ProfessorOption[]);
      } catch (err) {
        console.error("Erro ao carregar professores:", err);
      } finally {
        setLoadingProfessors(false);
      }
    }

    void loadProfessors();
  }, [isAdmin]);

  useEffect(() => {
    if (form.role === "PROFESSOR" && form.professorId) {
      setForm((prev) => ({ ...prev, professorId: "" }));
    }
  }, [form.role, form.professorId]);

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
      !form.institution.trim() ||
      !form.phone.trim() ||
      !form.country.trim() ||
      !form.city.trim()
    ) {
      setError("Preencha todos os campos obrigatórios.");
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

    if (needsProfessorSelection && !form.professorId) {
      setError("Selecione o professor responsável pelo aluno.");
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Erro ao obter sessão: ${sessionError.message}`);
      }

      if (!session?.access_token) {
        throw new Error("Sessão inválida. Faça login novamente.");
      }

      const payload = {
        role: form.role,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: initialPassword,
        professor_id: form.role === "ALUNO" ? form.professorId || null : null,
        cpf: onlyDigits(form.cpf),
        phone: form.phone.trim(),
        institution: form.institution.trim(),
        country: form.country,
        city: form.city.trim(),
        state: isBrazil ? form.state.trim().toUpperCase() : null,
        birth_date: form.birthDate,
      };

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        if (error instanceof FunctionsHttpError) {
          const response = error.context;
          let body: any = null;

          try {
            body = await response.json();
          } catch {
            try {
              body = await response.text();
            } catch {
              body = null;
            }
          }

          const backendMessage =
            typeof body === "string"
              ? body
              : body?.error || body?.message || error.message;

          throw new Error(backendMessage || "Erro ao cadastrar usuário.");
        }

        throw new Error(error.message || "Erro ao cadastrar usuário.");
      }

      const backendError =
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : null;

      if (backendError) {
        throw new Error(backendError);
      }

      setSuccess("Usuário criado com sucesso.");

      setForm({
        role: "PROFESSOR",
        name: "",
        email: "",
        cpf: "",
        birthDate: "",
        institution: "",
        phone: "",
        country: "BR",
        city: "",
        state: "",
        professorId: "",
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
        subtitle="Cadastre professores e alunos com dados completos"
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

              <div className="md:col-span-2">
                <FieldLabel required>Instituição</FieldLabel>
                <TextField
                  value={form.institution}
                  onChange={(e) => updateField("institution", e.target.value)}
                  placeholder="Ex.: UFPR"
                />
              </div>

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
                    onChange={(date) => updateField("birthDate", dateToIso(date))}
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
                  <option value="PROFESSOR">Professor</option>
                  <option value="ALUNO">Aluno</option>
                </SelectField>
              </div>

              {needsProfessorSelection ? (
                <div className="md:col-span-2">
                  <FieldLabel required>Professor responsável</FieldLabel>
                  <SelectField
                    value={form.professorId}
                    onChange={(e) => updateField("professorId", e.target.value)}
                    disabled={loadingProfessors}
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
                </div>
              ) : null}

              <div className="md:col-span-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-700">
                    Senha inicial automática
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    A senha inicial será gerada a partir da data de nascimento:
                  </div>
                  <div className="mt-2 font-mono text-lg font-bold text-brand-700">
                    {initialPassword || "ddmmaa"}
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