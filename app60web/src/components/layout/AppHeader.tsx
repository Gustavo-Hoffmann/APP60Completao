import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { routes } from "../../navigation/routes";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { Input } from "../ui/Input";

type Props = {
  title: string;
  subtitle?: string;
};

export function AppHeader({ title, subtitle }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const { t } = useTranslation(["common"]);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDark(root.classList.contains("dark"));

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  async function handleLogout() {
    await logout();
    navigate(routes.login, { replace: true });
  }

  function handleToggleTheme() {
    const root = document.documentElement;
    const nextIsDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextIsDark);
    localStorage.setItem("app60-theme", nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
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
            <Input placeholder={t("common:searchPlaceholder")} className="w-72 pl-10" />
          </div>
          <LanguageSwitcher compact />

          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
            title={isDark ? "Modo claro" : "Modo noturno"}
            className={[
              "rounded-xl border p-2.5 transition",
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            ].join(" ")}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

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
            {t("common:actions.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}