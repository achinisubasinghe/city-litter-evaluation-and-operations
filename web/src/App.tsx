import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type StatusType = "all" | "pending" | "in_progress" | "resolved" | "rejected";

interface CouncilZone {
  id: string;
  nameEn: string;
  nameSi: string;
}

const SRI_LANKA_COUNCIL_ZONES: CouncilZone[] = [
  { id: "all", nameEn: "All Municipal Councils", nameSi: "සියලු පළාත් පාලන ආයතන" },
  { id: "cmc-north", nameEn: "Colombo MC • Fort & Colombo North", nameSi: "කොළඹ ම.න.ස. • කොටුව සහ උතුර" },
  { id: "cmc-cinnamon", nameEn: "Colombo MC • Cinnamon Gardens & Borella", nameSi: "කොළඹ ම.න.ස. • කුරුඳු වත්ත/බොරැල්ල" },
  { id: "cmc-south", nameEn: "Colombo MC • Kollupitiya & Bambalapitiya", nameSi: "කොළඹ ම.න.ස. • කොල්ලුපිටිය/බම්බලපිටිය" },
  { id: "dmmc", nameEn: "Dehiwala-Mount Lavinia MC", nameSi: "දෙහිවල-ගල්කිස්ස මහ නගර සභාව" },
  { id: "kmc", nameEn: "Kaduwela Municipal Council", nameSi: "කඩුවෙල මහ නගර සභාව" },
  { id: "kandy", nameEn: "Kandy Municipal Council", nameSi: "මහනුවර මහ නගර සභාව" },
  { id: "galle", nameEn: "Galle Municipal Council", nameSi: "ගාල්ල මහ නගර සභාව" },
];

