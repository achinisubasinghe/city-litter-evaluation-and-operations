import type { Id } from "../../../convex/_generated/dataModel";
import { WORKER_PRESETS, type WorkerPreset } from "../constants/zones";
import { useLanguage } from "../i18n/LanguageContext";
import { formatReportTimestamp } from "../i18n/translations";
import type {
  AssignQueueFilter,
  LightboxModalData,
  ReportItem,
} from "../types/reports";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CloseIcon,
  PinIcon,
  TruckIcon,
} from "./Icons";

interface DispatchQueueProps {
  reports: ReportItem[] | undefined;
  queueReports: ReportItem[];
  pendingCount: number;
  inProgressCount: number;
  assignQueueFilter: AssignQueueFilter;
  onFilterChange: (next: AssignQueueFilter) => void;
  highlightedReportId: Id<"reports"> | null;
  selectedWorkerByReport: Record<string, string>;
  onSelectWorker: (reportId: string, workerId: string) => void;
  customWorkerIdByReport: Record<string, string>;
  onCustomIdChange: (reportId: string, val: string) => void;
  customWorkerNameByReport: Record<string, string>;
  onCustomNameChange: (reportId: string, val: string) => void;
  assigningReportId: Id<"reports"> | null;
  assignBanner: { type: "success" | "error"; message: string } | null;
  onDismissBanner: () => void;
  onAssign: (reportId: Id<"reports">, defaultWorkerId?: string) => void;
  onOpenModal: (data: LightboxModalData) => void;
  onBackToOverview: () => void;
}

