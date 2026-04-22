import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { UsersPage } from "../features/users/pages/UsersPage";
import { UserCreatePage } from "../features/users/pages/UserCreatePage";
import { UserEditPage } from "../features/users/pages/UserEditPage";
import { InstitutionsPage } from "../features/institutions/pages/InstitutionsPage";
import { InstitutionCreatePage } from "../features/institutions/pages/InstitutionCreatePage";
import { InstitutionEditPage } from "../features/institutions/pages/InstitutionEditPage";
import { ParticipantsPage } from "../features/participants/pages/ParticipantsPage";
import { ParticipantDetailPage } from "../features/participants/pages/ParticipantDetailPage";
import { QuestionnairesPage } from "../features/questionnaires/pages/QuestionnairesPage";
import { TestsHubPage } from "../features/tests/pages/TestsHubPage";
import { KnowledgeBasePage } from "../features/knowledge-base/pages/KnowledgeBasePage";
import { Test2MSTPage } from "../features/tests/marcha-estacionaria/pages/Test2MSTPage";
import { TestSL30sPage } from "../features/tests/sentar-levantar/pages/TestSL30sPage";
import { TestTUGPage } from "../features/tests/tug/pages/TestTUGPage";
import { TestUTTPage } from "../features/tests/utt/pages/TestUTTPage";
import { TestLOSPage } from "../features/tests/los/pages/TestLOSPage";
import { MyInstitutionPage } from "../features/my-institution/pages/MyInstitutionPage";
import { routes } from "../navigation/routes";
import { useAuth } from "../contexts/AuthContext";
import type { Role } from "../types/auth";
import { useTranslation } from "react-i18next";

function FullPageLoader() {
  const { t } = useTranslation("navigation");
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
        {t("loader")}
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

const STAFF_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];

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
            element: <RequireRole allowedRoles={["SUPER_ADMIN", "ADMIN"]} />,
            children: [
              { path: routes.users.slice(1), element: <UsersPage /> },
              { path: routes.userCreate.slice(1), element: <UserCreatePage /> },
              { path: "users/:id/edit", element: <UserEditPage /> },
              { path: routes.institutions.slice(1), element: <InstitutionsPage /> },
              { path: routes.institutionCreate.slice(1), element: <InstitutionCreatePage /> },
              { path: "institutions/:id/edit", element: <InstitutionEditPage /> },
            ],
          },

          { path: routes.knowledgeBase.slice(1), element: <KnowledgeBasePage /> },
          { path: routes.myProfile.slice(1), element: <UserEditPage /> },
          {
            element: <RequireRole allowedRoles={["GESTOR"]} />,
            children: [
              { path: routes.myInstitution.slice(1), element: <MyInstitutionPage /> },
              { path: routes.myInstitutionUserCreate.slice(1), element: <UserCreatePage /> },
              { path: "my-institution/users/:id/edit", element: <UserEditPage /> },
            ],
          },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: routes.participants.slice(1), element: <ParticipantsPage /> }],
          },
          { path: "participants/:id", element: <ParticipantDetailPage /> },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: routes.questionnaires.slice(1), element: <QuestionnairesPage /> }],
          },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: routes.tests.slice(1), element: <TestsHubPage /> }],
          },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: "tests/2mst", element: <Test2MSTPage /> }],
          },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: "tests/sl30s", element: <TestSL30sPage /> }],
          },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: "tests/tug", element: <TestTUGPage /> }],
          },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: "tests/utt", element: <TestUTTPage /> }],
          },
          {
            element: <RequireRole allowedRoles={STAFF_ROLES} />,
            children: [{ path: "tests/los", element: <TestLOSPage /> }],
          },
        ],
      },
    ],
  },
]);
