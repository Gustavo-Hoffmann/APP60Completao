import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader } from "../../../components/layout/AppHeader";
import { routes } from "../../../navigation/routes";

const tests = [
  {
    name: "2MST",
    descriptionKey: "2mst",
    path: routes.test2mst,
  },
  {
    name: "SL-30s",
    descriptionKey: "sl30s",
    path: routes.testSl30s,
  },
  {
    name: "TUG",
    descriptionKey: "tug",
    path: routes.testTug,
  },
  {
    name: "LOS",
    descriptionKey: "los",
    path: routes.testLos,
  },
  {
    name: "UTT",
    descriptionKey: "utt",
    path: routes.testUtt,
  },
];

export function TestsHubPage() {
  const { t } = useTranslation("modules");
  return (
    <div>
      <AppHeader
        title={t("testsHub.title")}
        subtitle={t("testsHub.subtitle")}
      />

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 xl:grid-cols-3">
        {tests.map((test) => (
          <div
            key={test.name}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft"
          >
            <h2 className="text-lg font-bold text-slate-900">{test.name}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {t(`testsHub.items.${test.descriptionKey}`)}
            </p>

            <Link
              to={test.path}
              className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              {t("testsHub.openModule")}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}