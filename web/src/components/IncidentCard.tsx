import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLanguage } from "../i18n/LanguageContext";
import { formatReportTimestamp } from "../i18n/translations";
import type {
  LightboxModalData,
  ReportItem,
  ReportStatus,
} from "../types/reports";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  PinIcon,
  SparkScanIcon,
} from "./Icons";

interface IncidentCardProps {
  report: ReportItem;
  index: number;
  onOpenModal: (data: LightboxModalData) => void;
  onNavigateAssign: (reportId: Id<"reports">) => void;
  onStatusChange: (reportId: Id<"reports">, status: ReportStatus) => void;
}

const STATUS_BADGE_MAP: Record<
  ReportStatus,
  { dot: string; badge: string }
> = {
  pending: {
    dot: "bg-amber-400",
    badge: "bg-[#1b160d]/90 text-amber-200 border-amber-500/35",
  },
  in_progress: {
    dot: "bg-sky-400",
    badge: "bg-[#0d1822]/90 text-sky-200 border-sky-500/35",
  },
  resolved: {
    dot: "bg-[#34c397]",
    badge: "bg-[#0d1f19]/90 text-[#6ee7b7] border-[#22a07b]/40",
  },
  rejected: {
    dot: "bg-rose-400",
    badge: "bg-[#1f1014]/90 text-rose-200 border-rose-500/35",
  },
};

