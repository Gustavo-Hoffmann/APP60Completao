import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  Plus,
  RotateCcw,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AppHeader } from "../../../components/layout/AppHeader";
import { apiJson } from "../../../lib/api/client";
import { routes } from "../../../navigation/routes";
import { useAuth } from "../../../contexts/AuthContext";
import type { Role } from "../../../types/auth";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at?: string | null;
  created_by_id?: string | null;
  /** Preenchido para AVALIADOR quando existe vínculo em supervision_edges. */
  supervisor_id?: string | null;
};

type OrgMetrics = Record<string, { enrollments: number; collections: number }>;

function roleLabel(role: Role) {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "ADMIN") return "Administrador";
  if (role === "GESTOR") return "Gestor";
  if (role === "SUPERVISOR") return "Supervisor";
  if (role === "AVALIADOR") return "Avaliador";
  return role;
}

function sortByName<T extends { full_name: string }>(arr: T[]) {
  return [...arr].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}

const LINE = "stroke-slate-400 dark:stroke-slate-500";
const LINE_FILL = "fill-slate-400 dark:fill-slate-500";

function SvgDefs({ markerId }: { markerId: string }) {
  return (
    <defs>
      <marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <polygon points="0 0, 7 3.5, 0 7" className={LINE_FILL} />
      </marker>
    </defs>
  );
}

/** Ramificação ortogonal supervisor → N avaliadores (N ≥ 1). */
function EvalForkSvg({ n, arrowId, width }: { n: number; arrowId: string; width: number }) {
  const safeN = Math.max(1, n);
  const bw = Math.max(width, 120);
  const ys = 22;
  const ye = 64;
  const cx = bw / 2;
  const xs = Array.from({ length: safeN }, (_, i) => (bw * (i + 1)) / (safeN + 1));
  const xMin = Math.min(cx, ...xs);
  const xMax = Math.max(cx, ...xs);

  return (
    <svg className="mt-3 w-full" height={64} viewBox={`0 0 ${bw} 64`} preserveAspectRatio="none" aria-hidden>
      <path
        d={`M ${cx} 0 L ${cx} ${ys} L ${xMin} ${ys} L ${xMax} ${ys}`}
        fill="none"
        className={LINE}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {xs.map((xi, idx) => (
        <path
          key={idx}
          d={`M ${xi} ${ys} L ${xi} ${ye}`}
          fill="none"
          className={LINE}
          strokeWidth="1.25"
          strokeLinejoin="round"
          markerEnd={`url(#${arrowId})`}
        />
      ))}
    </svg>
  );
}

/** Gestor(is) → supervisores: 1 coluna = linha reta; 2+ = ramos curvos. */
function GestorForkSvg({
  width,
  centers,
  arrowId,
}: {
  width: number;
  centers: number[];
  arrowId: string;
}) {
  const h = 80;
  const ys = 28;
  const ye = 78;
  const cx = width / 2;

  if (centers.length === 0) return null;

  /** Um supervisor (ou coluna única): linha vertical reta no centro da coluna. */
  if (centers.length === 1) {
    const x0 = centers[0];
    return (
      <svg className="mx-auto mt-2 block" width={width} height={h} viewBox={`0 0 ${width} ${h}`} aria-hidden>
        <SvgDefs markerId={arrowId} />
        <path
          d={`M ${x0} 0 L ${x0} ${ye}`}
          fill="none"
          className={LINE}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#${arrowId})`}
        />
      </svg>
    );
  }

  /** Dois ou mais: tronco curvo + curvas suaves até cada coluna. */
  const midY = (ys + ye) / 2;
  return (
    <svg className="mx-auto mt-2 block" width={width} height={h} viewBox={`0 0 ${width} ${h}`} aria-hidden>
      <SvgDefs markerId={arrowId} />
      <path
        d={`M ${cx} 0 Q ${cx} ${ys * 0.72} ${cx} ${ys}`}
        fill="none"
        className={LINE}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {centers.map((xi, idx) => (
        <path
          key={idx}
          d={`M ${cx} ${ys} C ${cx} ${midY}, ${xi} ${midY}, ${xi} ${ye}`}
          fill="none"
          className={LINE}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={`url(#${arrowId})`}
        />
      ))}
    </svg>
  );
}

