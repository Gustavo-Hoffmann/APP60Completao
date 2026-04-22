import { AlertTriangle, Loader2, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

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
};

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
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${props.className ?? ""}`}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${props.className ?? ""}`}
    />
  );
}

export function InstitutionEditPage() {
  const { t } = useTranslation("modules");
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<InstitutionRow | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        setLoadError(null);
        const list = await apiJson<InstitutionRow[]>("/api/institutions");
        const found = (list ?? []).find((r) => r.id === id) ?? null;
        if (!found) {
          setLoadError(t("institutionEdit.errors.notFound"));
          setForm(null);
          return;
        }
        setForm(found);
      } catch (err) {
        console.error(err);
        setLoadError(err instanceof Error ? err.message : t("institutionEdit.errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, t]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id || !form) return;
    setFormError(null);

    if (!form.name.trim() || !form.acronym.trim() || !form.country.trim() || !form.city.trim()) {
      setFormError(t("institutionEdit.errors.requiredFields"));
      return;
    }

    try {
      setSaving(true);
      await apiJson(`/api/institutions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          acronym: form.acronym.trim(),
          unit: form.unit?.trim() || null,
          country: form.country,
          state_or_county: form.state_or_county?.trim() || null,
          city: form.city.trim(),
          postal_code: form.postal_code?.trim() || null,
          street: form.street?.trim() || null,
          neighborhood: form.neighborhood?.trim() || null,
          street_number: form.street_number?.trim() || null,
          complement: form.complement?.trim() || null,
          is_active: form.is_active,
        }),
      });
      navigate(routes.institutions);
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : t("institutionEdit.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !form) return;

    const confirmed = window.confirm(
      t("institutionEdit.confirmDelete", {
        name: `${form.name}${form.unit ? ` - ${form.unit}` : ""}`,
      })
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      setFormError(null);
      await apiJson(`/api/institutions/${id}`, { method: "DELETE" });
      navigate(routes.institutions);
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : t("institutionEdit.errors.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader title={t("institutionEdit.title")} subtitle={t("institutionEdit.subtitle")} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              {t("institutionEdit.loading")}
            </div>
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-red-600" size={18} />
              <div>
                <p className="font-semibold text-red-700">{t("institutionEdit.errorTitle")}</p>
                <p className="mt-1 text-sm text-red-600">{loadError}</p>
              </div>
            </div>
          </div>
        ) : !form ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            {t("institutionEdit.errors.notFound")}
          </div>
        ) : (
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <form onSubmit={handleSave} className="space-y-6">
              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel required>{t("institutionEdit.name")}</FieldLabel>
                  <TextField
                    value={form.name}
                    onChange={(e) => setForm((p) => (p ? { ...p, name: e.target.value } : p))}
                  />
                </div>

                <div>
                  <FieldLabel required>{t("institutionEdit.acronym")}</FieldLabel>
                  <TextField
                    value={form.acronym}
                    onChange={(e) => setForm((p) => (p ? { ...p, acronym: e.target.value } : p))}
                  />
                </div>

                <div>
                  <FieldLabel>{t("institutionEdit.unit")}</FieldLabel>
                  <TextField
                    value={form.unit ?? ""}
                    onChange={(e) => setForm((p) => (p ? { ...p, unit: e.target.value } : p))}
                  />
                </div>

                <div>
                  <FieldLabel required>{t("userForm.country")}</FieldLabel>
                  <SelectField
                    value={form.country}
                    onChange={(e) => setForm((p) => (p ? { ...p, country: e.target.value } : p))}
                  >
                    <option value="BR">{t("institutionEdit.countryBrazil")}</option>
                    <option value="US">{t("institutionEdit.countryUsa")}</option>
                    <option value="UK">{t("institutionEdit.countryUk")}</option>
                    <option value={form.country}>{form.country}</option>
                  </SelectField>
                </div>

                <div>
                  <FieldLabel>{t("institutionEdit.stateCounty")}</FieldLabel>
                  <TextField
                    value={form.state_or_county ?? ""}
                    onChange={(e) =>
                      setForm((p) => (p ? { ...p, state_or_county: e.target.value } : p))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel required>{t("userForm.city")}</FieldLabel>
                  <TextField
                    value={form.city}
                    onChange={(e) => setForm((p) => (p ? { ...p, city: e.target.value } : p))}
                  />
                </div>

                <div>
                  <FieldLabel>{t("institutionEdit.postalCode")}</FieldLabel>
                  <TextField
                    value={form.postal_code ?? ""}
                    onChange={(e) =>
                      setForm((p) => (p ? { ...p, postal_code: e.target.value } : p))
                    }
                  />
                </div>

                <div>
                  <FieldLabel>{t("institutionEdit.number")}</FieldLabel>
                  <TextField
                    value={form.street_number ?? ""}
                    onChange={(e) =>
                      setForm((p) => (p ? { ...p, street_number: e.target.value } : p))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>{t("institutionEdit.complement")}</FieldLabel>
                  <TextField
                    value={form.complement ?? ""}
                    onChange={(e) =>
                      setForm((p) => (p ? { ...p, complement: e.target.value } : p))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>{t("institutionEdit.street")}</FieldLabel>
                  <TextField
                    value={form.street ?? ""}
                    onChange={(e) => setForm((p) => (p ? { ...p, street: e.target.value } : p))}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>{t("institutionEdit.neighborhood")}</FieldLabel>
                  <TextField
                    value={form.neighborhood ?? ""}
                    onChange={(e) =>
                      setForm((p) => (p ? { ...p, neighborhood: e.target.value } : p))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((p) => (p ? { ...p, is_active: e.target.checked } : p))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {t("institutionEdit.activeInstitution")}
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={saving || deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {t("institutionEdit.deleting")}
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      {t("institutionEdit.deleteButton")}
                    </>
                  )}
                </button>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => navigate(routes.institutions)}
                    disabled={saving || deleting}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("userForm.actions.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {t("userForm.actions.saving")}
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        {t("institutionEdit.saveButton")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

