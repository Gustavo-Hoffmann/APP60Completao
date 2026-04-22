import {
  AlertTriangle,
  BadgeCheck,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  User as UserIcon,
  UserRoundX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AppHeader } from "../../../components/layout/AppHeader";
import { useAuth } from "../../../contexts/AuthContext";
import { apiFetch, apiJson } from "../../../lib/api/client";
import { routes } from "../../../navigation/routes";
import type { Role } from "../../../types/auth";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  primary_institution_id: string | null;
  is_active: boolean;
  created_at?: string | null;
};

type TabKey = "TODOS" | Role;

const TABS: TabKey[] = ["TODOS", "SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];

const ROLE_META: Record<
  Role,
  {
    icon: typeof Shield;
    badgeClass: string;
    glowClass: string;
  }
> = {
  SUPER_ADMIN: {
    icon: Shield,
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
    glowClass: "from-violet-500/10 via-fuchsia-500/5 to-transparent",
  },
  ADMIN: {
    icon: Shield,
    badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
    glowClass: "from-indigo-500/10 via-violet-500/5 to-transparent",
  },
  GESTOR: {
    icon: GraduationCap,
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
    glowClass: "from-blue-500/10 via-cyan-500/5 to-transparent",
  },
  SUPERVISOR: {
    icon: GraduationCap,
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-800",
    glowClass: "from-cyan-500/10 via-teal-500/5 to-transparent",
  },
  AVALIADOR: {
    icon: UserIcon,
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    glowClass: "from-emerald-500/10 via-lime-500/5 to-transparent",
  },
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale);
}

