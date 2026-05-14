import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Wifi,
  Calendar,
  Clock,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Network,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import FileUpload from "./FileUpload";

import { findKey, parseExcelDate, extractTxData } from "../utils/dataUtils";

const extractSiteCode = (str) => {
  if (!str) return "Unknown";
  // Pattern: search for parts that look like site codes (e.g., 0627AL, 7230AL)
  // Often after a dot or underscore or at the end
  const match = str.match(/([0-9]{4}[A-Z]{2})/i);
  if (match) return match[1].toUpperCase();

  // Fallback: take the last part after split by _ or .
  const parts = str.split(/[._]/);
  return parts[parts.length - 1].toUpperCase();
};

const TransmissionDashboard = ({ config, data, setData }) => {
  const processedData = useMemo(() => {
    if (!data) return [];
    return extractTxData(data, config);
  }, [data, config]);

  const filteredData = useMemo(() => {
    // Only display active/open cases, skip solved/closed
    return processedData.filter((d) => {
      const status = d.status.toLowerCase();
      return (
        !status.includes("solved") &&
        !status.includes("closed") &&
        !status.includes("cleared") &&
        !status.includes("resolved")
      );
    });
  }, [processedData]);

  // Stats
  const stats = useMemo(() => {
    const total = processedData.length;
    const open = processedData.filter((d) => {
      const status = d.status.toLowerCase();
      return (
        status.includes("open") ||
        status.includes("active") ||
        status.includes("in progress")
      );
    }).length;
    const closed = total - open;

    // Most impacted links
    const linkMap = {};
    processedData.forEach((d) => {
      if (d.linkId !== "Unknown") {
        linkMap[d.linkId] = (linkMap[d.linkId] || 0) + 1;
      }
    });
    const topLinks = Object.entries(linkMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, open, closed, topLinks };
  }, [processedData]);

  // Chart Data: Daily Trend
  const trendData = useMemo(() => {
    const dateMap = {};
    processedData.forEach((d) => {
      const date = d.dateStr;
      if (!dateMap[date]) dateMap[date] = { name: date, count: 0 };
      dateMap[date].count += 1;
    });
    return Object.values(dateMap);
  }, [processedData]);

  const COLORS = ["#ff7900", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6"];

  return (
    <div className="animate-fade-in dashboard-container" id="dashboard-content">
      {/* Persistent Upload Section */}
      <div className="mb-8">
        <FileUpload
          onDataProcessed={setData}
          title="Transmission Issues Dashboard"
          description="Upload Tx report (Excel) to analyze MW link outages and site impacts."
        />
      </div>

      {data && (
        <>
          <div className="dashboard-header mb-10 pb-6 border-b border-white/5">
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-bold tracking-tight text-gradient">
                Transmission Analysis
              </h1>
            </div>
          </div>

          {/* Metrics Grid */}
          <div
            className="dashboard-grid mb-8"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            <div className="glass-panel metric-card m-orange">
              <div className="metric-title">
                Total Incidents <BarChart3 size={18} color="#ff7900" />
              </div>
              <div className="metric-value">{stats.total}</div>
              <div className="metric-subtitle">
                Transmission outages detected
              </div>
            </div>
            <div className="glass-panel metric-card m-blue">
              <div className="metric-title">
                Open Issues <Clock size={18} color="#3b82f6" />
              </div>
              <div className="metric-value">{stats.open}</div>
              <div className="metric-subtitle">Currently active alarms</div>
            </div>
            <div className="glass-panel metric-card m-green">
              <div className="metric-title">
                Closed/Cleared <TrendingUp size={18} color="#10b981" />
              </div>
              <div className="metric-value">{stats.closed}</div>
              <div className="metric-subtitle">Resolved incidents</div>
            </div>
          </div>

          <div
            className="dashboard-grid mb-10"
            style={{ gridTemplateColumns: "1.5fr 1fr" }}
          >
            {/* Trend Chart */}
            <div className="glass-panel p-8">
              <h3 className="flex items-center gap-3 mb-8 text-xl font-semibold">
                <Clock size={24} color="var(--accent)" />
                Incident Trend
              </h3>
              <div style={{ height: "300px", width: "100%" }}>
                <ResponsiveContainer>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient
                        id="colorCount"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--accent)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--accent)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.9)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--accent)"
                      fillOpacity={1}
                      fill="url(#colorCount)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Impacted Links */}
            <div className="glass-panel p-8">
              <h3 className="flex items-center gap-3 mb-8 text-xl font-semibold">
                <Network size={24} color="var(--accent)" />
                Most Impacted Links
              </h3>
              <div className="flex flex-col gap-5">
                {stats.topLinks.length > 0 ? (
                  stats.topLinks.map(([link, count], i) => (
                    <div
                      key={link}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                          style={{
                            background: COLORS[i % COLORS.length] + "20",
                            color: COLORS[i % COLORS.length],
                          }}
                        >
                          {i + 1}
                        </div>
                        <span className="font-medium text-sm">{link}</span>
                      </div>
                      <span className="badge badge-warning">{count} hits</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-10 text-secondary">
                    No link data found in titles
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Main Data Table */}
          <div className="glass-panel overflow-hidden mt-10 shadow-2xl">
            <div className="p-8 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="flex items-center gap-3 text-xl font-semibold">
                <FileSpreadsheet size={24} color="var(--accent)" />
                Transmission Incident Logs (Active Cases)
              </h3>
            </div>
            <div
              className="table-container"
              style={{ maxHeight: "500px", overflowY: "auto" }}
            >
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
                  <tr>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-secondary">
                      Incident
                    </th>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-secondary">
                      Open Time
                    </th>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-secondary">
                      Link (NE {"<>"} FE)
                    </th>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-secondary">
                      Type
                    </th>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-secondary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4 font-medium text-blue-400">
                        {row.id}
                      </td>
                      <td className="p-4 text-sm text-secondary">
                        {row.openTime.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div
                          className="max-w-md truncate text-sm font-medium text-white"
                          title={row.title}
                        >
                          {row.title}
                        </div>
                      </td>
                      <td className="p-4 text-sm">{row.outageType}</td>
                      <td className="p-4">
                        <span
                          className={`badge ${
                            row.status.toLowerCase().includes("open")
                              ? "badge-danger"
                              : row.status.toLowerCase().includes("active")
                                ? "badge-warning"
                                : "badge-success"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransmissionDashboard;