export default function App() {
  const reports = useQuery(api.reports.listReports, { limit: 100 });
  const updateStatus = useMutation(api.reports.updateReportStatus);

  const [filter, setFilter] = useState<StatusType>("all");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeModalImage, setActiveModalImage] = useState<{ url: string; title: string; meta?: string } | null>(null);

  // Compute operational statistics
  const totalCount = reports?.length ?? 0;
  const pendingCount = reports?.filter((r) => r.status === "pending").length ?? 0;
  const inProgressCount = reports?.filter((r) => r.status === "in_progress").length ?? 0;
  const resolvedCount = reports?.filter((r) => r.status === "resolved").length ?? 0;
  const resolutionRate = totalCount > 0 ? ((resolvedCount / totalCount) * 100).toFixed(1) : "0.0";

  // Filter reports
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((r) => {
      // Status filter
      if (filter !== "all" && r.status !== filter) return false;

      // Search query (caption, worker, id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCaption = r.caption?.toLowerCase().includes(q) ?? false;
        const matchesWorker = r.resolvedBy?.toLowerCase().includes(q) ?? false;
        const matchesId = r._id.toLowerCase().includes(q);
        if (!matchesCaption && !matchesWorker && !matchesId) return false;
      }

      return true;
    });
  }, [reports, filter, searchQuery]);

  const handleStatusChange = async (
    reportId: Id<"reports">,
    newStatus: "pending" | "in_progress" | "resolved" | "rejected"
  ) => {
    try {
      await updateStatus({ reportId, status: newStatus });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Top Municipal Ribbon */}
      <div className="bg-[#051124] border-b border-slate-800/80 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🇱🇰</span>
            <span className="font-semibold text-slate-200">
              ශ්‍රී ලංකා පළාත් පාලන සහ පරිසර අධිකාරිය
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">
              Democratic Socialist Republic of Sri Lanka — Solid Waste Operations
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Telemetry Connected
            </span>
            <a
              href="https://t.me/fyp_qwerty_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 font-medium hover:underline inline-flex items-center gap-1"
            >
              Resident Bot @fyp_qwerty_bot ↗
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Main Command Center Header */}
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-b border-slate-800/80 pb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-2xl shadow-lg shadow-emerald-950/50 border border-emerald-400/30">
                🌿
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  CLEO <span className="text-emerald-400 font-medium text-lg sm:text-2xl">| Municipal Operations Hub</span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Automated roadside litter detection, Edge IoT telemetry & sanitation worker dispatch in Sri Lanka
                </p>
              </div>
            </div>
          </div>

          {/* Municipal Council & Zone Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <label htmlFor="zone-select" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Municipal Council / Zone:
              </label>
              <select
                id="zone-select"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full sm:w-72 bg-[#0d1b2e] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {SRI_LANKA_COUNCIL_ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id} className="bg-[#0b172a] text-slate-100">
                    {zone.nameEn} ({zone.nameSi})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Operational Telemetry KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0c192d]/80 border border-slate-800/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Total Incident Streams
              </span>
              <span className="text-slate-500 text-sm">📡</span>
            </div>
            <p className="mt-3 text-3xl font-black text-white font-mono">{totalCount}</p>
            <span className="text-[11px] text-slate-400 mt-1 block">Edge truck detections + Citizen reports</span>
          </div>

          <div className="bg-amber-950/15 border border-amber-800/30 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-amber-700/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
                Pending Collection
              </span>
              <span className="text-amber-500 text-sm">⏳</span>
            </div>
            <p className="mt-3 text-3xl font-black text-amber-400 font-mono">{pendingCount}</p>
            <span className="text-[11px] text-amber-500/80 mt-1 block">Awaiting field truck dispatch</span>
          </div>

          <div className="bg-sky-950/15 border border-sky-800/30 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-sky-700/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-sky-400">
                In Field / In Progress
              </span>
              <span className="text-sky-400 text-sm">🚚</span>
            </div>
            <p className="mt-3 text-3xl font-black text-sky-400 font-mono">{inProgressCount}</p>
            <span className="text-[11px] text-sky-400/80 mt-1 block">Assigned to sanitation trucks</span>
          </div>

          <div className="bg-emerald-950/15 border border-emerald-800/30 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-emerald-700/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-400">
                Verified Cleaned ({resolutionRate}%)
              </span>
              <span className="text-emerald-400 text-sm">✓</span>
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-400 font-mono">{resolvedCount}</p>
            <span className="text-[11px] text-emerald-400/80 mt-1 block">With worker photo proof</span>
          </div>
        </div>

        {/* Filter Toolbar & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-slate-800/80 pb-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "all", label: "All Incidents", count: totalCount },
                { key: "pending", label: "Pending (පොරොත්තු)", count: pendingCount },
                { key: "in_progress", label: "In Progress (ක්‍රියාත්මක)", count: inProgressCount },
                { key: "resolved", label: "Verified Cleaned (පිරිසිදු)", count: resolvedCount },
                { key: "rejected", label: "Rejected", count: reports?.filter(r => r.status === "rejected").length ?? 0 },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filter === tab.key
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-black/25 text-[10px] font-mono">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search incidents, worker or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 bg-[#0d1b2e] border border-slate-700/80 rounded-xl px-3.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content Section: Skeleton Loading, Empty State, or Incident Grid */}
        {reports === undefined ? (
          /* Realistic Skeleton Loaders */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[#0d1b2e]/60 border border-slate-800 rounded-2xl overflow-hidden p-4 space-y-4 animate-pulse"
              >
                <div className="w-full aspect-video bg-slate-800/60 rounded-xl"></div>
                <div className="h-4 bg-slate-800/80 rounded w-3/4"></div>
                <div className="h-16 bg-slate-800/40 rounded-xl"></div>
                <div className="h-8 bg-slate-800/60 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          /* Composed Empty State */
          <div className="text-center py-24 px-6 bg-[#0a1628]/40 border border-dashed border-slate-800 rounded-3xl max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
              🌿
            </div>
            <h3 className="text-lg font-extrabold text-slate-100">No Incidents in Current View</h3>
            <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              {filter === "all"
                ? "No roadside litter reports recorded yet. Incidents will stream in automatically from edge camera trucks or resident submissions on Telegram."
                : `No reports currently matching the filter "${filter}".`}
            </p>
            {filter === "all" && (
              <a
                href="https://t.me/fyp_qwerty_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors shadow-lg shadow-emerald-950"
              >
                Test Resident Bot on Telegram ↗
              </a>
            )}
          </div>
        ) : (
          /* Real-Time Incidents Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => {
              const dateStr = new Date(report.createdAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              });
              const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;
              const confidencePct = report.confidence
                ? (report.confidence * 100).toFixed(0)
                : null;

              return (
                <div
                  key={report._id}
                  className="bg-[#0d1b2e]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all hover:border-slate-500 hover:shadow-2xl hover:shadow-black/40"
                >
                  {/* Photo Display: Before & After Split if Resolved, else Hero Photo */}
                  <div className="relative aspect-video bg-slate-950 overflow-hidden">
                    {report.status === "resolved" && report.proofImageUrl ? (
                      <div className="grid grid-cols-2 w-full h-full">
                        {/* Before (Reported) */}
                        <div
                          className="relative h-full border-r border-slate-800 cursor-pointer group"
                          onClick={() =>
                            setActiveModalImage({
                              url: report.imageUrl || "",
                              title: "Reported Litter (Before / පෙර)",
                              meta: `Coordinates: ${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`,
                            })
                          }
                        >
                          {report.imageUrl ? (
                            <img
                              src={report.imageUrl}
                              alt="Before cleanup"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                              No Image
                            </div>
                          )}
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-950/80 text-amber-400 backdrop-blur-md border border-amber-500/30">
                            BEFORE • පෙර
                          </span>
                        </div>

                        {/* After (Cleaned Proof) */}
                        <div
                          className="relative h-full cursor-pointer group"
                          onClick={() =>
                            setActiveModalImage({
                              url: report.proofImageUrl!,
                              title: "Verified Cleaned Proof (After / පසු)",
                              meta: `Resolved by ${report.resolvedBy ?? "Worker"}`,
                            })
                          }
                        >
                          <img
                            src={report.proofImageUrl}
                            alt="After cleanup proof"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-950/90 text-emerald-400 backdrop-blur-md border border-emerald-500/40">
                            AFTER (PROOF) • පසු
                          </span>
                        </div>
                      </div>
                    ) : report.imageUrl ? (
                      <div
                        className="w-full h-full cursor-pointer group"
                        onClick={() =>
                          setActiveModalImage({
                            url: report.imageUrl!,
                            title: "Reported Incident Photo",
                            meta: `Confidence: ${confidencePct}% • GPS: ${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`,
                          })
                        }
                      >
                        <img
                          src={report.imageUrl}
                          alt={report.caption || "Garbage report photo"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                        No Photo Stored
                      </div>
                    )}

                    {/* AI Confidence Badge */}
                    {confidencePct && report.status !== "resolved" && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/90 text-emerald-950 backdrop-blur-md shadow-md border border-emerald-400/40">
                          <span>🤖</span> {confidencePct}% Trash Match
                        </span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide backdrop-blur-md shadow-md ${
                          report.status === "pending"
                            ? "bg-amber-500/90 text-amber-950 border border-amber-400/30"
                            : report.status === "in_progress"
                            ? "bg-sky-500/90 text-sky-950 border border-sky-400/30"
                            : report.status === "resolved"
                            ? "bg-emerald-500/90 text-emerald-950 border border-emerald-400/30"
                            : "bg-rose-500/90 text-rose-950 border border-rose-400/30"
                        }`}
                      >
                        {report.status === "pending"
                          ? "Pending • පොරොත්තු"
                          : report.status === "in_progress"
                          ? "In Field • ක්‍රියාත්මක"
                          : report.status === "resolved"
                          ? "Cleaned • පිරිසිදු"
                          : "Rejected"}
                      </span>
                    </div>
                  </div>

                  {/* Card Content & Telemetry */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {report.caption && (
                        <p className="text-sm font-semibold text-slate-200 mb-3 italic">
                          &quot;{report.caption}&quot;
                        </p>
                      )}

                      {/* Location & GPS Info */}
                      <div className="bg-[#081220] rounded-xl p-3 border border-slate-800 mb-4">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-200">📍 GPS Ground Location</span>
                            {report.isLocationCorrected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Fused IMU
                              </span>
                            )}
                          </div>
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:text-sky-300 font-bold hover:underline inline-flex items-center gap-1"
                          >
                            Open Maps ↗
                          </a>
                        </div>
                        <p className="font-mono text-xs text-emerald-400 font-bold">
                          {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                        </p>

                        {report.isLocationCorrected && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5 font-mono">
                            {report.offsetMeters !== undefined && (
                              <p className="flex justify-between">
                                <span className="text-slate-500">Offset Corrected:</span>
                                <span className="text-emerald-400 font-bold">
                                  +{report.offsetMeters.toFixed(1)}m @ {report.heading?.toFixed(0) ?? 0}°
                                </span>
                              </p>
                            )}
                            {report.speedKmh !== undefined && report.speedKmh > 0 && (
                              <p className="flex justify-between">
                                <span className="text-slate-500">Vehicle Speed:</span>
                                <span className="text-slate-300">{report.speedKmh.toFixed(1)} km/h</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Metadata & Worker Attribution */}
                      <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                        <p className="flex items-center justify-between">
                          <span className="text-slate-500">Report Source:</span>
                          <span className="text-slate-300 font-medium">
                            {report.userName ? `@${report.userName}` : `ID: ${report.userId}`}
                          </span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span className="text-slate-500">Timestamp:</span>
                          <span className="text-slate-300 font-mono">{dateStr}</span>
                        </p>
                        {report.resolvedBy && (
                          <div className="pt-2 border-t border-slate-800/60">
                            <p className="flex items-center justify-between">
                              <span className="text-slate-500 font-semibold">Cleaned by:</span>
                              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                {report.resolvedBy}
                              </span>
                            </p>
                            {report.resolutionNotes && (
                              <p className="mt-1.5 text-[11px] bg-[#07101c] p-2 rounded-lg text-slate-300 italic border border-slate-800">
                                &quot;{report.resolutionNotes}&quot;
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Supervisor Quick Actions */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        Set Status:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {report.status !== "in_progress" && (
                          <button
                            onClick={() => handleStatusChange(report._id, "in_progress")}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-950/80 text-sky-300 border border-sky-800/80 hover:bg-sky-900 transition-colors"
                          >
                            In Field
                          </button>
                        )}
                        {report.status !== "resolved" && (
                          <button
                            onClick={() => handleStatusChange(report._id, "resolved")}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900 transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        {report.status !== "pending" && (
                          <button
                            onClick={() => handleStatusChange(report._id, "pending")}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {activeModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveModalImage(null)}
        >
          <div
            className="max-w-4xl w-full bg-[#0d1b2e] border border-slate-700 rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h4 className="text-base font-extrabold text-white">{activeModalImage.title}</h4>
                {activeModalImage.meta && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{activeModalImage.meta}</p>
                )}
              </div>
              <button
                onClick={() => setActiveModalImage(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={activeModalImage.url}
                alt={activeModalImage.title}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
