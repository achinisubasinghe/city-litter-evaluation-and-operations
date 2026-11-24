import { useLanguage } from "../i18n/LanguageContext";
import {
  CheckCircleIcon,
  ClockIcon,
  RadarIcon,
  TruckIcon,
} from "./Icons";

interface TelemetryStripProps {
  totalCount: number;
  pendingCount: number;
  inProgressCount: number;
  resolvedCount: number;
  resolutionRate: string;
}

export function TelemetryStrip({
  totalCount,
  pendingCount,
  inProgressCount,
  resolvedCount,
  resolutionRate,
}: TelemetryStripProps) {
  const { t } = useLanguage();
  const numericRate = Math.min(100, Math.max(0, Number(resolutionRate) || 0));

  const secondaryMetrics = [
    {
      key: "total",
      title: t.kpiTotalTitle,
      value: totalCount,
      footnote: t.kpiTotalFoot,
      dotClass: "bg-slate-400",
      icon: <RadarIcon className="w-4 h-4 text-slate-400" />,
    },
    {
      key: "pending",
      title: t.kpiPendingTitle,
      value: pendingCount,
      footnote: t.kpiPendingFoot,
      dotClass: "bg-amber-400/90",
      icon: <ClockIcon className="w-4 h-4 text-amber-300/85" />,
    },
    {
      key: "in_field",
      title: t.kpiInFieldTitle,
      value: inProgressCount,
      footnote: t.kpiInFieldFoot,
      dotClass: "bg-sky-400/90",
      icon: <TruckIcon className="w-4 h-4 text-sky-300/85" />,
    },
  ];

  return (
    <section
      aria-label={t.kpiTotalTitle}
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8"
    >
      {/* Featured Asymmetric Primary Metric: Verification & Clearance Progress */}
      <div className="lg:col-span-5 surface-panel rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#22a07b]/50 via-[#22a07b]/20 to-transparent"
          aria-hidden="true"
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[#34c397]"
                aria-hidden="true"
              />
              <h2 className="text-sm font-medium text-slate-200">
                {t.kpiCleanedTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">{t.kpiCleanedFoot}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#22a07b]/12 border border-[#22a07b]/25 text-[#34c397] flex items-center justify-center shrink-0">
            <CheckCircleIcon className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-white tabular-nums">
              {resolutionRate}%
            </span>
            <span className="text-xs font-medium text-[#34c397]">
              {t.kpiCleanedRatioSuffix}
            </span>
          </div>
          <span className="font-mono text-xs text-slate-300 tabular-nums">
            {resolvedCount} / {totalCount}
          </span>
        </div>

        <div
          className="mt-3 h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden"
          role="progressbar"
          aria-valuenow={numericRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t.kpiCleanedTitle}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1d8b6a] to-[#34c397] transition-[width] duration-500 ease-out"
            style={{ width: `${numericRate}%` }}
          />
        </div>
      </div>

      {/* Structured 3-Up Operational Counters */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {secondaryMetrics.map((metric) => (
          <div
            key={metric.key}
            className="surface-panel rounded-2xl p-5 flex flex-col justify-between transition-colors duration-200 hover:border-slate-600/70"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${metric.dotClass}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-slate-300 truncate">
                  {metric.title}
                </span>
              </div>
              {metric.icon}
            </div>

            <div className="mt-4">
              <p className="text-3xl font-semibold tracking-[-0.03em] text-white font-mono tabular-nums">
                {metric.value}
              </p>
              <p className="text-xs text-slate-400 mt-1 text-pretty">
                {metric.footnote}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
