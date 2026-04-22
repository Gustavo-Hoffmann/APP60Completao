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
  /** Preenchido para AVALIADOR quando existe vínculo em supervision_edges. */
  supervisor_id?: string | null;
};

type ParticipantRow = {
  id: string;
  full_name: string;
};

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
  size,
  icon: Icon,
  filled,
  onClick,
  ariaLabel,
}: {
  size: "lg" | "md" | "sm";
  icon: LucideIcon;
  filled: boolean;
  onClick?: () => void;
  ariaLabel: string;
}) {
  const dim = size === "lg" ? "h-[5.5rem] w-[5.5rem]" : size === "md" ? "h-20 w-20" : "h-14 w-14";
  const iconSz = size === "lg" ? 34 : size === "md" ? 28 : 22;

  const shell = `${dim} flex shrink-0 items-center justify-center rounded-full shadow-[0_10px_28px_rgba(0,75,135,0.22)] ring-4 ring-white/70 dark:ring-slate-900/60`;

  if (!filled) {
    return (
      <div
        className={`${shell} border-2 border-dashed border-slate-300 bg-white text-slate-300 dark:border-slate-600 dark:bg-slate-950`}
        aria-hidden
      >
        <Icon size={iconSz} strokeWidth={1.75} />
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
      <Icon size={iconSz} strokeWidth={1.75} />
    </button>
  );
}

function ParticipantPill({
  participant,
  onOpen,
  emptyLabel,
}: {
  participant: ParticipantRow | null;
  onOpen: () => void;
  emptyLabel: string;
}) {
  if (!participant) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-400">
        {emptyLabel}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-900 shadow-sm transition hover:border-blue-400 dark:border-slate-700 dark:bg-black dark:text-white dark:hover:border-blue-500"
    >
      {participant.full_name}
    </button>
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
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [usersRes, partRes] = await Promise.all([
          apiJson<UserRow[]>("/api/users"),
          apiJson<{ participants?: ParticipantRow[] }>("/api/participants").catch(() => ({ participants: [] })),
        ]);
        setUsers(usersRes ?? []);
        setParticipants(sortByName(partRes.participants ?? []));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : t("myInstitution.loadError"));
        setUsers([]);
        setParticipants([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [t]);

  const tree = useMemo(() => {
    const filtered = (users ?? []).filter((u) => u.role !== "SUPER_ADMIN" && u.role !== "ADMIN");
    const gestores = sortByName(filtered.filter((u) => u.role === "GESTOR"));
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

    if (supervisores.length === 0) {
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
      const w = Math.max(220, c.slotCount * 104);
      colWidths.push(w);
      columnCenters.push(x + w / 2);
      x += w;
      if (i < columns.length - 1) x += gapPx;
    });
    /** Largura real da faixa de colunas (sem “esticar” artificialmente), para o centro bater com o SVG. */
    const gridWidth = x > 0 ? x : 320;

    const participantPairs: [ParticipantRow | null, ParticipantRow | null][][] = columns.map(() => []);
    let pi = 0;
    for (let c = 0; c < columns.length; c++) {
      for (let i = 0; i < columns[c].slotCount; i++) {
        participantPairs[c].push([participants[pi] ?? null, participants[pi + 1] ?? null]);
        pi += 2;
      }
    }

    const gestorBandMin = Math.max(320, gestores.length * 200);
    const canvasWidth = Math.max(gridWidth, gestorBandMin);

    const offsetX = (canvasWidth - gridWidth) / 2;
    const centersOnCanvas = columnCenters.map((xc) => xc + offsetX);

    return {
      gestores,
      columns,
      colWidths,
      participantPairs,
      gridWidth,
      canvasWidth,
      centersOnCanvas,
    };
  }, [users, participants]);

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
                {/* Gestor(es) — quantidade conforme cadastro */}
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
                        <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-gradient-to-br from-[#004B87] to-[#008BB0] text-white shadow-[0_12px_32px_rgba(0,75,135,0.28)] ring-4 ring-white/80 dark:ring-slate-900/70">
                          <UserRound size={36} strokeWidth={1.75} />
                        </div>
                        <div className="mt-3 max-w-[220px] text-center">
                          <div className="text-sm font-extrabold uppercase tracking-wide text-[#004B87] dark:text-[#5ec8e8]">
                            {roleLabel("GESTOR")}
                          </div>
                          <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                            {g.full_name}
                          </div>
                          <div className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                            {g.email}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {tree.columns.length > 0 && (
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
                            size="md"
                            icon={Users}
                            filled={!!sup}
                            ariaLabel={
                              sup
                                ? t("myInstitution.openSupervisor", { name: sup.full_name })
                                : t("myInstitution.vacantSupervisor")
                            }
                            onClick={
                              sup ? () => navigate(routes.myInstitutionUserEdit(sup.id)) : undefined
                            }
                          />
                          <div className="mt-2 px-1">
                            <div className="text-xs font-extrabold uppercase tracking-wide text-[#004B87] dark:text-[#5ec8e8]">
                              {roleLabel("SUPERVISOR")}
                            </div>
                            {sup ? (
                              <>
                                <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                                  {sup.full_name}
                                  {!sup.is_active ? ` • ${t("myInstitution.inactive")}` : ""}
                                </div>
                                <div className="mt-1 break-all text-[11px] text-slate-600 dark:text-slate-400">
                                  {sup.email}
                                </div>
                              </>
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
                            const [p0, p1] = tree.participantPairs[colIdx][evIdx] ?? [null, null];
                            return (
                              <div
                                key={evaluator?.id ?? `slot-${colIdx}-${evIdx}`}
                                className="flex min-w-0 flex-col items-center"
                              >
                                <TreeCircle
                                  size="sm"
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
                                <div className="mt-2 w-full px-0.5 text-center">
                                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-[#004B87] dark:text-[#5ec8e8]">
                                    {evaluator ? roleLabel(evaluator.role) : roleLabel("AVALIADOR")}
                                  </div>
                                  <div className="mt-1 text-xs font-bold leading-snug text-slate-900 dark:text-white">
                                    {evaluator?.full_name ?? "—"}
                                  </div>
                                  {evaluator ? (
                                    <div className="mt-1 truncate text-[10px] text-slate-600 dark:text-slate-400">
                                      {evaluator.email}
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                      {t("myInstitution.emptySlot")}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 flex w-full flex-col gap-2">
                                  <ParticipantPill
                                    participant={p0}
                                    onOpen={() => p0 && navigate(routes.participantDetail(p0.id))}
                                    emptyLabel={t("myInstitution.emptySlot")}
                                  />
                                  <ParticipantPill
                                    participant={p1}
                                    onOpen={() => p1 && navigate(routes.participantDetail(p1.id))}
                                    emptyLabel={t("myInstitution.emptySlot")}
                                  />
                                </div>
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
