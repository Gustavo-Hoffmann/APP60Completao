import {
  Activity,
  ClipboardList,
  Info,
  Landmark,
  LayoutDashboard,
  School,
  UserCircle2,
  Users,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { routes } from "../../navigation/routes";
import { useAuth } from "../../contexts/AuthContext";
import type { Role } from "../../types/auth";

type SidebarItem = {
  to: string;
  labelKey: string;
  icon: typeof Activity;
  roles: Role[];
};

type Props = {
  isDark: boolean;
};

const items: SidebarItem[] = [
  {
    to: routes.dashboard,
    labelKey: "navigation:sidebar.dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"],
  },
  {
    to: routes.users,
    labelKey: "navigation:sidebar.users",
    icon: Users,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    to: routes.institutions,
    labelKey: "navigation:sidebar.institutions",
    icon: Landmark,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    to: routes.participants,
    labelKey: "navigation:sidebar.participants",
    icon: Users,
    roles: ["SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"],
  },
  {
    to: routes.questionnaires,
    labelKey: "navigation:sidebar.questionnaires",
    icon: ClipboardList,
    roles: ["SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"],
  },
  {
    to: routes.tests,
    labelKey: "navigation:sidebar.tests",
    icon: Activity,
    roles: ["SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"],
  },
  {
    to: routes.myInstitution,
    labelKey: "navigation:sidebar.myInstitution",
    icon: School,
    roles: ["GESTOR"],
  },
];

function getInitials(name?: string) {
  if (!name) return "--";

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppSidebar({ isDark }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(["navigation"]);

  const visibleItems = items.filter((item) => {
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside
      className={[
        "hidden w-72 shrink-0 border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col",
        isDark
          ? "border-slate-800 bg-slate-900"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="px-5 py-5">
        <img
          src={isDark ? "/logo-seniorsense-dark.png" : "/logo-seniorsense.png"}
          alt="SeniorSense 60+"
          className="h-35 w-auto max-w-full object-contain object-left"
        />
        <div
          className={[
            "mt-2 text-xs",
            isDark ? "text-slate-400" : "text-slate-500",
          ].join(" ")}
        >
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 pb-6">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === routes.dashboard}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  isActive
                    ? isDark
                      ? "bg-slate-800 text-white"
                      : "bg-brand-50 text-brand-800"
                    : isDark
                      ? "text-slate-300 hover:bg-slate-800/80"
                      : "text-slate-600 hover:bg-slate-50",
                ].join(" ")
              }
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <NavLink
          to={routes.knowledgeBase}
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-2xl px-3 py-[5px] text-xs font-semibold transition",
              isActive
                ? isDark
                  ? "bg-slate-800 text-white"
                  : "bg-brand-50 text-brand-800"
                : isDark
                  ? "text-slate-300 hover:bg-slate-800/80"
                  : "text-slate-600 hover:bg-slate-50",
            ].join(" ")
          }
        >
          <Info className="h-4 w-4 shrink-0 opacity-90" />
          {t("navigation:sidebar.knowledgeBase")}
        </NavLink>
      </div>

      <div
        className={[
          "mt-auto border-t px-4 py-4",
          isDark ? "border-slate-800" : "border-slate-200",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => navigate(routes.myProfile)}
          className={[
            "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition",
            isDark
              ? "text-slate-200 hover:bg-slate-800"
              : "text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold",
              isDark ? "bg-slate-800 text-slate-100" : "bg-brand-100 text-brand-800",
            ].join(" ")}
          >
            {getInitials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{user?.name ?? "—"}</div>
            <div
              className={[
                "truncate text-xs",
                isDark ? "text-slate-400" : "text-slate-500",
              ].join(" ")}
            >
              {user?.role ? t(`navigation:role.${user.role}`) : ""}
            </div>
          </div>
          <UserCircle2 className="h-5 w-5 shrink-0 opacity-70" />
        </button>
      </div>
    </aside>
  );
}
