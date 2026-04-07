import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { UsersPage } from "../features/users/pages/UsersPage";
import { UserCreatePage } from "../features/users/pages/UserCreatePage";
import { UserEditPage } from "../features/users/pages/UserEditPage";
import { ParticipantsPage } from "../features/participants/pages/ParticipantsPage";
import { ParticipantDetailPage } from "../features/participants/pages/ParticipantDetailPage";
import { QuestionnairesPage } from "../features/questionnaires/pages/QuestionnairesPage";
import { TestsHubPage } from "../features/tests/pages/TestsHubPage";
import { Test2MSTPage } from "../features/tests/marcha-estacionaria/pages/Test2MSTPage";
import { TestSL30sPage } from "../features/tests/sentar-levantar/pages/TestSL30sPage";
import { TestTUGPage } from "../features/tests/tug/pages/TestTUGPage";
import { TestUTTPage } from "../features/tests/utt/pages/TestUTTPage";
import { TestLOSPage } from "../features/tests/los/pages/TestLOSPage";
import { routes } from "../navigation/routes";
import { useAuth } from "../contexts/AuthContext";
import type { Role } from "../types/auth";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
        Carregando...
      </div>
    </div>
  );
}

function AccessDenied() {
  return <Navigate to={routes.dashboard} replace />;
}

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to={routes.login} replace />;

  return <Outlet />;
}

function PublicOnly() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to={routes.dashboard} replace />;

  return <Outlet />;
}

function RequireRole({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to={routes.login} replace />;
  if (!user || !allowedRoles.includes(user.role)) return <AccessDenied />;

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [{ path: routes.login, element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: routes.dashboard,
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },

          {
            element: <RequireRole allowedRoles={["ADMIN", "PROFESSOR"]} />,
            children: [
              { path: routes.users.slice(1), element: <UsersPage /> },
              { path: routes.userCreate.slice(1), element: <UserCreatePage /> },
              { path: "users/:id/edit", element: <UserEditPage /> },
            ],
          },

          { path: routes.myProfile.slice(1), element: <UserEditPage /> },
          { path: routes.participants.slice(1), element: <ParticipantsPage /> },
          { path: "participants/:id", element: <ParticipantDetailPage /> },
          { path: routes.questionnaires.slice(1), element: <QuestionnairesPage /> },
          { path: routes.tests.slice(1), element: <TestsHubPage /> },
          { path: "tests/2mst", element: <Test2MSTPage /> },
          { path: "tests/sl30s", element: <TestSL30sPage /> },
          { path: "tests/tug", element: <TestTUGPage /> },
          { path: "tests/utt", element: <TestUTTPage /> },
          { path: "tests/los", element: <TestLOSPage /> },
        ],
      },
    ],
  },
]);