import { Bell, LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { routes } from "../../navigation/routes";
import { Input } from "../ui/Input";

type Props = {
  title: string;
  subtitle?: string;
};

export function AppHeader({ title, subtitle }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  async function handleLogout() {
    await logout();
    navigate(routes.login, { replace: true });
  }

  return (
    <header
      className={[
        "sticky top-0 z-10 border-b backdrop-blur",
        isDark
          ? "border-slate-800 bg-slate-900/90"
          : "border-slate-200 bg-white/90",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className={["text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900"].join(" ")}>
            {title}
          </h1>
          {subtitle ? (
            <p className={["mt-1 text-sm", isDark ? "text-slate-400" : "text-slate-500"].join(" ")}>
              {subtitle}
            </p>
          ) : null}
          {user ? (
            <p className={["mt-1 text-xs", isDark ? "text-slate-500" : "text-slate-400"].join(" ")}>
              {user.name} • {user.role}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <Input placeholder="Buscar..." className="w-72 pl-10" />
          </div>

          <button
            type="button"
            className={[
              "rounded-xl border p-2.5 transition",
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            ].join(" ")}
          >
            <Bell size={18} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className={[
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            ].join(" ")}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}