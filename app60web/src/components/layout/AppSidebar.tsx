import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  UserCircle2,
  Users,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { routes } from "../../navigation/routes";
import { useAuth } from "../../contexts/AuthContext";
import { ROLE_LABEL } from "../../lib/auth/roles";
import type { Role } from "../../types/auth";

type SidebarItem = {
  to: string;
  label: string;
  icon: typeof Activity;
  roles: Role[];
};

type Props = {
  isDark: boolean;
  onToggleTheme: () => void;
};

const items: SidebarItem[] = [
  {
    to: routes.dashboard,
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "PROFESSOR", "ALUNO"],
  },
  {
    to: routes.users,
    label: "Usuários",
    icon: Users,
    roles: ["ADMIN", "PROFESSOR"],
  },
  {
    to: routes.participants,
    label: "Participantes",
    icon: Users,
    roles: ["ADMIN", "PROFESSOR", "ALUNO"],
  },
  {
    to: routes.questionnaires,
    label: "Questionários",
    icon: ClipboardList,
    roles: ["ADMIN", "PROFESSOR", "ALUNO"],
  },
  {
    to: routes.tests,
    label: "Testes",
    icon: Activity,
    roles: ["ADMIN", "PROFESSOR", "ALUNO"],
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

export function AppSidebar({ isDark, onToggleTheme }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const visibleItems = items.filter((item) => {
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside
      className={[
        "hidden w-72 shrink-0 border-r lg:flex lg:flex-col",
        isDark
          ? "border-slate-800 bg-slate-900"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-3 text-white shadow-lg shadow-blue-200">
          <Activity size={24} />
        </div>
        <div>
          <div className={["text-lg font-bold", isDark ? "text-white" : "text-slate-900"].join(" ")}>
            App60 Web
          </div>
          <div className={["text-xs", isDark ? "text-slate-400" : "text-slate-500"].join(" ")}>
            Painel de gestão
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : isDark
                    ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              ].join(" ")
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div
        className={[
          "border-t px-4 py-4",
          isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => navigate(routes.myProfile)}
          className={[
            "mb-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
            isDark
              ? "border-slate-700 bg-slate-900 hover:border-blue-500 hover:bg-slate-800"
              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-11 w-11 items-center justify-center rounded-full font-bold",
              isDark ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-700",
            ].join(" ")}
          >
            {getInitials(user?.name)}
          </div>

          <div className="min-w-0 flex-1">
            <p className={["truncate text-sm font-bold", isDark ? "text-white" : "text-slate-800"].join(" ")}>
              {user?.name ?? "-"}
            </p>
            <p className={["text-xs", isDark ? "text-slate-400" : "text-slate-500"].join(" ")}>
              {user ? ROLE_LABEL[user.role] : "-"}
            </p>
          </div>

          <UserCircle2 size={18} className={isDark ? "text-slate-500" : "text-slate-400"} />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className={[
            "mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
            isDark
              ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
          ].join(" ")}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {isDark ? "Modo claro" : "Modo noturno"}
        </button>

        <button
          type="button"
          onClick={() => navigate(routes.myProfile)}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
            isDark
              ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100",
          ].join(" ")}
        >
          <Settings size={16} />
          Editar meu perfil
        </button>
      </div>
    </aside>
  );
}