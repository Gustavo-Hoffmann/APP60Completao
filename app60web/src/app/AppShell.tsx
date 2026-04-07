import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppSidebar } from "../components/layout/AppSidebar";

export function AppShell() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("app60-theme");
    const nextIsDark = saved === "dark";
    setIsDark(nextIsDark);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains("dark"));

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("app60-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <div
      className={[
        "flex min-h-screen transition-colors",
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900",
      ].join(" ")}
    >
      <AppSidebar isDark={isDark} />

      <main className="app-content flex-1">
        <Outlet context={{ isDark }} />
      </main>
    </div>
  );
}