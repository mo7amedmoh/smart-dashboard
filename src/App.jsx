import React, { useState, useEffect } from "react";
import {
  Activity,
  HardDrive,
  Wifi,
  ShieldAlert,
  AlertTriangle,
  Download,
  Settings,
  Layers,
  ChevronDown,
} from "lucide-react";
import NURDashboard from "./components/NURDashboard";
import NetworkHWDashboard from "./components/NetworkHWDashboard";
import TransmissionDashboard from "./components/TransmissionDashboard";
import ManagementDashboard from "./components/ManagementDashboard";
import Configuration from "./components/Configuration";
import html2canvas from "html2canvas";

const PlaceholderDashboard = ({ title }) => (
  <div
    className="glass-panel animate-fade-in"
    id="dashboard-content"
    style={{ padding: "4rem", textAlign: "center", marginTop: "2rem" }}
  >
    <h2
      className="text-gradient"
      style={{ fontSize: "2rem", marginBottom: "1rem" }}
    >
      {title} Dashboard
    </h2>
    <p style={{ color: "var(--text-secondary)" }}>
      This module is currently under development. Upload functionality and
      analytics will be available soon.
    </p>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState("Management");
  const [isExporting, setIsExporting] = useState(false);
  const [config, setConfigState] = useState(() => {
    const saved = localStorage.getItem("mobi_dashboard_config");
    const defaultConfig = {
      googleDriveLink:
        "https://docs.google.com/spreadsheets/d/1XwQTSMI5Nz0WuKwSow06dVmTlnoyZOuj/edit?usp=sharing",
      googleDriveSheet: "SiteList",
      siteDatabase: {},
      cells2G: 0,
      cells3G: 0,
      cells4G: 0,
      cells5G: 0,
      theme: "default",
    };
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  });

  const [nurData, setNurData] = useState(null);
  const [networkHWData, setNetworkHWData] = useState(null);
  const [txIssueData, setTxIssueData] = useState(null);
  const [socReqData, setSocReqData] = useState(null);
  const [externalAlarmsData, setExternalAlarmsData] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState("All");

  useEffect(() => {
    let themeClass = "";
    if (config.theme === "orange") themeClass = "theme-orange";
    else if (config.theme === "orange-bright")
      themeClass = "theme-orange-bright";
    else if (config.theme === "mobi") themeClass = "theme-mobi";
    else if (config.theme === "nokia") themeClass = "theme-nokia";
    document.body.className = themeClass;
  }, [config.theme]);

  const setConfig = (newConfig) => {
    setConfigState(newConfig);
    localStorage.setItem("mobi_dashboard_config", JSON.stringify(newConfig));
  };

  const handleExport = async () => {
    const dashboardElement = document.getElementById("dashboard-content");
    if (!dashboardElement) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardElement, {
        backgroundColor:
          config.theme === "orange-bright"
            ? "#f8fafc"
            : config.theme === "orange"
              ? "#000000"
              : config.theme === "mobi"
                ? "#ffffff"
                : config.theme === "nokia"
                  ? "#f8fafc"
                  : "#0f172a",
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const image = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.download = `${activeTab}-Dashboard-${new Date().toISOString().split("T")[0]}.png`;
      link.href = image;
      link.click();
    } catch (err) {
      console.error("Failed to export image", err);
    } finally {
      setIsExporting(false);
    }
  };

  const navItems = [
    { id: "Management", label: "Management", icon: Layers },
    { id: "NUR", label: "NUR", icon: Activity },
    { id: "NetworkHW", label: "Network HW", icon: HardDrive },
    { id: "TxIssue", label: "Tx Issue", icon: Wifi },
    {
      id: "PlannedActivities",
      label: "Planned Activities",
      icon: ShieldAlert,
      children: [
        { id: "SocReq", label: "Soc Requirements" },
        { id: "ExternalAlarms", label: "External Alarms" },
        { id: "NewSitesAcceptance", label: "New Sites Acceptance" },
        { id: "PMTracking", label: "PM Tracking" },
        { id: "PowerActions", label: "Power Actions" },
        { id: "HTAnalysis", label: "HT Analysis" },
        { id: "BDTAnalysis", label: "BDT Analysis" },
      ],
    },
    { id: "Configuration", label: "Configuration", icon: Settings },
  ];

  return (
    <div className="app-container">
      <nav className="glass-nav" style={{ padding: "1rem 2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1400px",
            margin: "0 auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                background: config.theme?.includes("orange")
                  ? "linear-gradient(135deg, #ff7900, #ffb366)"
                  : config.theme === "mobi"
                    ? "linear-gradient(135deg, #8cc63f, #4fb5b5)"
                    : config.theme === "nokia"
                      ? "linear-gradient(135deg, #124191, #3b82f6)"
                      : "linear-gradient(135deg, var(--accent), #8b5cf6)",
                padding: "0.5rem",
                borderRadius: "12px",
              }}
            >
              <Activity size={24} color="white" />
            </div>
            <h1
              style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700 }}
              className="text-gradient"
            >
              Mobi Dashboard
            </h1>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isActive =
                activeTab === item.id ||
                (item.children &&
                  item.children.some((child) => child.id === activeTab));

              if (hasChildren) {
                return (
                  <div
                    key={item.id}
                    className={`nav-dropdown ${isActive ? "active" : ""}`}
                  >
                    <button className={`nav-link ${isActive ? "active" : ""}`}>
                      <Icon size={18} />
                      {item.label}
                      <ChevronDown size={14} className="chevron" />
                    </button>
                    <div className="dropdown-content">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          className={`dropdown-item ${activeTab === child.id ? "active" : ""}`}
                          onClick={() => setActiveTab(child.id)}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  className={`nav-link ${activeTab === item.id ? "active" : ""}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download
              size={18}
              className={isExporting ? "animate-pulse" : ""}
            />
            {isExporting ? "Exporting..." : "Export Image"}
          </button>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === "Management" && (
          <ManagementDashboard
            config={config}
            nurData={nurData}
            hwData={networkHWData}
            txData={txIssueData}
            selectedWeek={selectedWeek}
          />
        )}
        {activeTab === "NUR" && (
          <NURDashboard
            config={config}
            data={nurData}
            setData={setNurData}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
          />
        )}
        {activeTab === "NetworkHW" && (
          <NetworkHWDashboard
            config={config}
            data={networkHWData}
            setData={setNetworkHWData}
          />
        )}
        {activeTab === "TxIssue" && (
          <TransmissionDashboard
            config={config}
            data={txIssueData}
            setData={setTxIssueData}
          />
        )}
        {activeTab === "SocReq" && (
          <PlaceholderDashboard title="SOC Requirements" />
        )}
        {activeTab === "ExternalAlarms" && (
          <PlaceholderDashboard title="External Alarms" />
        )}
        {activeTab === "NewSitesAcceptance" && (
          <PlaceholderDashboard title="New Sites Acceptance" />
        )}
        {activeTab === "PMTracking" && (
          <PlaceholderDashboard title="PM Tracking" />
        )}
        {activeTab === "PowerActions" && (
          <PlaceholderDashboard title="Power Actions" />
        )}
        {activeTab === "HTAnalysis" && (
          <PlaceholderDashboard title="HT Analysis" />
        )}
        {activeTab === "BDTAnalysis" && (
          <PlaceholderDashboard title="BDT Analysis" />
        )}
        {activeTab === "Configuration" && (
          <Configuration config={config} setConfig={setConfig} />
        )}
      </main>
    </div>
  );
}

export default App;