function TreeCircle({
  icon: Icon,
  filled,
  onClick,
  ariaLabel,
}: {
  icon: LucideIcon;
  filled: boolean;
  onClick?: () => void;
  ariaLabel: string;
}) {
  const shell =
    "flex h-28 w-28 shrink-0 items-center justify-center rounded-full shadow-[0_12px_32px_rgba(0,75,135,0.24)] ring-4 ring-white/80 dark:ring-slate-900/60";

  if (!filled) {
    return (
      <div
        className={`${shell} border-2 border-dashed border-slate-300 bg-white text-slate-300 dark:border-slate-600 dark:bg-slate-950`}
        aria-hidden
      >
        <Icon size={36} strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`${shell} cursor-pointer bg-gradient-to-br from-[#004B87] to-[#008BB0] text-white transition hover:brightness-110 active:brightness-95`}
    >
      <Icon size={36} strokeWidth={1.75} />
    </button>
  );
}

function EvaluatorStats({
  enrollments,
  collections,
  enrollmentsLabel,
  collectionsLabel,
}: {
  enrollments: number;
  collections: number;
  enrollmentsLabel: string;
  collectionsLabel: string;
}) {
  return (
    <div className="mt-3 w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-left shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="font-semibold">{enrollmentsLabel}</span>
        <span className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{enrollments}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="font-semibold">{collectionsLabel}</span>
        <span className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">{collections}</span>
      </div>
    </div>
  );
}