export function IncidentCard({
  report,
  index,
  onOpenModal,
  onNavigateAssign,
  onStatusChange,
}: IncidentCardProps) {
  const { lang, t } = useLanguage();
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  const dateStr = formatReportTimestamp(report.createdAt, lang);
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;
  const confidencePct = report.confidence
    ? (report.confidence * 100).toFixed(0)
    : null;

  const statusLabels: Record<ReportStatus, string> = {
    pending: t.statusPending,
    in_progress: t.statusInField,
    resolved: t.statusCleaned,
    rejected: t.statusRejected,
  };

  const statusStyle = STATUS_BADGE_MAP[report.status];
  const hasTelemetryDetails =
    report.isLocationCorrected &&
    (report.offsetMeters !== undefined ||
      (report.speedKmh !== undefined && report.speedKmh > 0));

  const staggerDelayMs = Math.min(index * 45, 270);

  return (
    <article
      style={{ animationDelay: `${staggerDelayMs}ms` }}
      className="animate-fade-up surface-panel rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:border-slate-600/80"
    >
      {/* Photo Display */}
      <div className="relative aspect-video bg-[#060a0e] overflow-hidden border-b border-slate-800/80">
        {report.status === "resolved" && report.proofImageUrl ? (
          <div className="grid grid-cols-2 w-full h-full">
            <button
              type="button"
              className="focus-ring relative h-full border-r border-slate-800 cursor-pointer group overflow-hidden text-left"
              onClick={() =>
                onOpenModal({
                  url: report.imageUrl || "",
                  title: t.modalBeforeTitle,
                  meta: `${t.modalCoordinatesPrefix}: ${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`,
                })
              }
            >
              {report.imageUrl ? (
                <img
                  src={report.imageUrl}
                  alt={t.modalBeforeAlt}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                  {t.noImage}
                </div>
              )}
              <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#080d12]/85 text-amber-200 backdrop-blur-md border border-amber-500/30">
                {t.beforeLabel}
              </span>
            </button>

            <button
              type="button"
              className="focus-ring relative h-full cursor-pointer group overflow-hidden text-left"
              onClick={() =>
                onOpenModal({
                  url: report.proofImageUrl!,
                  title: t.modalAfterTitle,
                  meta: `${t.modalResolvedByPrefix}: ${report.resolvedBy ?? t.modalFallbackWorker}`,
                })
              }
            >
              <img
                src={report.proofImageUrl}
                alt={t.modalAfterAlt}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#081712]/90 text-[#6ee7b7] backdrop-blur-md border border-[#22a07b]/35">
                {t.afterProofLabel}
              </span>
            </button>
          </div>
        ) : report.imageUrl ? (
          <button
            type="button"
            className="focus-ring w-full h-full cursor-pointer group overflow-hidden block text-left"
            onClick={() =>
              onOpenModal({
                url: report.imageUrl!,
                title: t.modalReportedTitle,
                meta: `${
                  confidencePct ? `${t.modalConfidencePrefix}: ${confidencePct}% • ` : ""
                }${t.modalCoordinatesPrefix}: ${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`,
              })
            }
          >
            <img
              src={report.imageUrl}
              alt={report.caption || t.modalIncidentAlt}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
          </button>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
            {t.noPhotoStored}
          </div>
        )}

        {/* AI Confidence Badge */}
        {confidencePct && report.status !== "resolved" && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#080d12]/85 text-[#6ee7b7] backdrop-blur-md border border-[#22a07b]/35 tabular-nums shadow-sm">
              <SparkScanIcon className="w-3.5 h-3.5 text-[#34c397]" />
              <span>
                {confidencePct}
                {t.confidenceMatchSuffix}
              </span>
            </span>
          </div>
        )}

        {/* Status Pill */}
        <div className="absolute top-3 right-3 pointer-events-none">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium backdrop-blur-md border shadow-sm ${statusStyle.badge}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}
              aria-hidden="true"
            />
            {statusLabels[report.status]}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col">
        {report.caption && (
          <p className="text-sm font-medium text-slate-100 mb-3 text-pretty leading-snug">
            {report.caption}
          </p>
        )}

        {/* Ground Coordinates & Telemetry */}
        <div className="surface-inset rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <PinIcon className="w-3.5 h-3.5 text-[#34c397] shrink-0" />
              <span className="font-medium text-slate-300 truncate">
                {t.gpsLocationLabel}
              </span>
              {report.isLocationCorrected && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#22a07b]/15 text-[#6ee7b7] border border-[#22a07b]/30 shrink-0">
                  {t.imuCorrectedBadge}
                </span>
              )}
            </div>

            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring text-slate-300 hover:text-[#34c397] font-medium inline-flex items-center gap-0.5 shrink-0 transition-colors rounded"
            >
              <span>{t.openMaps}</span>
              <ArrowUpRightIcon className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-xs text-slate-200 tabular-nums">
              {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
            </p>
            {hasTelemetryDetails && (
              <button
                type="button"
                aria-expanded={telemetryOpen}
                onClick={() => setTelemetryOpen((prev) => !prev)}
                className="focus-ring inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer rounded"
              >
                <span>{t.telemetryDetailsToggle}</span>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    telemetryOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          </div>

          {hasTelemetryDetails && telemetryOpen && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-[11px] space-y-1 font-mono tabular-nums">
              {report.offsetMeters !== undefined && (
                <p className="flex justify-between gap-2">
                  <span className="text-slate-400 font-sans">
                    {t.offsetCorrectedLabel}
                  </span>
                  <span className="text-[#34c397]">
                    +{report.offsetMeters.toFixed(1)}m @ {report.heading?.toFixed(0) ?? 0}°
                  </span>
                </p>
              )}
              {report.speedKmh !== undefined && report.speedKmh > 0 && (
                <p className="flex justify-between gap-2">
                  <span className="text-slate-400 font-sans">
                    {t.vehicleSpeedLabel}
                  </span>
                  <span className="text-slate-200">
                    {report.speedKmh.toFixed(1)} km/h
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metadata Rows */}
        <dl className="space-y-1.5 text-xs mb-5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">{t.reportSourceLabel}</dt>
            <dd className="text-slate-200 font-medium truncate">
              {report.userName ? `@${report.userName}` : `ID: ${report.userId}`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">{t.timestampLabel}</dt>
            <dd className="text-slate-300 font-mono text-[11px] tabular-nums">
              {dateStr}
            </dd>
          </div>
          {report.assignedWorkerName && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">{t.assignedWorkerLabel}</dt>
              <dd className="text-sky-200 font-medium bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 truncate max-w-[200px]">
                {report.assignedWorkerName}
              </dd>
            </div>
          )}
          {report.resolvedBy && (
            <div className="pt-2 mt-2 border-t border-slate-800/70 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">{t.cleanedByLabel}</dt>
                <dd className="text-[#6ee7b7] font-medium bg-[#22a07b]/12 px-2 py-0.5 rounded border border-[#22a07b]/25">
                  {report.resolvedBy}
                </dd>
              </div>
              {report.resolutionNotes && (
                <p className="text-[11px] surface-inset p-2 rounded-lg text-slate-300 leading-relaxed">
                  {report.resolutionNotes}
                </p>
              )}
            </div>
          )}
        </dl>

        {/* Bottom-Pinned Supervisor Action Footer */}
        <div className="mt-auto pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium">
            {t.setStatusLabel}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {(report.status === "pending" || report.status === "in_progress") && (
              <button
                type="button"
                onClick={() => onNavigateAssign(report._id)}
                className="focus-ring px-2.5 py-1 rounded-lg text-xs font-medium bg-[#142a24] text-[#6ee7b7] border border-[#22a07b]/35 hover:bg-[#19352d] transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                {report.assignedWorkerId ? t.actionReassign : t.actionAssignWorker}
              </button>
            )}
            {report.status !== "in_progress" && (
              <button
                type="button"
                onClick={() => onStatusChange(report._id, "in_progress")}
                className="focus-ring px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-200 border border-slate-700/70 hover:bg-slate-800 hover:border-slate-600 transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                {t.actionInField}
              </button>
            )}
            {report.status !== "resolved" && (
              <button
                type="button"
                onClick={() => onStatusChange(report._id, "resolved")}
                className="focus-ring px-2.5 py-1 rounded-lg text-xs font-medium bg-[#22a07b] text-white hover:bg-[#1d8e6d] transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                {t.actionApprove}
              </button>
            )}
            {report.status !== "rejected" && (
              <button
                type="button"
                onClick={() => onStatusChange(report._id, "rejected")}
                className="focus-ring px-2 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                {t.actionReject}
              </button>
            )}
            {report.status !== "pending" && (
              <button
                type="button"
                onClick={() => onStatusChange(report._id, "pending")}
                className="focus-ring px-2 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                {t.actionReset}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
