import { CalendarDays, Loader2, MapPin, Save, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

import "react-datepicker/dist/react-datepicker.css";

import { AppHeader } from "../../../components/layout/AppHeader";
import { apiJson } from "../../../lib/api/client";
import { routes } from "../../../navigation/routes";

type InstitutionForm = {
  name: string;
  acronym: string;
  unit: string;
  country: string;
  stateOrCounty: string;
  city: string;
  postalCode: string;
  street: string;
  neighborhood: string;
  streetNumber: string;
  complement: string;
  allowManualAddress: boolean;
};

type ManagerForm = {
  name: string;
  email: string;
  cpf: string;
  birthDate: string;
  phone: string;
  country: string;
  city: string;
  state: string;
};

type CountryOption = { code: string; name: string };
type BrazilStateOption = { sigla: string; nome: string };
type BrazilCityOption = { id: number; nome: string };

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
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
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
  const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
  if (!response.ok) throw new Error("Não foi possível carregar os países.");
  const data = (await response.json()) as Array<{ cca2: string; name?: { common?: string } }>;
  return data
    .map((country) => ({ code: country.cca2, name: country.name?.common ?? country.cca2 }))
    .filter((country) => country.name)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function fetchBrazilStates(): Promise<BrazilStateOption[]> {
  const response = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome"
  );
  if (!response.ok) throw new Error("Não foi possível carregar os estados.");
  return (await response.json()) as BrazilStateOption[];
}

async function fetchBrazilCities(uf: string): Promise<BrazilCityOption[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  );
  if (!response.ok) throw new Error("Não foi possível carregar as cidades.");
  return (await response.json()) as BrazilCityOption[];
}

