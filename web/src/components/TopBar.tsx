import { ALL_ZONE_IDS, type ZoneId } from "../constants/zones";
import { useLanguage } from "../i18n/LanguageContext";
import type { AppRoute } from "../types/reports";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  CleoEmblemIcon,
} from "./Icons";
import { LanguageToggle } from "./LanguageToggle";

interface TopBarProps {
  route: AppRoute;
  onNavigate: (nextRoute: AppRoute) => void;
  pendingCount: number;
  selectedZone: ZoneId;
  onZoneChange: (zone: ZoneId) => void;
}

export function TopBar({
  route,
  onNavigate,
  pendingCount,
  selectedZone,
  onZoneChange,
}: TopBarProps) {
  const { t } = useLanguage();

  return (
    <header className="md:sticky md:top-0 z-30 border-b border-slate-800/80 bg-[#080d12]/88 backdrop-blur-xl">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-3.5 focus:py-2 focus:rounded-lg focus:bg-[#22a07b] focus:text-white focus:text-xs focus:font-semibold"
      >
        {t.skipToContent}
      </a>

      {/* Authority & Telemetry Utility Strip */}
      <div className="border-b border-slate-800/70 bg-[#060a0e]/90">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-full bg-[#22a07b] shrink-0"
              aria-hidden="true"
            />
            <span className="text-slate-300 font-medium truncate">
              {t.authorityBanner}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#22a07b]/10 text-[#34c397] border border-[#22a07b]/25 font-medium text-[11px]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#34c397] animate-pulse"
                aria-hidden="true"
              />
              {t.liveTelemetry}
            </span>

            <a
              href="https://t.me/fyp_qwerty_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring text-slate-300 hover:text-[#34c397] font-medium transition-colors inline-flex items-center gap-1 rounded"
            >
              <span>{t.residentBotLabel}</span>
              <ArrowUpRightIcon className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <LanguageToggle />
          </div>
        </div>
      </div>

      {/* Primary Command Header */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#102420] border border-[#22a07b]/35 text-[#34c397] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <CleoEmblemIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] leading-tight text-white">
                CLEO
              </h1>
              <span className="text-slate-500 font-normal hidden sm:inline">/</span>
              <span className="text-sm sm:text-base font-medium text-[#34c397]">
                {t.brandSubtitle}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 max-w-[65ch] text-pretty">
              {t.heroSummary}
            </p>
          </div>
        </div>

        {/* Navigation & Council Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <nav
            aria-label={t.navOverview}
            className="inline-flex items-center gap-1 bg-[#0a1017] p-1 rounded-xl border border-slate-800/90"
          >
            <button
              type="button"
              onClick={() => onNavigate("/")}
              aria-current={route === "/" ? "page" : undefined}
              className={`focus-ring px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                route === "/"
                  ? "bg-[#1a2634] text-white border border-slate-700/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              {t.navOverview}
            </button>
            <button
              type="button"
              onClick={() => onNavigate("/assign")}
              aria-current={route === "/assign" ? "page" : undefined}
              className={`focus-ring px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98] cursor-pointer inline-flex items-center gap-2 ${
                route === "/assign"
                  ? "bg-[#1a2634] text-white border border-slate-700/80 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <span>{t.navAssignWorkers}</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#22a07b]/15 text-[#34c397] border border-[#22a07b]/30 font-mono text-[11px] leading-none tabular-nums">
                  {pendingCount}
                </span>
              )}
            </button>
          </nav>

          <div className="relative min-w-0 sm:w-72">
            <label htmlFor="zone-select" className="sr-only">
              {t.zoneLabel}
            </label>
            <select
              id="zone-select"
              value={selectedZone}
              onChange={(e) => onZoneChange(e.target.value as ZoneId)}
              className="focus-ring w-full appearance-none bg-[#0f161e] border border-slate-700/70 hover:border-slate-600 rounded-xl pl-3.5 pr-9 py-2 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              {ALL_ZONE_IDS.map((zoneId) => (
                <option key={zoneId} value={zoneId} className="bg-[#0f161e] text-slate-100">
                  {t.zones[zoneId]}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>
    </header>
  );
}
