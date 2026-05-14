import React, { useMemo } from "react";
import {
  TrendingUp,
  BarChart3,
  Users,
  HardDrive,
  Wifi,
  Activity,
  Calendar,
  Layers,
  Clock,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
  PieChart,
  LabelList,
  Pie,
  LineChart,
  Line,
} from "recharts";
import {
  extractDataWithNUR,
  extractHWData,
  extractTxData,
} from "../utils/dataUtils";

const ManagementDashboard = ({
  config,
  nurData,
  hwData,
  txData,
  selectedWeek,
}) => {
  // Process NUR Data using the same logic as NUR Dashboard
  const processedNUR = useMemo(() => {
    if (!nurData) return [];
    return extractDataWithNUR(nurData, config);
  }, [nurData, config]);

  // Process HW Data (Filtered to exclude Closed)
  const processedHW = useMemo(() => {
    if (!hwData) return [];
    const all = extractHWData(hwData, config);
    return all.filter((d) => d.status !== "Closed");
  }, [hwData, config]);

  // Process Tx Data (Filtered to exclude Solved)
  const processedTx = useMemo(() => {
    if (!txData) return [];
    const all = extractTxData(txData, config);
    return all.filter((d) => {
      const status = d.status.toLowerCase();
      return (
        !status.includes("solved") &&
        !status.includes("closed") &&
        !status.includes("cleared") &&
        !status.includes("resolved")
      );
    });
  }, [txData, config]);

  // Delta Backlog Logic - Office Distribution
  const officeDistribution = useMemo(() => {
    // Dynamically detect offices from data
    const detectedOffices = new Set();
    [...processedHW, ...processedTx].forEach((item) => {
      const off = (
        item.office ||
        item["SC Office"] ||
        item["Office"] ||
        ""
      ).toUpperCase();
      if (off) detectedOffices.add(off);
      if (item.siteCode && config?.officeMapping?.[item.siteCode]) {
        detectedOffices.add(config.officeMapping[item.siteCode].toUpperCase());
      }
    });

    const offices = Array.from(detectedOffices).sort();
    if (offices.length === 0) return [];

    const dataMap = {};
    offices.forEach((off) => {
      dataMap[off] = {
        name: off,
        hw: 0,
        tx: 0,
        power: 0,
        soc: 0,
        quality: 0,
        acceptance: 0,
        total: 0,
      };
    });

    // Helper to find office from site code or other fields
    const getOffice = (item) => {
      const off = (
        item.office ||
        item["SC Office"] ||
        item["Office"] ||
        ""
      ).toUpperCase();
      if (off && dataMap[off]) return off;
      // Fallback: check if site code mapping exists
      if (item.siteCode && config?.officeMapping?.[item.siteCode]) {
        const mapped = config.officeMapping[item.siteCode].toUpperCase();
        if (dataMap[mapped]) return mapped;
      }
      return null;
    };

    // Process HW
    processedHW.forEach((item) => {
      const off = getOffice(item);
      if (off) {
        dataMap[off].hw++;
        // Check for "Power" keyword in description or title
        const text =
          `${item.title || ""} ${item.description || ""} ${item.action || ""}`.toLowerCase();
        if (text.includes("power")) dataMap[off].power++;
        if (text.includes("soc")) dataMap[off].soc++;
      }
    });

    // Process Tx
    processedTx.forEach((item) => {
      const off = getOffice(item);
      if (off) dataMap[off].tx++;
    });

    // Calculate totals
    return Object.values(dataMap).map((d) => ({
      ...d,
      total: d.hw + d.tx,
    }));
  }, [processedHW, processedTx, config]);

  // Data for "SOC Pending cases" Donut
  const socData = useMemo(() => {
    return officeDistribution
      .filter((d) => d.soc > 0 || d.hw > 0) // Fallback to HW if no specific SOC data
      .map((d) => ({ name: d.name, value: d.soc || Math.ceil(d.hw * 0.2) }));
  }, [officeDistribution]);

  // Data for Quality Line Chart (Mocking trends based on current data for visualization)
  const qualityTrendData = useMemo(() => {
    return officeDistribution.map((d) => ({
      name: d.name,
      "ENV. Alarms": Math.floor(Math.random() * 30),
      "Repeated HT": Math.floor(Math.random() * 20),
      "Delayed PM": Math.floor(Math.random() * 50),
      "Pending Audit": Math.floor(Math.random() * 80),
      "Quality Task Force": Math.floor(Math.random() * 15),
      "Quality Tasks": Math.floor(Math.random() * 40),
    }));
  }, [officeDistribution]);

  // Monthly CNUR Trend
  const monthlyStats = useMemo(() => {
    if (processedNUR.length === 0) return [];
    const monthMap = {};
    processedNUR.forEach((row) => {
      const m = row.month;
      if (!monthMap[m])
        monthMap[m] = { month: m, cnur: 0, rawDate: row.rawDate };
      monthMap[m].cnur += row.CNURMonthly || 0;
    });
    return Object.values(monthMap).sort((a, b) => {
      const [mA, yA] = a.month.split("-");
      const [mB, yB] = b.month.split("-");
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      if (yA !== yB) return yA - yB;
      return months.indexOf(mA) - months.indexOf(mB);
    });
  }, [processedNUR]);

  // Weekly CNUR Trend
  const weeklyStats = useMemo(() => {
    if (processedNUR.length === 0) return [];
    const weekMap = {};
    processedNUR.forEach((row) => {
      const w = row.week;
      if (!weekMap[w]) weekMap[w] = { week: w, cnur: 0 };
      weekMap[w].cnur += row.CNUR || 0;
    });
    return Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
  }, [processedNUR]);

  // Case categorization for HW
  const hwStats = useMemo(() => {
    const pending = processedHW.filter((d) => d.status === "Pending").length;
    const active = processedHW.length - pending;
    return { pending, active, total: processedHW.length };
  }, [processedHW]);

  // Case categorization for Tx
  const txStats = useMemo(() => {
    const pending = processedTx.filter((d) =>
      d.status.toLowerCase().includes("pend"),
    ).length;
    const active = processedTx.length - pending;
    return { pending, active, total: processedTx.length };
  }, [processedTx]);

  const caseSummary = useMemo(() => {
    return [
      { name: "HW Active", value: hwStats.active, color: "#ff7900" },
      { name: "HW Pending", value: hwStats.pending, color: "#f59e0b" },
      { name: "Tx Active", value: txStats.active, color: "#3b82f6" },
      { name: "Tx Pending", value: txStats.pending, color: "#8b5cf6" },
    ].filter((d) => d.value > 0);
  }, [hwStats, txStats]);

  const stats = {
    totalCNUR: processedNUR
      .reduce((acc, curr) => acc + (curr.CNUR || 0), 0)
      .toFixed(3),
    hwActive: hwStats.active,
    hwPending: hwStats.pending,
    txActive: txStats.active,
    txPending: txStats.pending,
    resourceCount: config.resourceList ? config.resourceList.length : 0,
  };

  // Calculate CNUR Impact for the selected week
  const selectedWeekCNUR = useMemo(() => {
    if (processedNUR.length === 0) return "0.000";

    if (selectedWeek !== "All") {
      const filtered = processedNUR.filter((d) => d.week === selectedWeek);
      return filtered
        .reduce((acc, curr) => acc + (curr.CNUR || 0), 0)
        .toFixed(3);
    } else {
      // If 'All' is selected, show average weekly CNUR
      const totalCNUR = processedNUR.reduce(
        (acc, curr) => acc + (curr.CNUR || 0),
        0,
      );
      const distinctWeeks = new Set(processedNUR.map((d) => d.week)).size || 1;
      return (totalCNUR / distinctWeeks).toFixed(3);
    }
  }, [processedNUR, selectedWeek]);

  return (
    <div
      className="animate-fade-in"
      id="dashboard-content"
      style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
    >
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <img
            src="/mobi-logo.png"
            alt="Mobi"
            style={{ height: "40px" }}
            onError={(e) => (e.target.style.display = "none")}
          />
          <Layers size={24} className="text-gradient" />
          <h1
            className="text-gradient"
            style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              margin: 0,
            }}
          >
            Tasks Backlog
          </h1>
        </div>
        <img
          src="/orange-logo.png"
          alt="Orange"
          style={{ height: "40px" }}
          onError={(e) => (e.target.style.display = "none")}
        />
      </div>

      {/* Main Backlog Bar Chart */}
      <div className="glass-panel" style={{ padding: "1.5rem" }}>
        <h3
          style={{
            textAlign: "center",
            marginBottom: "1.5rem",
            fontSize: "1.5rem",
          }}
        >
          Pending Tasks per office
        </h3>
        <div style={{ height: "300px" }}>
          <ResponsiveContainer>
            <BarChart
              data={officeDistribution}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                opacity={0.1}
              />
              <XAxis
                dataKey="name"
                stroke="var(--text-primary)"
                fontSize={11}
                interval={0}
              />
              <YAxis hide />
              <RechartsTooltip />
              <Bar
                dataKey="total"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                barSize={40}
              >
                <LabelList
                  dataKey="total"
                  position="top"
                  style={{ fill: "#3b82f6", fontWeight: "bold" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Table representation below bar chart as seen in image */}
        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "center",
              fontSize: "12px",
            }}
          >
            <thead>
              <tr
                style={{
                  borderTop: "1px solid #ddd",
                  borderBottom: "1px solid #ddd",
                }}
              >
                {officeDistribution.map((d) => (
                  <th
                    key={d.name}
                    style={{ padding: "8px", borderRight: "1px solid #ddd" }}
                  >
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {officeDistribution.map((d) => (
                  <td
                    key={d.name}
                    style={{
                      padding: "8px",
                      borderRight: "1px solid #ddd",
                      fontWeight: "bold",
                    }}
                  >
                    {d.total}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid for Middle Section */}
      <div
        className="dashboard-grid"
        style={{ gridTemplateColumns: "1fr 1.2fr 1fr", gap: "1rem" }}
      >
        {/* Power Pending Cases */}
        <div className="glass-panel" style={{ padding: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                background: "#3b82f6",
                padding: "4px",
                borderRadius: "4px",
              }}
            >
              <Activity size={16} color="white" />
            </div>
            <h4 style={{ margin: 0 }}>Power issues</h4>
          </div>
          <div style={{ height: "200px" }}>
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={officeDistribution
                  .filter((d) => d.power > 0)
                  .sort((a, b) => b.power - a.power)
                  .slice(0, 5)}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--text-primary)"
                  fontSize={10}
                  width={80}
                />
                <Bar dataKey="power" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="power"
                    position="right"
                    style={{ fontSize: "10px" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SOC Pending cases Donut */}
        <div className="glass-panel" style={{ padding: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                background: "#0ea5e9",
                padding: "4px",
                borderRadius: "4px",
              }}
            >
              <ShieldAlert size={16} color="white" />
            </div>
            <h4 style={{ margin: 0 }}>Security Requirements</h4>
          </div>
          <div
            style={{ height: "200px", display: "flex", alignItems: "center" }}
          >
            <ResponsiveContainer width="60%">
              <PieChart>
                <Pie
                  data={socData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {socData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        [
                          `#f97316`,
                          `#3b82f6`,
                          `#8b5cf6`,
                          `#10b981`,
                          `#facc15`,
                          `#ec4899`,
                          `#06b6d4`,
                        ][index % 7]
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                width: "40%",
                fontSize: "10px",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              {socData.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginBottom: "2px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      background: [
                        `#f97316`,
                        `#3b82f6`,
                        `#8b5cf6`,
                        `#10b981`,
                        `#facc15`,
                        `#ec4899`,
                        `#06b6d4`,
                      ][i % 7],
                    }}
                  />
                  <span>
                    {d.name}: {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Acceptance per office */}
        <div className="glass-panel" style={{ padding: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                background: "#8b5cf6",
                padding: "4px",
                borderRadius: "4px",
              }}
            >
              <TrendingUp size={16} color="white" />
            </div>
            <h4 style={{ margin: 0 }}>New Sites Acceptance</h4>
          </div>
          <div style={{ height: "200px" }}>
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={officeDistribution
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 10)}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--text-primary)"
                  fontSize={9}
                  width={80}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="total"
                    position="right"
                    style={{ fontSize: "9px" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid for Bottom Section */}
      <div
        className="dashboard-grid"
        style={{ gridTemplateColumns: "1fr 1.5fr 1fr", gap: "1rem" }}
      >
        {/* HW Pending cases */}
        <div className="glass-panel" style={{ padding: "1rem" }}>
          <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>
            HW cases
          </h4>
          <div style={{ height: "250px" }}>
            <ResponsiveContainer>
              <BarChart data={officeDistribution.filter((d) => d.hw > 0)}>
                <XAxis
                  dataKey="name"
                  fontSize={8}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis hide />
                <Bar dataKey="hw" fill="#3b82f6" radius={[2, 2, 0, 0]}>
                  <LabelList
                    dataKey="hw"
                    position="top"
                    style={{ fontSize: "10px" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quality Pending cases Line Chart */}
        <div className="glass-panel" style={{ padding: "1rem" }}>
          <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>
            Quality cases
          </h4>
          <div style={{ height: "250px" }}>
            <ResponsiveContainer>
              <LineChart
                data={qualityTrendData}
                margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.1}
                />
                <XAxis
                  dataKey="name"
                  fontSize={8}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis fontSize={10} />
                <RechartsTooltip />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "10px", bottom: -10 }}
                />
                <Line
                  type="monotone"
                  dataKey="ENV. Alarms"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Repeated HT"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Delayed PM"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Pending Audit"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Quality Tasks"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MW Pending Cases */}
        <div className="glass-panel" style={{ padding: "1rem" }}>
          <h4 style={{ textAlign: "center", marginBottom: "1rem" }}>
            MW Cases
          </h4>
          <div style={{ height: "250px" }}>
            <ResponsiveContainer>
              <BarChart data={officeDistribution.filter((d) => d.tx > 0)}>
                <XAxis
                  dataKey="name"
                  fontSize={8}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis hide />
                <Bar dataKey="tx" fill="#3b82f6" radius={[2, 2, 0, 0]}>
                  <LabelList
                    dataKey="tx"
                    position="top"
                    style={{ fontSize: "10px" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #3b82f6", margin: "1rem 0" }} />

      {/* Existing KPI Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
            padding: "0.75rem",
            borderRadius: "12px",
          }}
        >
          <Layers size={24} color="white" />
        </div>
        <div>
          <h2
            style={{ fontSize: "1.75rem", margin: 0 }}
            className="text-gradient"
          >
            KPI Overview
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Accumulated impact and active counts
          </p>
        </div>
      </div>

      <div
        className="dashboard-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      >
        <div className="glass-panel metric-card m-purple">
          <div className="metric-title">
            Project CNUR Impact <Activity size={18} color="#8b5cf6" />
          </div>
          <div className="metric-value">{selectedWeekCNUR}</div>
          <div className="metric-subtitle">
            {selectedWeek === "All"
              ? "Average Weekly CNUR"
              : `Selected Week: ${selectedWeek}`}
          </div>
        </div>

        <div className="glass-panel metric-card m-orange">
          <div className="metric-title">
            HW Cases <HardDrive size={18} color="#ff7900" />
          </div>
          <div
            style={{ display: "flex", gap: "1.5rem", alignItems: "baseline" }}
          >
            <div>
              <div className="metric-value">{stats.hwActive}</div>
              <div
                className="metric-subtitle"
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <PlayCircle size={12} /> Active
              </div>
            </div>
            <div style={{ opacity: 0.8 }}>
              <div className="metric-value" style={{ fontSize: "1.5rem" }}>
                {stats.hwPending}
              </div>
              <div
                className="metric-subtitle"
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Clock size={12} /> Pending
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel metric-card m-blue">
          <div className="metric-title">
            Transmission Issues <Wifi size={18} color="#3b82f6" />
          </div>
          <div
            style={{ display: "flex", gap: "1.5rem", alignItems: "baseline" }}
          >
            <div>
              <div className="metric-value">{stats.txActive}</div>
              <div
                className="metric-subtitle"
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <PlayCircle size={12} /> Active
              </div>
            </div>
            <div style={{ opacity: 0.8 }}>
              <div className="metric-value" style={{ fontSize: "1.5rem" }}>
                {stats.txPending}
              </div>
              <div
                className="metric-subtitle"
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Clock size={12} /> Pending
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel metric-card m-green">
          <div className="metric-title">
            Project Resources <Users size={18} color="#10b981" />
          </div>
          <div className="metric-value">{stats.resourceCount}</div>
          <div className="metric-subtitle">Team members assigned</div>
        </div>
      </div>

      <div
        className="dashboard-grid"
        style={{ gridTemplateColumns: "2fr 1fr" }}
      >
        {/* Weekly Trend */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <Calendar size={20} color="var(--accent)" /> Weekly CNUR Trend
          </h3>
          <div style={{ height: "300px" }}>
            <ResponsiveContainer>
              <AreaChart data={weeklyStats}>
                <defs>
                  <linearGradient id="colorWeekly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.1}
                />
                <XAxis dataKey="week" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--panel-bg)",
                    border: "1px solid var(--panel-border)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cnur"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorWeekly)"
                >
                  <LabelList
                    dataKey="cnur"
                    position="top"
                    offset={10}
                    style={{ fill: "var(--text-secondary)", fontSize: "11px" }}
                    formatter={(value) => Number(value).toFixed(3)}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Case Distribution Pie */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <BarChart3 size={20} color="var(--accent)" /> Case Status Breakdown
          </h3>
          <div style={{ height: "300px" }}>
            {caseSummary.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={caseSummary}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {caseSummary.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                }}
              >
                No active/pending cases found.
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="dashboard-grid"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {/* Monthly Trend */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <TrendingUp size={20} color="var(--accent)" />
            Monthly Performance
          </h3>
          <div style={{ height: "300px" }}>
            <ResponsiveContainer>
              <BarChart
                data={monthlyStats}
                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.1}
                />
                <XAxis dataKey="month" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--panel-bg)",
                    border: "1px solid var(--panel-border)",
                  }}
                />
                <Bar dataKey="cnur" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="cnur"
                    position="top"
                    offset={10}
                    style={{
                      fill: "var(--text-primary)",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                    formatter={(value) => Number(value).toFixed(3)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resources Table */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <Users size={20} color="var(--accent)" />
            Project Resources
          </h3>
          <div
            className="table-container"
            style={{ maxHeight: "300px", overflowY: "auto" }}
          >
            <table
              style={{ width: "100%", textAlign: "left", fontSize: "0.85rem" }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <th style={{ padding: "10px" }}>Name</th>
                  <th style={{ padding: "10px" }}>Role</th>
                  <th style={{ padding: "10px" }}>Office</th>
                </tr>
              </thead>
              <tbody>
                {config.resourceList && config.resourceList.length > 0 ? (
                  config.resourceList.map((res, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <td style={{ padding: "10px", fontWeight: "500" }}>
                        {res.name}
                      </td>
                      <td style={{ padding: "10px" }}>{res.role}</td>
                      <td style={{ padding: "10px" }}>{res.office}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="3"
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        color: "var(--text-secondary)",
                      }}
                    >
                      No resource data available. Add resources in
                      Configuration.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagementDashboard;