export function DispatchQueue({
  reports,
  queueReports,
  pendingCount,
  inProgressCount,
  assignQueueFilter,
  onFilterChange,
  highlightedReportId,
  selectedWorkerByReport,
  onSelectWorker,
  customWorkerIdByReport,
  onCustomIdChange,
  customWorkerNameByReport,
  onCustomNameChange,
  assigningReportId,
  assignBanner,
  onDismissBanner,
  onAssign,
  onOpenModal,
  onBackToOverview,
}: DispatchQueueProps) {
  const { lang, t } = useLanguage();

  const formatPresetLabel = (preset: WorkerPreset) => {
    const unitLabel = t.workerPresetUnitLabel[preset.id] ?? preset.unitCode;
    return `${preset.plate} • ${unitLabel}`;
  };

  const queueTabs = [
    { key: "pending" as const, label: t.assignTabPending, count: pendingCount },
    {
      key: "in_progress" as const,
      label: t.assignTabInProgress,
      count: inProgressCount,
    },
    {
      key: "active" as const,
      label: t.assignTabActive,
      count: pendingCount + inProgressCount,
    },
  ];

  return (
    <section className="space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="surface-panel rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onBackToOverview}
            className="focus-ring inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#34c397] transition-colors cursor-pointer rounded mb-1"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>{t.backToOverview}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#22a07b]/12 border border-[#22a07b]/30 text-[#34c397] flex items-center justify-center shrink-0">
              <TruckIcon className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-white">
              {t.assignTitle}
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-[65ch] text-pretty">
            {t.assignSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#0a1017] p-1 rounded-xl border border-slate-800/90 self-start lg:self-center">
          {queueTabs.map((tab) => {
            const isActive = assignQueueFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onFilterChange(tab.key)}
                className={`focus-ring px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#1a2634] text-white border border-slate-700/80 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#080d12]/80 text-[11px] font-mono tabular-nums text-slate-300">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {assignBanner && (
        <div
          role={assignBanner.type === "error" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-xs font-medium flex items-center justify-between gap-3 border ${
            assignBanner.type === "success"
              ? "bg-[#0d1f19] border-[#22a07b]/35 text-[#6ee7b7]"
              : "bg-[#221015] border-rose-500/35 text-rose-200"
          }`}
        >
          <span>{assignBanner.message}</span>
          <button
            type="button"
            onClick={onDismissBanner}
            aria-label={t.modalClose}
            className="focus-ring text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Queue List */}
      {reports === undefined ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 surface-panel rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : queueReports.length === 0 ? (
        <div className="text-center py-16 px-6 surface-panel rounded-2xl border-dashed">
          <p className="text-base font-medium text-slate-200">
            {t.assignEmptyTitle}
          </p>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto text-pretty">
            {t.assignEmptyDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {queueReports.map((report) => {
            const selectedChoice =
              selectedWorkerByReport[report._id] ??
              (report.assignedWorkerId &&
              WORKER_PRESETS.some((w) => w.id === report.assignedWorkerId)
                ? report.assignedWorkerId
                : WORKER_PRESETS[0].id);
            const isCustom = selectedChoice === "custom";
            const isHighlighted = highlightedReportId === report._id;
            const isAssigning = assigningReportId === report._id;
            const dateStr = formatReportTimestamp(report.createdAt, lang);

            return (
              <article
                key={report._id}
                className={`surface-panel rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between transition-all duration-200 ${
                  isHighlighted
                    ? "border-[#22a07b]/70 ring-1 ring-[#22a07b]/30"
                    : "hover:border-slate-600/75"
                }`}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <button
                    type="button"
                    className="focus-ring w-24 h-20 rounded-xl bg-[#060a0e] overflow-hidden shrink-0 border border-slate-800 cursor-pointer group"
                    onClick={() =>
                      report.imageUrl &&
                      onOpenModal({
                        url: report.imageUrl,
                        title: t.modalReportedTitle,
                        meta: `${t.modalCoordinatesPrefix}: ${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`,
                      })
                    }
                  >
                    {report.imageUrl ? (
                      <img
                        src={report.imageUrl}
                        alt={report.caption || t.modalIncidentAlt}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-500">
                        {t.noPhotoShort}
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          report.status === "pending"
                            ? "bg-[#1b160d] text-amber-200 border-amber-500/30"
                            : "bg-[#0d1822] text-sky-200 border-sky-500/30"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            report.status === "pending" ? "bg-amber-400" : "bg-sky-400"
                          }`}
                          aria-hidden="true"
                        />
                        {report.status === "pending"
                          ? t.statusPending
                          : t.statusInField}
                      </span>
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        #{report._id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        • {dateStr}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-100 truncate">
                      {report.caption || t.assignDefaultCaption}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 text-[#34c397] font-mono tabular-nums">
                        <PinIcon className="w-3.5 h-3.5" />
                        {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                      </span>
                      {report.assignedWorkerName && (
                        <span className="text-sky-200">
                          {t.assignAssignedPrefix}:{" "}
                          <strong className="font-medium">
                            {report.assignedWorkerName}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Worker Assignment Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:w-[470px] shrink-0">
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <select
                        aria-label={`${t.assignSelectUnitAria} #${report._id.slice(0, 8)}`}
                        value={selectedChoice}
                        onChange={(e) => onSelectWorker(report._id, e.target.value)}
                        className="focus-ring w-full appearance-none surface-inset rounded-xl pl-3 pr-9 py-2.5 text-xs text-slate-100 cursor-pointer"
                      >
                        {WORKER_PRESETS.map((worker) => (
                          <option
                            key={worker.id}
                            value={worker.id}
                            className="bg-[#0f161e]"
                          >
                            {formatPresetLabel(worker)}
                          </option>
                        ))}
                        <option value="custom" className="bg-[#0f161e]">
                          {t.assignCustomOption}
                        </option>
                      </select>
                      <ChevronDownIcon className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {isCustom && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder={t.assignCustomIdPlaceholder}
                          value={customWorkerIdByReport[report._id] ?? ""}
                          onChange={(e) =>
                            onCustomIdChange(report._id, e.target.value)
                          }
                          className="focus-ring surface-inset rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500"
                        />
                        <input
                          type="text"
                          placeholder={t.assignCustomNamePlaceholder}
                          value={customWorkerNameByReport[report._id] ?? ""}
                          onChange={(e) =>
                            onCustomNameChange(report._id, e.target.value)
                          }
                          className="focus-ring surface-inset rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isAssigning}
                    onClick={() => onAssign(report._id, report.assignedWorkerId)}
                    className="focus-ring px-4 py-2.5 rounded-xl text-xs font-medium bg-[#22a07b] hover:bg-[#1d8e6d] disabled:opacity-50 text-white transition-all duration-150 active:scale-[0.98] shrink-0 cursor-pointer"
                  >
                    {isAssigning
                      ? t.assignButtonBusy
                      : report.status === "in_progress"
                      ? t.assignButtonReassign
                      : t.assignButtonAssign}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
