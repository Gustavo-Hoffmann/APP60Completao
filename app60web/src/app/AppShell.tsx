import { Outlet } from "react-router-dom";
import { AppSidebar } from "../components/layout/AppSidebar";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AppSidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}