export function UsersPage() {
  const { t, i18n } = useTranslation(["modules", "navigation"]);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("TODOS");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const roleLabel = (role: Role) => t(`navigation:role.${role}`);
  const tabLabel = (tabKey: TabKey) =>
    tabKey === "TODOS" ? t("modules:users.tabs.all") : roleLabel(tabKey);

  async function loadUsers(mode: "initial" | "refresh" = "initial") {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      setError(null);

      const data = await apiJson<
        Array<{
          id: string;
          full_name: string;
          email: string | null;
          role: Role;
          primary_institution_id: string | null;
          is_active: boolean;
          created_at?: string | null;
        }>
      >("/api/users");

      setUsers(
        (data ?? []).map((row) => ({
          id: row.id,
          name: row.full_name,
          email: row.email,
          role: row.role,
          primary_institution_id: row.primary_institution_id,
          is_active: row.is_active,
          created_at: row.created_at,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      setError(err instanceof Error ? err.message : t("modules:users.loadErrorFallback"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadUsers("initial");
  }, [t]);

  async function handleDeactivate(target: UserRow) {
    if (!currentUser) return;
    if (target.id === currentUser.id) return;

    const confirmed = window.confirm(
      t("modules:users.confirmDeactivate", { name: target.name })
    );

    if (!confirmed) return;

    try {
      setBusyUserId(target.id);

      const res = await apiFetch(`/api/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      });
      if (!res.ok) {
        const responseText = await res.text();
        throw new Error(responseText || t("modules:users.deactivateFail"));
      }

      setUsers((prev) => prev.filter((item) => item.id !== target.id));
    } catch (err) {
      console.error("Erro ao desativar usuário:", err);
      window.alert(err instanceof Error ? err.message : t("modules:users.deactivateError"));
    } finally {
      setBusyUserId(null);
    }
  }

  const stats = useMemo(() => {
    return {
      total: users.length,
      superAdmins: users.filter((item) => item.role === "SUPER_ADMIN").length,
      admins: users.filter((item) => item.role === "ADMIN").length,
      gestores: users.filter((item) => item.role === "GESTOR").length,
      supervisores: users.filter((item) => item.role === "SUPERVISOR").length,
      avaliadores: users.filter((item) => item.role === "AVALIADOR").length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((item) => {
      const matchesTab = tab === "TODOS" ? true : item.role === tab;

      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.email ?? "").toLowerCase().includes(term) ||
        roleLabel(item.role).toLowerCase().includes(term);

      return matchesTab && matchesSearch;
    });
  }, [users, search, tab, t]);

  const currentUserCard = useMemo(() => {
    if (!currentUser) return null;
    return users.find((item) => item.id === currentUser.id) ?? null;
  }, [users, currentUser]);

  const otherUsers = useMemo(() => {
    if (!currentUser) return filteredUsers;
    return filteredUsers.filter((item) => item.id !== currentUser.id);
  }, [filteredUsers, currentUser]);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title={t("modules:users.title")}
        subtitle={t("modules:users.subtitle")}
      />

      <main className="space-y-6 px-6 py-8">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(routes.userCreate)}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              {t("modules:users.createButton")}
            </button>

            <button
              type="button"
              onClick={() => void loadUsers("refresh")}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
              {t("modules:users.refreshButton")}
            </button>
          </div>

          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder={t("modules:users.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard label={t("modules:users.stats.total")} value={stats.total} />
          <MetricCard label={t("modules:users.stats.superAdmin")} value={stats.superAdmins} />
          <MetricCard label={t("modules:users.stats.admins")} value={stats.admins} />
          <MetricCard label={t("modules:users.stats.managers")} value={stats.gestores} />
          <MetricCard label={t("modules:users.stats.supervisors")} value={stats.supervisores} />
          <MetricCard label={t("modules:users.stats.evaluators")} value={stats.avaliadores} />
        </section>

        <section className="flex flex-wrap gap-3">
          {TABS.map((item) => {
            const isActive = tab === item;

            return (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tabLabel(item)}
              </button>
            );
          })}
        </section>

        {currentUserCard ? (
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <BadgeCheck size={16} className="text-blue-600" />
              {t("modules:users.myAccount")}
            </div>

            <UserPremiumCard
              user={currentUserCard}
              highlighted
              canEdit={false}
              canDeactivate={false}
              onEdit={() => {}}
              onDeactivate={() => {}}
              loading={false}
              locale={i18n.resolvedLanguage ?? "pt-BR"}
            />
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <UserIcon size={16} />
            {t("modules:users.otherUsers")}
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                {t("modules:users.loading")}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 text-red-600" size={18} />
                <div>
                  <p className="font-semibold text-red-700">{t("modules:users.loadErrorTitle")}</p>
                  <p className="mt-1 text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          ) : otherUsers.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-700">
                {t("modules:users.emptyTitle")}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t("modules:users.emptySubtitle")}
              </p>
            </div>
          ) : (
            otherUsers.map((item) => (
              <UserPremiumCard
                key={item.id}
                user={item}
                highlighted={false}
                canEdit
                canDeactivate={!!currentUser && item.id !== currentUser.id}
                onEdit={() => navigate(routes.userEdit(item.id))}
                onDeactivate={() => void handleDeactivate(item)}
                loading={busyUserId === item.id}
                locale={i18n.resolvedLanguage ?? "pt-BR"}
              />
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function UserPremiumCard({
  user,
  highlighted,
  canEdit,
  canDeactivate,
  onEdit,
  onDeactivate,
  loading,
  locale,
}: {
  user: UserRow;
  highlighted: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  loading: boolean;
  locale: string;
}) {
  const { t } = useTranslation(["modules", "navigation"]);
  const roleMeta = ROLE_META[user.role];
  const RoleIcon = roleMeta.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border p-6 shadow-sm transition hover:shadow-md ${
        highlighted
          ? "border-blue-500 bg-gradient-to-br from-blue-600 via-blue-700 to-sky-700 text-white shadow-lg shadow-blue-200"
          : "border-slate-200 bg-white"
      }`}
    >
      {!highlighted ? (
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${roleMeta.glowClass}`} />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.16),transparent_24%)]" />
      )}

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold ${
              highlighted
                ? "bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-sm"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {getInitials(user.name)}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`text-2xl font-bold ${highlighted ? "text-white" : "text-slate-900"}`}>
                {user.name}
              </h2>
              {highlighted ? (
                <span className="rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  {t("modules:users.currentAccountBadge")}
                </span>
              ) : null}
            </div>

            <p className={`mt-1 text-sm ${highlighted ? "text-blue-50/90" : "text-slate-500"}`}>
              {user.email || t("modules:users.noEmail")}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                  highlighted
                    ? "border-white/20 bg-white/12 text-white backdrop-blur-sm"
                    : roleMeta.badgeClass
                }`}
              >
                <RoleIcon size={14} />
                {t(`navigation:role.${user.role}`)}
              </span>

              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                  highlighted
                    ? "border-white/20 bg-white/12 text-white/95 backdrop-blur-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {t("modules:users.active")}
              </span>

              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                  highlighted
                    ? "border-white/20 bg-white/12 text-white/95 backdrop-blur-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {t("modules:users.createdAt", { date: formatDate(user.created_at, locale) })}
              </span>
            </div>
          </div>
        </div>

        {!highlighted ? (
          <div className="flex flex-wrap items-center gap-3">
            {canEdit ? (
              <button
                type="button"
                onClick={onEdit}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <Pencil size={16} />
                {t("modules:users.editProfile")}
              </button>
            ) : null}

            {canDeactivate ? (
              <button
                type="button"
                onClick={onDeactivate}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserRoundX size={16} />
                )}
                {t("modules:users.deactivate")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}