async function fetchViaCep(cep: string) {
  const clean = onlyDigits(cep);
  if (clean.length !== 8) throw new Error("CEP inválido.");
  const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!response.ok) throw new Error("Não foi possível consultar o CEP.");
  const data = (await response.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro) throw new Error("CEP não encontrado.");
  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
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

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${props.className ?? ""}`}
    />
  );
}

export function InstitutionCreatePage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<"INSTITUTION" | "MANAGER">("INSTITUTION");
  const [createdInstitutionId, setCreatedInstitutionId] = useState<string | null>(null);

  const [inst, setInst] = useState<InstitutionForm>({
    name: "",
    acronym: "",
    unit: "",
    country: "BR",
    stateOrCounty: "",
    city: "",
    postalCode: "",
    street: "",
    neighborhood: "",
    streetNumber: "",
    complement: "",
    allowManualAddress: false,
  });

  const [mgr, setMgr] = useState<ManagerForm>({
    name: "",
    email: "",
    cpf: "",
    birthDate: "",
    phone: "",
    country: "BR",
    city: "",
    state: "",
  });

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [brazilStates, setBrazilStates] = useState<BrazilStateOption[]>([]);
  const [brazilCities, setBrazilCities] = useState<BrazilCityOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [viaCepLoading, setViaCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBrazilInst = inst.country === "BR";
  const showStateCounty = inst.country === "BR" || inst.country === "US" || inst.country === "UK";

  const isBrazilMgr = mgr.country === "BR";
  const mgrPassword = useMemo(
    () => birthDateToInitialPassword(mgr.name, mgr.birthDate),
    [mgr.name, mgr.birthDate]
  );

  useEffect(() => {
    async function loadCountriesAndStates() {
      try {
        setLoadingCountries(true);
        setLoadingStates(true);
        const [countriesData, statesData] = await Promise.all([fetchCountries(), fetchBrazilStates()]);
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
    async function loadCities() {
      if (!isBrazilMgr || !mgr.state) {
        setBrazilCities([]);
        return;
      }
      try {
        setLoadingCities(true);
        const cities = await fetchBrazilCities(mgr.state);
        setBrazilCities(cities);
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar as cidades.");
      } finally {
        setLoadingCities(false);
      }
    }
    void loadCities();
  }, [mgr.state, isBrazilMgr]);

  async function handleLookupCep() {
    setError(null);
    try {
      setViaCepLoading(true);
      const data = await fetchViaCep(inst.postalCode);
      setInst((p) => ({
        ...p,
        street: data.street,
        neighborhood: data.neighborhood,
        city: data.city,
        stateOrCounty: data.state,
      }));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao consultar CEP.");
    } finally {
      setViaCepLoading(false);
    }
  }

  async function submitInstitution(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!inst.name.trim() || !inst.acronym.trim() || !inst.country.trim() || !inst.city.trim()) {
      setError("Preencha os campos obrigatórios da instituição.");
      return;
    }

    if (showStateCounty && !inst.stateOrCounty.trim()) {
      setError("Preencha Estado/County.");
      return;
    }

    try {
      setSubmitting(true);
      const created = await apiJson<{ id: string }>("/api/institutions", {
        method: "POST",
        body: JSON.stringify({
          name: inst.name.trim(),
          acronym: inst.acronym.trim(),
          unit: inst.unit.trim() || null,
          country: inst.country,
          state_or_county: showStateCounty ? inst.stateOrCounty.trim() : null,
          city: inst.city.trim(),
          postal_code: inst.postalCode.trim() || null,
          street: inst.street.trim() || null,
          neighborhood: inst.neighborhood.trim() || null,
          street_number: inst.streetNumber.trim() || null,
          complement: inst.complement.trim() || null,
        }),
      });
      setCreatedInstitutionId(created?.id ?? null);
      setStep("MANAGER");

      setMgr((p) => ({
        ...p,
        country: inst.country,
        city: inst.city,
        state: inst.country === "BR" ? inst.stateOrCounty : "",
      }));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao cadastrar instituição.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitManager(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (
      !createdInstitutionId ||
      !mgr.name.trim() ||
      !mgr.email.trim() ||
      !mgr.cpf.trim() ||
      !mgr.birthDate ||
      !mgr.phone.trim() ||
      !mgr.country.trim() ||
      !mgr.city.trim()
    ) {
      setError("Preencha todos os campos obrigatórios do gestor.");
      return;
    }

    if (isBrazilMgr && !mgr.state.trim()) {
      setError("Selecione o estado do gestor.");
      return;
    }

    if (!mgrPassword) {
      setError("Não foi possível gerar a senha inicial.");
      return;
    }

    try {
      setSubmitting(true);
      await apiJson("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: mgr.email.trim().toLowerCase(),
          password: mgrPassword,
          fullName: mgr.name.trim(),
          role: "GESTOR",
          institutionId: createdInstitutionId,
          cpf: onlyDigits(mgr.cpf),
          phone: mgr.phone.trim(),
          country: mgr.country,
          city: mgr.city.trim(),
          state: isBrazilMgr ? mgr.state.trim().toUpperCase() : null,
          birth_date: mgr.birthDate,
        }),
      });

      navigate(routes.institutions);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao cadastrar gestor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title="Cadastrar instituição"
        subtitle={step === "INSTITUTION" ? "Informe dados da instituição" : "Cadastre o primeiro gestor"}
      />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {step === "INSTITUTION" ? (
            <form onSubmit={submitInstitution} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel required>Nome da instituição</FieldLabel>
                  <TextField
                    value={inst.name}
                    onChange={(e) => setInst((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex.: Universidade X"
                  />
                </div>

                <div>
                  <FieldLabel required>Sigla</FieldLabel>
                  <TextField
                    value={inst.acronym}
                    onChange={(e) => setInst((p) => ({ ...p, acronym: e.target.value }))}
                    placeholder="Ex.: UFX"
                  />
                </div>

                <div>
                  <FieldLabel>Unidade</FieldLabel>
                  <TextField
                    value={inst.unit}
                    onChange={(e) => setInst((p) => ({ ...p, unit: e.target.value }))}
                    placeholder="Ex.: Campus Centro"
                  />
                </div>

                <div>
                  <FieldLabel required>País</FieldLabel>
                  <SelectField
                    value={inst.country}
                    onChange={(e) =>
                      setInst((p) => ({
                        ...p,
                        country: e.target.value,
                        stateOrCounty: "",
                      }))
                    }
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
                    {!countries.length ? (
                      <>
                        <option value="BR">Brasil</option>
                        <option value="US">Estados Unidos</option>
                        <option value="UK">Reino Unido</option>
                      </>
                    ) : null}
                  </SelectField>
                </div>

                {showStateCounty ? (
                  <div>
                    <FieldLabel required>{inst.country === "BR" ? "Estado (UF)" : "State/County"}</FieldLabel>
                    <TextField
                      value={inst.stateOrCounty}
                      onChange={(e) => setInst((p) => ({ ...p, stateOrCounty: e.target.value }))}
                      placeholder={inst.country === "BR" ? "Ex.: PR" : "Ex.: California / Greater London"}
                    />
                  </div>
                ) : (
                  <div />
                )}

                <div className={showStateCounty ? "" : "md:col-span-2"}>
                  <FieldLabel required>Cidade</FieldLabel>
                  <TextField
                    value={inst.city}
                    onChange={(e) => setInst((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Ex.: Curitiba"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <FieldLabel>Endereço</FieldLabel>
                    {isBrazilInst ? (
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={inst.allowManualAddress}
                          onChange={(e) =>
                            setInst((p) => ({ ...p, allowManualAddress: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Não sei o CEP / preencher manualmente
                      </label>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <TextField
                            value={inst.postalCode}
                            onChange={(e) => setInst((p) => ({ ...p, postalCode: e.target.value }))}
                            placeholder={isBrazilInst ? "CEP" : "Postal code"}
                            inputMode="numeric"
                          />
                        </div>
                        {isBrazilInst ? (
                          <button
                            type="button"
                            onClick={() => void handleLookupCep()}
                            disabled={viaCepLoading || inst.allowManualAddress}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {viaCepLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                            ViaCEP
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {isBrazilInst ? "Se souber o CEP, clique em ViaCEP para preencher rua/bairro/cidade/UF." : ""}
                      </div>
                    </div>

                    <div>
                      <TextField
                        value={inst.streetNumber}
                        onChange={(e) => setInst((p) => ({ ...p, streetNumber: e.target.value }))}
                        placeholder="Número"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <TextField
                        value={inst.complement}
                        onChange={(e) => setInst((p) => ({ ...p, complement: e.target.value }))}
                        placeholder="Complemento"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <TextField
                        value={inst.street}
                        onChange={(e) => setInst((p) => ({ ...p, street: e.target.value }))}
                        placeholder="Rua / Logradouro"
                        disabled={isBrazilInst && !inst.allowManualAddress}
                      />
                    </div>

                    <div>
                      <TextField
                        value={inst.neighborhood}
                        onChange={(e) => setInst((p) => ({ ...p, neighborhood: e.target.value }))}
                        placeholder="Bairro"
                        disabled={isBrazilInst && !inst.allowManualAddress}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => navigate(routes.institutions)}
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
                      <Save size={18} />
                      Continuar
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitManager} className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                Instituição criada. Agora cadastre o primeiro gestor (obrigatório).
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel required>Nome</FieldLabel>
                  <TextField
                    value={mgr.name}
                    onChange={(e) => setMgr((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <FieldLabel required>Email</FieldLabel>
                  <TextField
                    type="email"
                    value={mgr.email}
                    onChange={(e) => setMgr((p) => ({ ...p, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div>
                  <FieldLabel required>CPF</FieldLabel>
                  <TextField
                    value={mgr.cpf}
                    onChange={(e) => setMgr((p) => ({ ...p, cpf: formatCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <FieldLabel required>Celular</FieldLabel>
                  <TextField
                    value={mgr.phone}
                    onChange={(e) => setMgr((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                    placeholder="(41) 99999-9999"
                    inputMode="tel"
                  />
                </div>

                <div>
                  <FieldLabel required>País</FieldLabel>
                  <SelectField
                    value={mgr.country}
                    onChange={(e) =>
                      setMgr((p) => ({
                        ...p,
                        country: e.target.value,
                        state: e.target.value === "BR" ? p.state : "",
                        city: "",
                      }))
                    }
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

                {isBrazilMgr ? (
                  <div>
                    <FieldLabel required>Estado</FieldLabel>
                    <SelectField
                      value={mgr.state}
                      onChange={(e) =>
                        setMgr((p) => ({
                          ...p,
                          state: e.target.value,
                          city: "",
                        }))
                      }
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
                ) : (
                  <div />
                )}

                <div className={isBrazilMgr ? "" : "md:col-span-2"}>
                  <FieldLabel required>Cidade</FieldLabel>
                  {isBrazilMgr ? (
                    <SelectField
                      value={mgr.city}
                      onChange={(e) => setMgr((p) => ({ ...p, city: e.target.value }))}
                      disabled={!mgr.state || loadingCities}
                    >
                      <option value="">
                        {!mgr.state
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
                      value={mgr.city}
                      onChange={(e) => setMgr((p) => ({ ...p, city: e.target.value }))}
                      placeholder="Digite a cidade"
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  <FieldLabel required>Data de nascimento</FieldLabel>
                  <div className="relative">
                    <DatePicker
                      selected={isoToDate(mgr.birthDate)}
                      onChange={(date: Date | null) =>
                        setMgr((p) => ({ ...p, birthDate: dateToIso(date) }))
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

                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-700">Senha inicial automática</div>
                    <div className="mt-1 text-sm text-slate-500">
                      A senha inicial será gerada com as 2 primeiras letras do primeiro nome + data de nascimento + #:
                    </div>
                    <div className="mt-2 font-mono text-lg font-bold text-brand-700">
                      {mgrPassword || "An230265#"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStep("INSTITUTION")}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !createdInstitutionId}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Cadastrar gestor
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