export function MyInstitutionPage() {
  const { t } = useTranslation("modules");
  const navigate = useNavigate();
  const { user } = useAuth();
  const svgUid = useId().replace(/:/g, "");
  const arrowId = `org-arrow-${svgUid}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgMetrics, setOrgMetrics] = useState<OrgMetrics>({});
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [usersRes, metricsRes] = await Promise.all([
          apiJson<UserRow[]>("/api/users"),
          apiJson<{ byUserId?: OrgMetrics }>("/api/users/org-metrics").catch(() => ({ byUserId: {} })),
        ]);
        setUsers(usersRes ?? []);
        setOrgMetrics(metricsRes.byUserId ?? {});
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : t("myInstitution.loadError"));
        setUsers([]);
        setOrgMetrics({});
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [t]);

  const isSupervisorUser = user?.role === "SUPERVISOR";

  const tree = useMemo(() => {
    const filtered = (users ?? []).filter((u) => u.role !== "SUPER_ADMIN" && u.role !== "ADMIN");
    const gestores = isSupervisorUser ? [] : sortByName(filtered.filter((u) => u.role === "GESTOR"));
    const supervisores = sortByName(filtered.filter((u) => u.role === "SUPERVISOR"));
    const avaliadores = sortByName(filtered.filter((u) => u.role === "AVALIADOR"));

    type SupColumn = {
      supervisor: UserRow | null;
      evalSlots: (UserRow | null)[];
      slotCount: number;
    };

    const gapPx = 40;
    const assignedEval = new Set<string>();

    const columns: SupColumn[] = [];

    if (isSupervisorUser && user) {
      const myEvaluators = sortByName(
        avaliadores.filter((evaluator) => evaluator.created_by_id === user.id)
      );
      const selfSupervisor =
        supervisores.find((supervisor) => supervisor.id === user.id) ??
        ({
          id: user.id,
          full_name: user.name,
          email: user.email,
          role: "SUPERVISOR",
          is_active: user.is_active ?? true,
          created_at: null,
        } satisfies UserRow);
      const slotCount = Math.max(1, myEvaluators.length);
      const evalSlots: (UserRow | null)[] = Array.from(
        { length: slotCount },
        (_, index) => myEvaluators[index] ?? null
      );
      columns.push({ supervisor: selfSupervisor, evalSlots, slotCount });
    } else if (supervisores.length === 0) {
      const slotCount = Math.max(1, avaliadores.length);
      const evalSlots: (UserRow | null)[] = Array.from(
        { length: slotCount },
        (_, i) => avaliadores[i] ?? null
      );
      columns.push({ supervisor: null, evalSlots, slotCount });
    } else {
      const colEvals: UserRow[][] = supervisores.map((s) =>
        sortByName(avaliadores.filter((e) => e.supervisor_id === s.id))
      );
      colEvals.forEach((list) => list.forEach((e) => assignedEval.add(e.id)));
      const unassigned = avaliadores.filter((e) => !assignedEval.has(e.id));
      for (let i = 0; i < unassigned.length; i++) {
        colEvals[i % colEvals.length].push(unassigned[i]);
      }
      supervisores.forEach((sup, idx) => {
        const real = sortByName(colEvals[idx]);
        const slotCount = Math.max(1, real.length);
        const evalSlots: (UserRow | null)[] = Array.from({ length: slotCount }, (_, i) => real[i] ?? null);
        columns.push({ supervisor: sup, evalSlots, slotCount });
      });
    }

    let x = 0;
    const colWidths: number[] = [];
    const columnCenters: number[] = [];
    columns.forEach((c, i) => {
      const w = Math.max(240, c.slotCount * 132);
      colWidths.push(w);
      columnCenters.push(x + w / 2);
      x += w;
      if (i < columns.length - 1) x += gapPx;
    });
    /** Largura real da faixa de colunas (sem “esticar” artificialmente), para o centro bater com o SVG. */
    const gridWidth = x > 0 ? x : 320;

    const gestorBandMin = Math.max(320, gestores.length * 200);
    const canvasWidth = Math.max(gridWidth, gestorBandMin);

    const offsetX = (canvasWidth - gridWidth) / 2;
    const centersOnCanvas = columnCenters.map((xc) => xc + offsetX);

    return {
      gestores,
      columns,
      colWidths,
      gridWidth,
      canvasWidth,
      centersOnCanvas,
    };
  }, [users, user, isSupervisorUser]);

  const gestoresDisplay: UserRow[] =
    tree.gestores.length > 0
      ? tree.gestores
      : user?.role === "GESTOR"
        ? [
            {
              id: user.id,
              full_name: user.name,
              email: user.email,
              role: "GESTOR",
              is_active: user.is_active ?? true,
              created_at: null,
            },
          ]
        : [];

  const clampZoom = useCallback((z: number) => Math.min(1.75, Math.max(0.6, z)), []);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(Number((z + 0.1).toFixed(2)))), [clampZoom]);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(Number((z - 0.1).toFixed(2)))), [clampZoom]);
  const zoomReset = useCallback(() => setZoom(1), []);

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-950 dark:bg-black dark:text-white">
      <AppHeader
        title={user?.institution_name ?? t("myInstitution.titleFallback")}
        subtitle={t("myInstitution.subtitle")}
      />

      <main className="space-y-8 px-6 py-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Users size={16} />
            {t("myInstitution.orgChart")}
          </div>

          <button
            type="button"
            onClick={() => navigate(routes.myInstitutionUserCreate)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#004B87] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#003a6a]"
          >
            <Plus size={18} />
            {t("myInstitution.createUser")}
          </button>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-black">
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
              <Loader2 size={18} className="animate-spin" />
              {t("myInstitution.loading")}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/60 dark:bg-red-950/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-red-600" size={18} />
              <div>
                <p className="font-semibold text-red-700">{t("myInstitution.errorTitle")}</p>
                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="sticky top-4 z-10 flex justify-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
                <button
                  type="button"
                  onClick={zoomOut}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-[#008BB0] dark:border-slate-800 dark:bg-black dark:text-white"
                  aria-label={t("myInstitution.zoomOut")}
                >
                  <span className="text-lg font-extrabold leading-none">−</span>
                </button>
                <button
                  type="button"
                  onClick={zoomReset}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-[#008BB0] dark:border-slate-800 dark:bg-black dark:text-white"
                  aria-label={t("myInstitution.zoomReset")}
                >
                  <RotateCcw size={16} className="mr-2" />
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-[#008BB0] dark:border-slate-800 dark:bg-black dark:text-white"
                  aria-label={t("myInstitution.zoomIn")}
                >
                  <span className="text-lg font-extrabold leading-none">+</span>
                </button>
              </div>
            </div>

            <div
              className="mt-4 overflow-auto rounded-3xl border border-slate-200/80 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/40"
              onWheel={(e) => {
                if (!(e.ctrlKey || e.metaKey)) return;
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.06 : 0.06;
                setZoom((z) => clampZoom(Number((z + delta).toFixed(2))));
              }}
            >
              <div
                className="relative mx-auto w-max max-w-none origin-top pb-10"
                style={{ transform: `scale(${zoom})`, minWidth: tree.canvasWidth }}
              >
                {!isSupervisorUser ? (
                  <div
                    className="pointer-events-none mx-auto flex flex-wrap justify-center gap-x-10 gap-y-6 select-none"
                    style={{ width: tree.canvasWidth }}
                  >
                    {gestoresDisplay.length === 0 ? (
                      <div className="max-w-md py-4 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">
                        {t("myInstitution.noManagers")}
                      </div>
                    ) : (
                      gestoresDisplay.map((g) => (
                        <div key={g.id} className="flex flex-col items-center">
                          <TreeCircle icon={UserRound} filled ariaLabel={g.full_name} />
                          <div className="mt-3 max-w-[220px] text-center">
                            <div className="text-sm font-extrabold uppercase tracking-wide text-[#004B87] dark:text-[#5ec8e8]">
                              {roleLabel("GESTOR")}
                            </div>
                            <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                              {g.full_name}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}

                {!isSupervisorUser && tree.columns.length > 0 && (
                  <GestorForkSvg
                    width={tree.canvasWidth}
                    centers={tree.centersOnCanvas}
                    arrowId={arrowId}
                  />
                )}

                <div
                  className="mx-auto flex flex-none flex-row flex-nowrap justify-center overflow-x-auto"
                  style={{ width: tree.gridWidth, gap: 40 }}
                >
                  {tree.columns.map((branch, colIdx) => {
                    const sup = branch.supervisor;
                    const colW = tree.colWidths[colIdx] ?? 280;

                    return (
                      <div
                        key={sup?.id ?? `col-${colIdx}`}
                        className="flex min-w-0 shrink-0 flex-col items-center px-1"
                        style={{ width: colW }}
                      >
                        <div className="flex w-full max-w-[320px] flex-col items-center text-center">
                          <TreeCircle
                            icon={Users}
                            filled={!!sup}
                            ariaLabel={
                              sup
                                ? t("myInstitution.openSupervisor", { name: sup.full_name })
                                : t("myInstitution.vacantSupervisor")
                            }
                            onClick={
                              sup
                                ? () =>
                                    navigate(
                                      isSupervisorUser && sup.id === user?.id
                                        ? routes.myProfile
                                        : routes.myInstitutionUserEdit(sup.id)
                                    )
                                : undefined
                            }
                          />
                          <div className="mt-3 px-1">
                            <div className="text-xs font-extrabold uppercase tracking-wide text-[#004B87] dark:text-[#5ec8e8]">
                              {roleLabel("SUPERVISOR")}
                            </div>
                            {sup ? (
                              <div className="mt-1 text-base font-extrabold leading-snug text-slate-900 dark:text-white">
                                {sup.full_name}
                                {!sup.is_active ? ` • ${t("myInstitution.inactive")}` : ""}
                              </div>
                            ) : (
                              <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {t("myInstitution.emptySlot")}
                              </div>
                            )}
                          </div>
                        </div>

                        <EvalForkSvg n={branch.slotCount} arrowId={arrowId} width={colW} />

                        <div
                          className="grid w-full gap-x-2"
                          style={{
                            gridTemplateColumns: `repeat(${branch.slotCount}, minmax(0, 1fr))`,
                          }}
                        >
                          {branch.evalSlots.map((evaluator, evIdx) => {
                            const metrics = evaluator ? orgMetrics[evaluator.id] : null;
                            return (
                              <div
                                key={evaluator?.id ?? `slot-${colIdx}-${evIdx}`}
                                className="flex min-w-0 flex-col items-center"
                              >
                                <TreeCircle
                                  icon={ClipboardList}
                                  filled={!!evaluator}
                                  ariaLabel={
                                    evaluator
                                      ? t("myInstitution.openEvaluator", { name: evaluator.full_name })
                                      : t("myInstitution.vacantEvaluator")
                                  }
                                  onClick={
                                    evaluator
                                      ? () => navigate(routes.myInstitutionUserEdit(evaluator.id))
                                      : undefined
                                  }
                                />
                                <div className="mt-3 w-full px-1 text-center">
                                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#004B87] dark:text-[#5ec8e8]">
                                    {evaluator ? roleLabel(evaluator.role) : roleLabel("AVALIADOR")}
                                  </div>
                                  <div className="mt-1 text-sm font-bold leading-snug text-slate-900 dark:text-white">
                                    {evaluator?.full_name ?? "—"}
                                  </div>
                                  {!evaluator ? (
                                    <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                      {t("myInstitution.emptySlot")}
                                    </div>
                                  ) : null}
                                </div>

                                {evaluator ? (
                                  <EvaluatorStats
                                    enrollments={metrics?.enrollments ?? 0}
                                    collections={metrics?.collections ?? 0}
                                    enrollmentsLabel={t("myInstitution.enrollments")}
                                    collectionsLabel={t("myInstitution.collections")}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
