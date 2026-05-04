import { ChevronDown, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { apiJson } from "../../lib/api/client";
import { triggerBrowserDownload } from "../../lib/export/download";
import { exportElementToPdf } from "../../lib/export/pdf";

type RawExportTestType = "MARCHA" | "SL30S";

type SessionOption = {
  sessao: number;
  date?: string;
};

function safeFilePart(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function sessionRangeLabel(range: { from: number | null; to: number | null }) {
  if (range.from == null || range.to == null) return "all";
  const r = range.from <= range.to ? range : { from: range.to, to: range.from };
  return `S${r.from}-S${r.to}`;
}

export function TestExportActions({
  participantId,
  participantName,
  testLabelForFile,
  rawTestType,
  sessions,
  defaultSessionNumber,
  metricRange,
  exportRef,
}: {
  participantId: string;
  participantName: string;
  testLabelForFile: string; // ex.: "2MST" / "SL30S"
  rawTestType: RawExportTestType;
  sessions: SessionOption[];
  defaultSessionNumber: number;
  metricRange: { from: number | null; to: number | null };
  exportRef: React.RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("modules");

  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawModalSessionNumber, setRawModalSessionNumber] = useState<number>(defaultSessionNumber || 1);
  const [downloadingRaw, setDownloadingRaw] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function downloadRawCsv() {
    try {
      setDownloadingRaw(true);
      const data = await apiJson<{ url: string }>(
        `/api/collections/raw-url/${encodeURIComponent(participantId)}/${encodeURIComponent(rawTestType)}/${rawModalSessionNumber}`,
      );
      if (data?.url) triggerBrowserDownload(data.url);
      setRawModalOpen(false);
    } finally {
      setDownloadingRaw(false);
    }
  }

  async function downloadPdf() {
    const el = exportRef.current;
    if (!el) return;
    try {
      setExportingPdf(true);
      const name = safeFilePart(participantName || participantId);
      const range = sessionRangeLabel(metricRange);
      const filename = `${name}-${testLabelForFile}-${range}`;
      await exportElementToPdf({ element: el, filename, logoUrl: "/logo-seniorsense.png" });
    } finally {
      setExportingPdf(false);
    }
  }

  if (!sessions.length) return null;

  return (
    <>
      {rawModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <Card className="w-full max-w-lg p-6 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">{t("participantDetail.exports.rawModalTitle")}</p>
            <p className="mt-2 text-sm text-slate-600">{t("participantDetail.exports.rawModalBody")}</p>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("participantDetail.exports.rawModalSessionLabel")}
              </label>
              <div className="relative">
                <select
                  value={rawModalSessionNumber}
                  onChange={(e) => setRawModalSessionNumber(Number(e.target.value))}
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={downloadingRaw}
                >
                  {sessions.map((s) => (
                    <option key={s.sessao} value={s.sessao}>
                      {t("participantDetail.sessionDotDate", { session: s.sessao, date: s.date ?? "—" })}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setRawModalOpen(false)} disabled={downloadingRaw}>
                {t("participantDetail.exports.rawModalCancel")}
              </Button>
              <Button type="button" onClick={() => void downloadRawCsv()} disabled={downloadingRaw}>
                <span className="inline-flex items-center gap-2">
                  <Download size={16} />
                  {downloadingRaw
                    ? t("participantDetail.exports.downloading")
                    : t("participantDetail.exports.rawModalDownload")}
                </span>
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <section
        data-export="exclude"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"
      >
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setRawModalSessionNumber(defaultSessionNumber || sessions[sessions.length - 1]?.sessao || 1);
            setRawModalOpen(true);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Download size={16} />
            {t("participantDetail.exports.rawButton")}
          </span>
        </Button>
        <Button type="button" onClick={() => void downloadPdf()} disabled={exportingPdf}>
          <span className="inline-flex items-center gap-2">
            <Download size={16} />
            {exportingPdf ? t("participantDetail.exports.exportingPdf") : t("participantDetail.exports.pdfButton")}
          </span>
        </Button>
      </section>
    </>
  );
}

