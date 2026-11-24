import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DispatchQueue } from "./components/DispatchQueue";
import { Footer } from "./components/Footer";
import {
  ArrowUpRightIcon,
  CleoEmblemIcon,
  CloseIcon,
  SearchIcon,
} from "./components/Icons";
import { ImageLightbox } from "./components/ImageLightbox";
import { IncidentCard } from "./components/IncidentCard";
import { TelemetryStrip } from "./components/TelemetryStrip";
import { TopBar } from "./components/TopBar";
import {
  matchesMunicipalZone,
  WORKER_PRESETS,
  type ZoneId,
} from "./constants/zones";
import { useLanguage } from "./i18n/LanguageContext";
import { formatTemplate } from "./i18n/translations";
import type {
  AppRoute,
  AssignQueueFilter,
  LightboxModalData,
  ReportItem,
  ReportStatus,
  StatusFilter,
} from "./types/reports";

export default function App() {
  const { t } = useLanguage();
  const reports = useQuery(api.reports.listReports, { limit: 100 }) as
    | ReportItem[]
    | undefined;
  const updateStatus = useMutation(api.reports.updateReportStatus);
  const assignReport = useMutation(api.reports.assignReport);

  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== "undefined" && window.location.pathname === "/assign"
      ? "/assign"
      : "/"
  );
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedZone, setSelectedZone] = useState<ZoneId>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeModalImage, setActiveModalImage] =
    useState<LightboxModalData | null>(null);

  // Worker Assignment Route State
  const [assignQueueFilter, setAssignQueueFilter] =
    useState<AssignQueueFilter>("pending");
  const [highlightedReportId, setHighlightedReportId] =
    useState<Id<"reports"> | null>(null);
  const [selectedWorkerByReport, setSelectedWorkerByReport] = useState<
    Record<string, string>
  >({});
  const [customWorkerIdByReport, setCustomWorkerIdByReport] = useState<
    Record<string, string>
  >({});
  const [customWorkerNameByReport, setCustomWorkerNameByReport] = useState<
    Record<string, string>
  >({});
  const [assigningReportId, setAssigningReportId] =
    useState<Id<"reports"> | null>(null);
  const [assignBanner, setAssignBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname === "/assign" ? "/assign" : "/");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (nextRoute: AppRoute, reportId?: Id<"reports">) => {
    if (typeof window !== "undefined" && window.location.pathname !== nextRoute) {
      window.history.pushState({}, "", nextRoute);
    }
    setRoute(nextRoute);
    if (reportId) {
      setHighlightedReportId(reportId);
      const target = reports?.find((r) => r._id === reportId);
      setAssignQueueFilter(
        target?.status === "in_progress" ? "in_progress" : "pending"
      );
    } else {
      setHighlightedReportId(null);
    }
  };

  // Scope reports to selected Municipal Council zone
  const zoneScopedReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((r) => matchesMunicipalZone(r, selectedZone));
  }, [reports, selectedZone]);

  // Compute operational statistics for the active scope
  const totalCount = zoneScopedReports.length;
  const pendingCount = zoneScopedReports.filter(
    (r) => r.status === "pending"
  ).length;
  const inProgressCount = zoneScopedReports.filter(
    (r) => r.status === "in_progress"
  ).length;
  const resolvedCount = zoneScopedReports.filter(
    (r) => r.status === "resolved"
  ).length;
  const rejectedCount = zoneScopedReports.filter(
    (r) => r.status === "rejected"
  ).length;
  const resolutionRate =
    totalCount > 0 ? ((resolvedCount / totalCount) * 100).toFixed(1) : "0.0";

  // Filter overview reports by status and search query
  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return zoneScopedReports.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!query) return true;

      const matchesCaption = r.caption?.toLowerCase().includes(query) ?? false;
      const matchesWorker =
        (r.resolvedBy?.toLowerCase().includes(query) ?? false) ||
        (r.assignedWorkerName?.toLowerCase().includes(query) ?? false);
      const matchesId = r._id.toLowerCase().includes(query);
      return matchesCaption || matchesWorker || matchesId;
    });
  }, [zoneScopedReports, filter, searchQuery]);

  // Filter dispatch queue reports for /assign
  const assignQueueReports = useMemo(() => {
    const list = zoneScopedReports.filter((r) => {
      if (assignQueueFilter === "pending") return r.status === "pending";
      if (assignQueueFilter === "in_progress") return r.status === "in_progress";
      return r.status === "pending" || r.status === "in_progress";
    });
    if (!highlightedReportId) return list;
    return [...list].sort((a, b) =>
      a._id === highlightedReportId ? -1 : b._id === highlightedReportId ? 1 : 0
    );
  }, [zoneScopedReports, assignQueueFilter, highlightedReportId]);

  const handleStatusChange = async (
    reportId: Id<"reports">,
    newStatus: ReportStatus
  ) => {
    try {
      await updateStatus({ reportId, status: newStatus });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleAssignWorker = async (
    reportId: Id<"reports">,
    defaultWorkerId?: string
  ) => {
    const selectedChoice =
      selectedWorkerByReport[reportId] ??
      (defaultWorkerId && WORKER_PRESETS.some((w) => w.id === defaultWorkerId)
        ? defaultWorkerId
        : WORKER_PRESETS[0].id);

    let workerId = selectedChoice;
    let workerName = "";

    if (selectedChoice === "custom") {
      const customId = (customWorkerIdByReport[reportId] ?? "").trim();
      const customName = (customWorkerNameByReport[reportId] ?? "").trim();
      if (!customName) {
        setAssignBanner({
          type: "error",
          message: t.assignBannerMissingName,
        });
        return;
      }
      workerId =
        customId || customName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      workerName = customName;
    } else {
      const preset = WORKER_PRESETS.find((w) => w.id === selectedChoice);
      if (!preset) return;
      workerId = preset.id;
      const unitLabel = t.workerPresetUnitLabel[preset.id] ?? preset.unitCode;
      workerName = `${preset.plate} • ${unitLabel}`;
    }

    setAssigningReportId(reportId);
    setAssignBanner(null);
    try {
      await assignReport({ reportId, workerId, workerName });
      setAssignBanner({
        type: "success",
        message: formatTemplate(t.assignBannerSuccess, {
          id: reportId.slice(0, 8),
          worker: workerName,
        }),
      });
      if (highlightedReportId === reportId) {
        setHighlightedReportId(null);
      }
    } catch (err) {
      console.error("Failed to assign worker:", err);
      setAssignBanner({
        type: "error",
        message: t.assignBannerError,
      });
    } finally {
      setAssigningReportId(null);
    }
  };

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: t.tabAll, count: totalCount },
    { key: "pending", label: t.tabPending, count: pendingCount },
    { key: "in_progress", label: t.tabInProgress, count: inProgressCount },
    { key: "resolved", label: t.tabResolved, count: resolvedCount },
    { key: "rejected", label: t.tabRejected, count: rejectedCount },
  ];

  const isFilteredView =
    filter !== "all" || selectedZone !== "all" || searchQuery.trim().length > 0;

  return (
    <div className="min-h-dvh flex flex-col relative">
      {/* Subtle fixed grain texture */}
      <div
        className="grain-overlay fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
      />

      <TopBar
        route={route}
        onNavigate={(next) => navigate(next)}
        pendingCount={pendingCount}
        selectedZone={selectedZone}
        onZoneChange={setSelectedZone}
      />

      <main
        id="main-content"
        className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-8"
      >
        {route === "/assign" ? (
          <DispatchQueue
            reports={reports}
            queueReports={assignQueueReports}
            pendingCount={pendingCount}
            inProgressCount={inProgressCount}
            assignQueueFilter={assignQueueFilter}
            onFilterChange={setAssignQueueFilter}
            highlightedReportId={highlightedReportId}
            selectedWorkerByReport={selectedWorkerByReport}
            onSelectWorker={(reportId, workerId) =>
              setSelectedWorkerByReport((prev) => ({
                ...prev,
                [reportId]: workerId,
              }))
            }
            customWorkerIdByReport={customWorkerIdByReport}
            onCustomIdChange={(reportId, val) =>
              setCustomWorkerIdByReport((prev) => ({
                ...prev,
                [reportId]: val,
              }))
            }
            customWorkerNameByReport={customWorkerNameByReport}
            onCustomNameChange={(reportId, val) =>
              setCustomWorkerNameByReport((prev) => ({
                ...prev,
                [reportId]: val,
              }))
            }
            assigningReportId={assigningReportId}
            assignBanner={assignBanner}
            onDismissBanner={() => setAssignBanner(null)}
            onAssign={handleAssignWorker}
            onOpenModal={setActiveModalImage}
            onBackToOverview={() => navigate("/")}
          />
        ) : (
          <>
            <TelemetryStrip
              totalCount={totalCount}
              pendingCount={pendingCount}
              inProgressCount={inProgressCount}
              resolvedCount={resolvedCount}
              resolutionRate={resolutionRate}
            />

            {/* Filter Toolbar & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
              <div
                role="tablist"
                aria-label={t.tabAll}
                className="flex flex-wrap items-center gap-1.5"
              >
                {statusTabs.map((tab) => {
                  const isActive = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setFilter(tab.key)}
                      className={`focus-ring px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-2 ${
                        isActive
                          ? "bg-[#22a07b] text-white shadow-sm"
                          : "bg-[#0f161e] text-slate-300 border border-slate-800/90 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums ${
                          isActive
                            ? "bg-black/20 text-white"
                            : "bg-[#080d12] text-slate-400"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-80">
                <SearchIcon className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label={t.searchPlaceholder}
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="focus-ring w-full surface-inset rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label={t.searchClear}
                    onClick={() => setSearchQuery("")}
                    className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Content Section: Loading Skeleton, Empty State, or Incident Grid */}
            {reports === undefined ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="surface-panel rounded-2xl overflow-hidden p-4 space-y-4 animate-pulse"
                  >
                    <div className="w-full aspect-video bg-slate-800/50 rounded-xl" />
                    <div className="h-4 bg-slate-800/70 rounded w-3/4" />
                    <div className="h-16 bg-slate-800/40 rounded-xl" />
                    <div className="h-9 bg-slate-800/60 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-20 px-6 surface-panel rounded-2xl border-dashed max-w-2xl mx-auto">
                <div className="w-12 h-12 rounded-xl bg-[#102420] border border-[#22a07b]/30 text-[#34c397] flex items-center justify-center mx-auto mb-4">
                  <CleoEmblemIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100 text-balance">
                  {isFilteredView ? t.emptyFilteredTitle : t.emptyGlobalTitle}
                </h3>
                <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed text-pretty">
                  {isFilteredView ? t.emptyFilteredDesc : t.emptyGlobalDesc}
                </p>

                {isFilteredView ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setSelectedZone("all");
                      setSearchQuery("");
                    }}
                    className="focus-ring mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#22a07b] hover:bg-[#1d8e6d] text-white text-xs font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer"
                  >
                    {t.emptyFilteredReset}
                  </button>
                ) : (
                  <a
                    href="https://t.me/fyp_qwerty_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#22a07b] hover:bg-[#1d8e6d] text-white text-xs font-medium transition-all duration-150 active:scale-[0.98]"
                  >
                    <span>{t.emptyGlobalCta}</span>
                    <ArrowUpRightIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                {filteredReports.map((report, index) => (
                  <IncidentCard
                    key={report._id}
                    report={report}
                    index={index}
                    onOpenModal={setActiveModalImage}
                    onNavigateAssign={(reportId) =>
                      navigate("/assign", reportId)
                    }
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      <ImageLightbox
        modal={activeModalImage}
        onClose={() => setActiveModalImage(null)}
      />
    </div>
  );
}
