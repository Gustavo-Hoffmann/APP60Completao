import { Link } from "react-router-dom";
import { AppHeader } from "../../../components/layout/AppHeader";
import { routes } from "../../../navigation/routes";

const tests = [
  {
    name: "2MST",
    description: "Marcha estacionária de 2 minutos",
    path: routes.test2mst,
  },
  {
    name: "SL-30s",
    description: "Sentar e levantar em 30 segundos",
    path: "#",
  },
  {
    name: "TUG",
    description: "Timed Up and Go",
    path: "#",
  },
  {
    name: "LOS",
    description: "Limite de estabilidade",
    path: "#",
  },
];

export function TestsHubPage() {
  return (
    <div>
      <AppHeader
        title="Testes"
        subtitle="Selecione um módulo de teste."
      />

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 xl:grid-cols-3">
        {tests.map((test) => (
          <div
            key={test.name}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft"
          >
            <h2 className="text-lg font-bold text-slate-900">{test.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{test.description}</p>

            {test.path === "#" ? (
              <span className="mt-4 inline-block text-sm font-medium text-slate-400">
                Em desenvolvimento
              </span>
            ) : (
              <Link
                to={test.path}
                className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Abrir módulo
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}