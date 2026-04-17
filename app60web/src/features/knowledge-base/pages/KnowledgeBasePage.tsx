import { ExternalLink, Info, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppHeader } from "../../../components/layout/AppHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { apiFetch, apiJson } from "../../../lib/api/client";
import { canManageUsers } from "../../../lib/auth/permissions";

type KnowledgeBaseKind = "TUTORIAL" | "ARTIGO";

type KnowledgeBaseItem = {
  id: string;
  kind: KnowledgeBaseKind;
  acronym: string;
  title: string;
  url: string;
  created_at: string;
};

function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function safeHost(url: string) {
  try {
    const u = new URL(normalizeUrl(url));
    return u.host;
  } catch {
    return "";
  }
}

function labelKind(kind: KnowledgeBaseKind) {
  return kind === "TUTORIAL" ? "Tutoriais" : "Artigos científicos";
}

export function KnowledgeBasePage() {
  const { user } = useAuth();
  const canAdd = !!user?.role && canManageUsers(user.role);

  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<KnowledgeBaseKind>("TUTORIAL");
  const [acronym, setAcronym] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  async function load() {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await apiJson<KnowledgeBaseItem[]>("/api/knowledge-base");
      setItems(data ?? []);
    } catch (err) {
      console.error(err);
      setLoadError(
        err instanceof Error ? err.message : "Não foi possível carregar a base de conhecimento."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const tutorials = items.filter((i) => i.kind === "TUTORIAL");
    const articles = items.filter((i) => i.kind === "ARTIGO");
    return { tutorials, articles };
  }, [items]);

  async function handleCreate() {
    if (!canAdd) return;

    const a = acronym.trim();
    const t = title.trim();
    const u = url.trim();

    if (!a || !t || !u) {
      window.alert("Preencha tipo, sigla, título e URL.");
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      const res = await apiFetch("/api/knowledge-base", {
        method: "POST",
        body: JSON.stringify({
          kind,
          acronym: a,
          title: t,
          url: normalizeUrl(u),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text || "Erro ao salvar.";
        try {
          const parsed = JSON.parse(text) as unknown;
          if (parsed && typeof parsed === "object" && "error" in parsed) {
            const e = (parsed as { error?: unknown }).error;
            if (typeof e === "string") msg = e;
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      await load();

      setShowForm(false);
      setKind("TUTORIAL");
      setAcronym("");
      setTitle("");
      setUrl("");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Erro ao salvar.";
      setSaveError(message);
      window.alert(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title="Base de conhecimento"
        subtitle="Tutoriais e artigos científicos relevantes para a equipe"
      />

      <main className="space-y-6 px-6 py-8">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Carregando base de conhecimento...
            </div>
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 text-red-600" size={18} />
              <div>
                <p className="font-semibold text-red-700">Erro ao carregar</p>
                <p className="mt-1 text-sm text-red-600">{loadError}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <KnowledgeList title={labelKind("TUTORIAL")} items={grouped.tutorials} />
            <KnowledgeList title={labelKind("ARTIGO")} items={grouped.articles} />
          </div>
        )}

        {canAdd ? (
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Adicionar base
            </button>

            {showForm ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-4">
                {saveError ? (
                  <div className="lg:col-span-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {saveError}
                  </div>
                ) : null}

                <div className="lg:col-span-1">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Tipo
                  </label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as KnowledgeBaseKind)}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="TUTORIAL">Tutorial</option>
                    <option value="ARTIGO">Artigo científico</option>
                  </select>
                </div>

                <div className="lg:col-span-1">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Sigla
                  </label>
                  <input
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                    placeholder="Ex.: 2MST"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Título
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Smartphone assessment for the 2MST"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="lg:col-span-4">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    URL
                  </label>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Ex.: www.paper.com"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="lg:col-span-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-70"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                    Salvar
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function KnowledgeList({ title, items }: { title: string; items: KnowledgeBaseItem[] }) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.length}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Nenhum item cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={normalizeUrl(item.url)}
              target="_blank"
              rel="noreferrer"
              className="group block rounded-[22px] border border-slate-200 bg-white p-4 transition hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {item.acronym} - {item.title}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {item.url} {safeHost(item.url) ? `• ${safeHost(item.url)}` : ""}
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition group-hover:bg-slate-50">
                  <ExternalLink size={14} />
                  Abrir
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

