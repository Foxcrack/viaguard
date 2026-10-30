import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.ts";
import { InspectionReport } from "@viaguard/core";
import { FileText, Printer, Eye, Calendar, MapPin, Search } from "lucide-react";

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  useEffect(() => {
    api
      .getReports()
      .then((data) => setReports(data))
      .catch((err) => console.error("Error loading reports:", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = reports.filter((r) => {
    const matchSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.summary.toLowerCase().includes(search.toLowerCase());
    const matchModule = moduleFilter === "all" || r.module === moduleFilter;
    const matchSeverity =
      severityFilter === "all" || r.severityLevel === severityFilter;
    return matchSearch && matchModule && matchSeverity;
  });

  return (
    <div className="space-y-6 py-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <FileText className="w-7 h-7 text-blue-400" />
            <span>Inspection Reports Archive</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete database of civic road damage and comparative construction assessments.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, report ID, or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-border rounded-lg pl-9 pr-3 py-2 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-slate-900 border border-border rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Modules</option>
            <option value="road">Road Damage</option>
            <option value="construction">Construction</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-900 border border-border rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading archive records...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center text-slate-400 text-sm">
          No matching inspection reports found. Try modifying your search or filters.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden shadow">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 border-b border-border text-slate-400 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Inspection Audit</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4 text-center">Severity</th>
                <th className="py-3 px-4 text-center">Detections</th>
                <th className="py-3 px-4">Date &amp; Location</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      {r.imageUrl && (
                        <img
                          src={r.imageUrl}
                          alt={r.title}
                          className="w-12 h-10 object-cover rounded border border-border shrink-0"
                        />
                      )}
                      <div>
                        <Link
                          to={`/reports/${r.id}`}
                          className="font-bold text-white hover:text-blue-400 transition line-clamp-1"
                        >
                          {r.title}
                        </Link>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          ID: {r.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 capitalize font-medium">{r.module}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.severityLevel === "critical"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : r.severityLevel === "high"
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : r.severityLevel === "medium"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {r.severityLevel} ({r.severityScore}/100)
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                    {r.findings.length}
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.location ? (
                      <div className="flex items-center space-x-1 text-emerald-400/90 font-mono">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {r.location.latitude.toFixed(3)}, {r.location.longitude.toFixed(3)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600">No GPS data</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Link
                        to={`/reports/${r.id}`}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="View Full Report"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <a
                        href={`/api/reports/${r.id}/export`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="Print / Save PDF"
                      >
                        <Printer className="w-4 h-4 text-blue-400" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
