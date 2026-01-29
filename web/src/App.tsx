import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type StatusType = "all" | "pending" | "in_progress" | "resolved" | "rejected";

export default function App() {
  const reports = useQuery(api.reports.listReports, {});
  const updateStatus = useMutation(api.reports.updateReportStatus);
  const [filter, setFilter] = useState<StatusType>("all");

  const totalCount = reports?.length ?? 0;
  const pendingCount = reports?.filter((r) => r.status === "pending").length ?? 0;
  const inProgressCount = reports?.filter((r) => r.status === "in_progress").length ?? 0;
  const resolvedCount = reports?.filter((r) => r.status === "resolved").length ?? 0;

  const filteredReports = reports?.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🗑️</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              EcoReport AI Dashboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Real-time incident reports verified with MobileNetV2 Trash Detection & stored in Convex.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://t.me/fyp_qwerty_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium text-sm transition-colors shadow-lg shadow-sky-500/20"
          >
            <svg
              className="w-4 h-4 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.955z" />
            </svg>
            Open @fyp_qwerty_bot
          </a>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Total Reports
          </span>
          <p className="mt-2 text-3xl font-extrabold text-white">{totalCount}</p>
        </div>
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">
            Pending
          </span>
          <p className="mt-2 text-3xl font-extrabold text-amber-400">{pendingCount}</p>
        </div>
        <div className="bg-sky-950/20 border border-sky-800/40 rounded-xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider font-semibold text-sky-400">
            In Progress
          </span>
          <p className="mt-2 text-3xl font-extrabold text-sky-400">{inProgressCount}</p>
        </div>
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-5 shadow-sm">
          <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
            Resolved
          </span>
          <p className="mt-2 text-3xl font-extrabold text-emerald-400">{resolvedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-800 pb-4">
        {(
          [
            { key: "all", label: "All Reports" },
            { key: "pending", label: "Pending" },
            { key: "in_progress", label: "In Progress" },
            { key: "resolved", label: "Resolved" },
            { key: "rejected", label: "Rejected" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-slate-700 text-white shadow-inner"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports Grid / Empty State */}
      {reports === undefined ? (
        <div className="text-center py-20 text-slate-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-3"></div>
          <p>Connecting to Convex real-time database...</p>
        </div>
      ) : filteredReports?.length === 0 ? (
        <div className="text-center py-20 px-4 bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl">
          <div className="text-5xl mb-4">📸 📍</div>
          <h3 className="text-lg font-semibold text-slate-200">No reports found</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            {filter === "all"
              ? "Open Telegram and send a photo and location to @fyp_qwerty_bot. When AI detects garbage, submissions will appear here in real time!"
              : `No reports currently marked as "${filter}".`}
          </p>
          {filter === "all" && (
            <a
              href="https://t.me/fyp_qwerty_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
            >
              Test Bot on Telegram
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports?.map((report) => {
            const dateStr = new Date(report.createdAt).toLocaleString();
            const mapUrl = `https://www.google.com/maps?q=${report.latitude},${report.longitude}`;
            const confidencePct = report.confidence
              ? (report.confidence * 100).toFixed(0)
              : null;

            return (
              <div
                key={report._id}
                className="bg-slate-800/70 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg flex flex-col transition-all hover:border-slate-600"
              >
                {/* Photo Preview */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden group">
                  {report.imageUrl ? (
                    <img
                      src={report.imageUrl}
                      alt={report.caption || "Garbage report photo"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                      No Image Available
                    </div>
                  )}

                  {/* AI Confidence Badge */}
                  {confidencePct && (
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/85 text-emerald-950 backdrop-blur-md shadow-md">
                        <span>🤖</span> {confidencePct}% Trash
                      </span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize backdrop-blur-md shadow-md ${
                        report.status === "pending"
                          ? "bg-amber-500/80 text-amber-950"
                          : report.status === "in_progress"
                          ? "bg-sky-500/80 text-sky-950"
                          : report.status === "resolved"
                          ? "bg-emerald-500/80 text-emerald-950"
                          : "bg-rose-500/80 text-rose-950"
                      }`}
                    >
                      {report.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {report.caption && (
                      <p className="text-sm font-medium text-slate-200 mb-3 italic">
                        &quot;{report.caption}&quot;
                      </p>
                    )}

                    {/* Location Info */}
                    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800 mb-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-300">📍 Ground Location</span>
                          {report.isLocationCorrected && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Fused GPS+IMU
                            </span>
                          )}
                        </div>
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1"
                        >
                          Google Maps ↗
                        </a>
                      </div>
                      <p className="font-mono text-xs text-slate-100 font-medium">
                        {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                      </p>

                      {report.isLocationCorrected && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5 font-mono">
                          {report.offsetMeters !== undefined && (
                            <p className="flex justify-between">
                              <span className="text-slate-500">Offset Corrected:</span>
                              <span className="text-emerald-400">+{report.offsetMeters.toFixed(1)}m @ {report.heading?.toFixed(0) ?? 0}°</span>
                            </p>
                          )}
                          {report.rawLatitude !== undefined && report.rawLongitude !== undefined && (
                            <p className="flex justify-between">
                              <span className="text-slate-500">Raw Antenna:</span>
                              <span className="text-slate-400">{report.rawLatitude.toFixed(6)}, {report.rawLongitude.toFixed(6)}</span>
                            </p>
                          )}
                          {report.speedKmh !== undefined && report.speedKmh > 0 && (
                            <p className="flex justify-between">
                              <span className="text-slate-500">Vehicle Speed:</span>
                              <span className="text-slate-300">{report.speedKmh.toFixed(1)} km/h</span>
                            </p>
                          )}
                          {report.qualityScore !== undefined && (
                            <p className="flex justify-between">
                              <span className="text-slate-500">Camera Quality:</span>
                              <span className="text-sky-300">
                                {(report.qualityScore * 100).toFixed(0)}%
                                {report.blurScore !== undefined && ` (Sharpness: ${report.blurScore.toFixed(0)})`}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 text-xs text-slate-400 mb-4">
                      <p>
                        <span className="text-slate-500">Submitted by:</span>{" "}
                        <span className="text-slate-300">
                          {report.userName ? `@${report.userName}` : `ID: ${report.userId}`}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-500">Date:</span>{" "}
                        <span className="text-slate-300">{dateStr}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Set status:</span>
                    <div className="flex items-center gap-1.5">
                      {report.status !== "in_progress" && (
                        <button
                          onClick={() => handleStatusChange(report._id, "in_progress")}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-800/60 hover:bg-sky-900/60 transition-colors"
                        >
                          In Progress
                        </button>
                      )}
                      {report.status !== "resolved" && (
                        <button
                          onClick={() => handleStatusChange(report._id, "resolved")}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                      {report.status !== "pending" && (
                        <button
                          onClick={() => handleStatusChange(report._id, "pending")}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
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
  );
}
