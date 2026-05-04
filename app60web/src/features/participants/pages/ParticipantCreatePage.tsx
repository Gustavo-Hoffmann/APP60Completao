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
import { apiJson } from "../../../lib/api/client";
import { countryLabel, getCountryOptions } from "../../../lib/isoCountries";
import { cn } from "../../../lib/utils/cn";
import { routes } from "../../../navigation/routes";
import {
  createParticipant,
  deleteParticipant,
  getParticipantById,
  ParticipantEnrollConflictError,
  participantSnapshotToCreatePayload,
  type ExistingParticipantPayload,
} from "../services/participants";

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

/** CPF BR: qualquer sequência de 11 dígitos (sem validação de dígitos verificadores). */
function isValidBrCpfLoose(cpf: string) {
  return onlyDigits(cpf).length === 11;
}

function mapDbSexToForm(sex: string | null | undefined): "M" | "F" | "" {
  const x = String(sex ?? "").trim();
  if (x === "M" || /^masculino$/i.test(x)) return "M";
  if (x === "F" || /^feminino$/i.test(x)) return "F";
  return "";
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

type InstitutionOption = { id: string; name: string; unit?: string | null };

function institutionLabel(row: InstitutionOption) {
  const u = row.unit?.trim();
  return u ? `${row.name} (${u})` : row.name;
}

export function ParticipantCreatePage() {
  const { t, i18n } = useTranslation("modules");
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeParticipantId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const isEdit = Boolean(routeParticipantId && location.pathname.endsWith("/edit"));

  const dateLocale = useMemo(() => (i18n.language?.startsWith("pt") ? ptBR : undefined), [i18n.language]);

  const needsInstitutionPicker = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const canWriteParticipantForm = Boolean(
    user &&
      (user.role === "SUPER_ADMIN" ||
        user.role === "ADMIN" ||
        (Boolean(user.institution_id) &&
          (user.role === "GESTOR" || user.role === "SUPERVISOR" || user.role === "AVALIADOR"))),
  );

  const canDeleteParticipant =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    (Boolean(user?.institution_id) && user?.role === "GESTOR");

  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);

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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTypedName, setDeleteTypedName] = useState("");

  const canSubmitParticipant = useMemo(
    () => canWriteParticipantForm && (!needsInstitutionPicker || Boolean(selectedInstitutionId)),
    [canWriteParticipantForm, needsInstitutionPicker, selectedInstitutionId],
  );

  useEffect(() => {
    if (!needsInstitutionPicker || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await apiJson<InstitutionOption[]>("/api/institutions");
        if (!cancelled) setInstitutions(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setInstitutions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsInstitutionPicker, user]);

  useEffect(() => {
    if (isEdit || !user) return;
    if (user.role === "ADMIN" && user.institution_id) {
      setSelectedInstitutionId((prev) => prev || user.institution_id!);
    }
  }, [isEdit, user]);

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
        const links = p.linkedInstitutionIds?.filter(Boolean) ?? [];
        if (links.length === 1) {
          setSelectedInstitutionId(links[0]!);
        }
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
      if (!isValidBrCpfLoose(identity)) return t("participantCreate.errors.cpfInvalid");
    } else {
      const doc = identity.normalize("NFKC").trim();
      if (doc.length < 3) return t("participantCreate.errors.identityInvalid");
    }
    if (!sex) return t("participantCreate.errors.sexRequired");

    if (needsInstitutionPicker && !selectedInstitutionId) {
      return t("participantCreate.errors.institutionRequired");
    }

    const cepDigits = onlyDigits(cep);
    if (isBr && cepDigits.length === 8 && !number.trim()) {
      return t("participantCreate.errors.numberRequiredWithCep");
    }

    return null;
  }

  function buildCreateApiPayload(confirmLinkExisting?: boolean) {
    const cepDigits = onlyDigits(cep);
    const cepPayload = isBr
      ? cepDigits.length
        ? cepDigits
        : undefined
      : cep.trim()
        ? cep.trim()
        : undefined;
    const idVal = isBr ? onlyDigits(identity) : identity.normalize("NFKC").trim();
    return {
      ...(isEdit && routeParticipantId ? { id: routeParticipantId } : {}),
      fullName: fullName.trim(),
      nationality: nationality.trim().toUpperCase(),
      identity: idVal,
      ...(isBr && idVal ? { cpf: idVal } : {}),
      birthDate: birthDate.toISOString().slice(0, 10),
      sex: sex === "M" || sex === "F" ? sex : undefined,
      cep: cepPayload,
      street: street.trim() || undefined,
      number: number.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim().toUpperCase() || undefined,
      complement: complement.trim() || undefined,
      ...((user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && selectedInstitutionId
        ? { institutionId: selectedInstitutionId }
        : {}),
      ...(confirmLinkExisting ? { confirmLinkExisting: true as const } : {}),
    };
  }

  function hydrateFormFromSnapshot(p: ExistingParticipantPayload) {
    setFullName(String(p.full_name ?? "").trim());
    const nat = String(p.nationality ?? "BR")
      .trim()
      .toUpperCase();
    setNationality(nat);
    const br = nat === "BR";
    setIdentity(br ? formatCpf(String(p.cpf_normalized ?? "")) : String(p.cpf_normalized ?? ""));
    if (p.birth_date) {
      const d = new Date(p.birth_date);
      if (!Number.isNaN(d.getTime())) setBirthDate(d);
    }
    setSex(mapDbSexToForm(p.sex));
    setCep(br && p.cep ? formatCep(String(p.cep)) : String(p.cep ?? ""));
    setStreet(String(p.street ?? ""));
    setNumber(String(p.number ?? ""));
    setComplement(String(p.complement ?? ""));
    setNeighborhood(String(p.neighborhood ?? ""));
    setCity(String(p.city ?? ""));
    setState(String(p.state ?? "").trim().toUpperCase());
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

      const created = await createParticipant(buildCreateApiPayload());
      navigate(routes.participantDetail(created.id), { replace: true });
    } catch (e) {
      if (e instanceof ParticipantEnrollConflictError) {
        const ok = window.confirm(t("participantCreate.existingParticipantConfirm"));
        if (!ok) {
          setError(null);
          return;
        }
        hydrateFormFromSnapshot(e.participant);
        try {
          const instExtra =
            user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
              ? selectedInstitutionId || undefined
              : undefined;
          const retry = participantSnapshotToCreatePayload(e.participant, {
            institutionId: instExtra,
          });
          const createdRetry = await createParticipant(retry);
          navigate(routes.participantDetail(createdRetry.id), { replace: true });
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : t("participantCreate.errors.saveFailed"));
        }
        return;
      }
      setError(e instanceof Error ? e.message : t("participantCreate.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !routeParticipantId) return;
    setDeleteTypedName("");
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!isEdit || !routeParticipantId) return;

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

  const deleteName = fullName.trim();
  const deleteNameMatches =
    deleteTypedName.trim().length > 0 &&
    new Intl.Collator(i18n.resolvedLanguage ?? i18n.language ?? "pt-BR", {
      sensitivity: "base",
      usage: "search",
    }).compare(deleteTypedName.trim(), deleteName) === 0;

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title={isEdit ? t("participantEdit.title") : t("participantCreate.title")}
        subtitle={isEdit ? t("participantEdit.subtitle") : t("participantCreate.subtitle")}
      />

      <main className="space-y-6 px-6 py-8">
        {deleteModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <Card className="w-full max-w-lg p-6 shadow-xl">
              <p className="text-sm font-semibold text-slate-900">{t("participantEdit.deleteModalTitle")}</p>
              <p className="mt-2 text-sm text-slate-600">
                {t("participantEdit.deleteModalBody", { name: deleteName || "—" })}
              </p>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantEdit.deleteModalInputLabel")}
                </label>
                <Input
                  value={deleteTypedName}
                  onChange={(e) => setDeleteTypedName(e.target.value)}
                  placeholder={t("participantEdit.deleteModalPlaceholder")}
                />
                {!deleteNameMatches && deleteTypedName.trim().length ? (
                  <p className="mt-2 text-xs font-semibold text-red-700">{t("participantEdit.deleteTypeMismatch")}</p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                >
                  {t("participantEdit.deleteModalCancel")}
                </Button>
                <button
                  type="button"
                  className={
                    deleteNameMatches && !deleting
                      ? "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-red-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-red-600"
                      : "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-100"
                  }
                  onClick={() => void confirmDelete()}
                  disabled={deleting || !deleteNameMatches}
                >
                  {deleting ? t("participantEdit.deleting") : t("participantEdit.deleteModalConfirm")}
                </button>
              </div>
            </Card>
          </div>
        ) : null}

        <div>
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            <ArrowLeft size={16} />
            {backLabel}
          </Link>
        </div>

        {!canWriteParticipantForm ? (
          <Card className="p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">{t("participantCreate.disabledTitle")}</p>
            <p className="mt-2 text-sm text-slate-600">{t("participantCreate.disabledBody")}</p>
          </Card>
        ) : (
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
          {needsInstitutionPicker ? (
            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-4 md:px-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                {t("participantCreate.fields.institution")}
              </label>
              <select
                className={cn(
                  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition",
                  "focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
                )}
                value={selectedInstitutionId}
                onChange={(e) => setSelectedInstitutionId(e.target.value)}
              >
                <option value="">{t("participantCreate.institutionPlaceholder")}</option>
                {institutions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {institutionLabel(row)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-600">{t("participantCreate.hints.institutionPicker")}</p>
            </div>
          ) : null}

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
              disabled={!canSubmitParticipant || saving || loadingParticipant}
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
        )}
      </main>
    </div>
  );
}
