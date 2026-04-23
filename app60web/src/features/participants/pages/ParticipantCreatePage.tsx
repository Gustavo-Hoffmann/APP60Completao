import { ArrowLeft, CalendarDays, Loader2, MapPin, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import "react-datepicker/dist/react-datepicker.css";

import { AppHeader } from "../../../components/layout/AppHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../../contexts/AuthContext";
import { countryLabel, getCountryOptions } from "../../../lib/isoCountries";
import { cn } from "../../../lib/utils/cn";
import { routes } from "../../../navigation/routes";
import { createParticipant, deleteParticipant, getParticipantById } from "../services/participants";

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

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  const a = digits.slice(0, 5);
  const b = digits.slice(5, 8);
  if (digits.length <= 5) return a;
  return `${a}-${b}`;
}

function isValidCpf(cpf: string) {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheck = (base: string, factorStart: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (factorStart - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d9 = calcCheck(digits.slice(0, 9), 10);
  const d10 = calcCheck(digits.slice(0, 10), 11);
  return d9 === Number(digits[9]) && d10 === Number(digits[10]);
}

type ViaCepResponse = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

async function fetchViaCep(cepDigits: string): Promise<ViaCepResponse> {
  const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
  if (!res.ok) throw new Error("lookup_failed");
  const data = (await res.json()) as ViaCepResponse;
  if (data?.erro) throw new Error("lookup_failed");
  return data;
}

export function ParticipantCreatePage() {
  const { t, i18n } = useTranslation("modules");
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeParticipantId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const isEdit = Boolean(routeParticipantId && location.pathname.endsWith("/edit"));

  const dateLocale = useMemo(() => (i18n.language?.startsWith("pt") ? ptBR : undefined), [i18n.language]);

  const canPersistParticipant = Boolean(user?.institution_id) && user?.role !== "SUPER_ADMIN";

  const canDeleteParticipant =
    Boolean(user?.institution_id) && (user?.role === "ADMIN" || user?.role === "GESTOR");

  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState("BR");
  const [identity, setIdentity] = useState("");
  const [birthDate, setBirthDate] = useState<Date>(new Date("2000-01-01"));
  const [sex, setSex] = useState<"M" | "F" | "">("");

  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingParticipant, setLoadingParticipant] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !routeParticipantId) {
      setLoadingParticipant(false);
      return;
    }

    const participantId = routeParticipantId;
    let cancelled = false;

    async function load() {
      setLoadingParticipant(true);
      setError(null);
      try {
        const p = await getParticipantById(participantId);
        if (cancelled) return;
        if (!p) {
          setError(t("participantEdit.loadFailed"));
          setLoadingParticipant(false);
          return;
        }
        setFullName(p.name);
        const nat = String(p.nationality ?? "BR")
          .trim()
          .toUpperCase();
        setNationality(nat);
        const br = nat === "BR";
        setIdentity(br ? formatCpf(p.cpf) : p.cpf);
        if (p.dob) {
          const d = new Date(p.dob);
          if (!Number.isNaN(d.getTime())) setBirthDate(d);
        }
        setSex(p.sex === "Masculino" ? "M" : p.sex === "Feminino" ? "F" : "");
        setCep(p.cep ?? "");
        setStreet(p.street ?? "");
        setNumber(p.number ?? "");
        setComplement(p.complement ?? "");
        setNeighborhood(p.neighborhood ?? "");
        setCity(p.city ?? "");
        setState(String(p.state ?? "").trim().toUpperCase());
      } catch {
        if (!cancelled) setError(t("participantEdit.loadFailed"));
      } finally {
        if (!cancelled) setLoadingParticipant(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isEdit, routeParticipantId, t]);

  const countryOptions = useMemo(() => {
    const lang = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
    const opts = getCountryOptions(lang);
    if (opts.some((o) => o.code === nationality)) return opts;
    return [{ code: nationality, label: countryLabel(lang, nationality) }, ...opts];
  }, [i18n.resolvedLanguage, i18n.language, nationality]);

  const isBr = nationality.trim().toUpperCase() === "BR";

  async function onFetchCep() {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      setError(t("participantCreate.errors.invalidCep"));
      return;
    }

    try {
      setLoadingCep(true);
      setError(null);
      const data = await fetchViaCep(digits);
      setStreet((data.logradouro ?? "").trim());
      setNeighborhood((data.bairro ?? "").trim());
      setCity((data.localidade ?? "").trim());
      setState(String(data.uf ?? "").trim().toUpperCase());
    } catch {
      setError(t("participantCreate.errors.cepLookup"));
    } finally {
      setLoadingCep(false);
    }
  }

  function validate(): string | null {
    if (!fullName.trim()) return t("participantCreate.errors.nameRequired");
    const nat = nationality.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(nat)) return t("participantCreate.errors.nationalityInvalid");
    if (isBr) {
      if (!isValidCpf(identity)) return t("participantCreate.errors.cpfInvalid");
    } else {
      const doc = identity.normalize("NFKC").trim();
      if (doc.length < 3) return t("participantCreate.errors.identityInvalid");
    }
    if (!sex) return t("participantCreate.errors.sexRequired");

    const cepDigits = onlyDigits(cep);
    if (isBr && cepDigits.length === 8 && !number.trim()) {
      return t("participantCreate.errors.numberRequiredWithCep");
    }

    return null;
  }

  async function onSubmit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const cepDigits = onlyDigits(cep);
      const cepPayload = isBr
        ? cepDigits.length
          ? cepDigits
          : undefined
        : cep.trim()
          ? cep.trim()
          : undefined;
      const payload = {
        ...(isEdit && routeParticipantId ? { id: routeParticipantId } : {}),
        fullName: fullName.trim(),
        nationality: nationality.trim().toUpperCase(),
        identity: isBr ? onlyDigits(identity) : identity.normalize("NFKC").trim(),
        birthDate: birthDate.toISOString().slice(0, 10),
        sex: sex === "M" || sex === "F" ? sex : undefined,
        cep: cepPayload,
        street: street.trim() || undefined,
        number: number.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim().toUpperCase() || undefined,
        complement: complement.trim() || undefined,
      };

      const created = await createParticipant(payload);
      navigate(routes.participantDetail(created.id), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("participantCreate.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !routeParticipantId) return;
    if (!window.confirm(t("participantEdit.deleteConfirm"))) return;

    try {
      setDeleting(true);
      setError(null);
      await deleteParticipant(routeParticipantId);
      navigate(routes.participants, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("participantEdit.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const backHref = isEdit && routeParticipantId ? routes.participantDetail(routeParticipantId) : routes.participants;
  const backLabel = isEdit ? t("participantEdit.back") : t("participantCreate.back");

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title={isEdit ? t("participantEdit.title") : t("participantCreate.title")}
        subtitle={isEdit ? t("participantEdit.subtitle") : t("participantCreate.subtitle")}
      />

      <main className="space-y-6 px-6 py-8">
        <div>
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            <ArrowLeft size={16} />
            {backLabel}
          </Link>
        </div>

        {!canPersistParticipant ? (
          <Card className="p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">{t("participantCreate.disabledTitle")}</p>
            <p className="mt-2 text-sm text-slate-600">{t("participantCreate.disabledBody")}</p>
          </Card>
        ) : null}

        <Card className="p-6 shadow-sm">
          {error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loadingParticipant ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-slate-600">
              <Loader2 className="animate-spin" size={18} />
              {t("participantEdit.loading")}
            </div>
          ) : (
            <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("participantCreate.fields.fullName")}
              </label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("participantCreate.fields.birthDate")}
              </label>
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400"
                />
                <DatePicker
                  selected={birthDate}
                  onChange={(d: Date | null) => {
                    if (d) setBirthDate(d);
                  }}
                  dateFormat="dd/MM/yyyy"
                  locale={dateLocale}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("participantCreate.fields.nationality")}
              </label>
              <select
                className={cn(
                  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition",
                  "focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
                )}
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
              >
                {countryOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">{t("participantCreate.hints.nationality")}</p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {isBr ? t("participantCreate.fields.cpf") : t("participantCreate.fields.identity")}
              </label>
              <Input
                value={identity}
                onChange={(e) => setIdentity(isBr ? formatCpf(e.target.value) : e.target.value)}
                inputMode={isBr ? "numeric" : "text"}
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("participantCreate.fields.sex")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSex("M")}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm font-black transition",
                    sex === "M"
                      ? "border-blue-300 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {t("participantCreate.sex.male")}
                </button>
                <button
                  type="button"
                  onClick={() => setSex("F")}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm font-black transition",
                    sex === "F"
                      ? "border-blue-300 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {t("participantCreate.sex.female")}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-8">
            <div className="mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">{t("participantCreate.addressTitle")}</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {isBr ? t("participantCreate.fields.cep") : t("participantCreate.fields.postalCode")}
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    className="sm:flex-1"
                    value={cep}
                    onChange={(e) => setCep(isBr ? formatCep(e.target.value) : e.target.value)}
                    inputMode={isBr ? "numeric" : "text"}
                  />
                  {isBr ? (
                    <Button type="button" variant="secondary" onClick={() => void onFetchCep()} disabled={loadingCep}>
                      {loadingCep ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="animate-spin" size={16} />
                          {t("participantCreate.cepLoading")}
                        </span>
                      ) : (
                        t("participantCreate.cepLookup")
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantCreate.fields.street")}
                </label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantCreate.fields.number")}
                </label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantCreate.fields.complement")}
                </label>
                <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantCreate.fields.neighborhood")}
                </label>
                <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantCreate.fields.city")}
                </label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantCreate.fields.state")}
                </label>
                <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(backHref)}>
              {t("participantCreate.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!canPersistParticipant || saving || loadingParticipant}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  {t("participantCreate.saving")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {isEdit ? null : <UserPlus size={16} />}
                  {isEdit ? t("participantEdit.save") : t("participantCreate.save")}
                </span>
              )}
            </Button>
          </div>

          {isEdit && routeParticipantId && canDeleteParticipant ? (
            <div className="mt-10 border-t border-slate-200 pt-8">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting || loadingParticipant}
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => void onDelete()}
              >
                {deleting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    {t("participantEdit.deleting")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Trash2 size={16} />
                    {t("participantEdit.delete")}
                  </span>
                )}
              </Button>
            </div>
          ) : null}
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
