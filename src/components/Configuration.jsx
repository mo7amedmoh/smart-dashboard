import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  Database,
  Server,
  Save,
  Upload,
  Target,
  Palette,
} from "lucide-react";
import * as XLSX from "xlsx";

const Configuration = ({ config, setConfig }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState("");
  const fileInputRef = useRef(null);

  const handleDatabaseUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        const mapping = {};
        const officeMapping = {};
        const officesSet = new Set();
        let count = 0;
        rawData.forEach((row) => {
          const keys = Object.keys(row);
          const codeKey = keys.find((k) => {
            const clean = k.toLowerCase().replace(/[\s_]/g, "");
            return clean.includes("code") || clean === "site" || clean === "id";
          });
          const nameKey = keys.find((k) => {
            const clean = k.toLowerCase().replace(/[\s_]/g, "");
            return clean.includes("name");
          });
          const officeKey =
            keys.find((k) =>
              k.toLowerCase().replace(/[\s_]/g, "").includes("office"),
            ) ||
            keys.find((k) => {
              const clean = k.toLowerCase().replace(/[\s_]/g, "");
              return clean.includes("sc office") || clean === "sc office";
            });

          if (codeKey && nameKey && row[codeKey]) {
            const sCode = String(row[codeKey]).trim().toUpperCase();
            mapping[sCode] = String(row[nameKey]).trim();
            if (officeKey && row[officeKey]) {
              const officeName = String(row[officeKey]).trim();
              officeMapping[sCode] = officeName;
              officesSet.add(officeName);
            }
            count++;
          }
        });

        const officesList = Array.from(officesSet).sort();
        const initialTargets = localConfig.officeTargets || {};
        const globalTarget = localConfig.dailyCNURTarget || 1.5;
        officesList.forEach((off) => {
          if (initialTargets[off] === undefined)
            initialTargets[off] = globalTarget; // Default target
        });

        const newConfig = {
          ...localConfig,
          siteDatabase: mapping,
          officeMapping,
          officesList,
          officeTargets: initialTargets,
        };
        setLocalConfig(newConfig);
        setConfig(newConfig);
        alert(
          `Database loaded successfully! Mapped ${count} sites and ${officesList.length} offices.`,
        );
      } catch (err) {
        alert("Failed to parse database file.");
      }
      const ifFile = fileInputRef.current;
      if (ifFile) ifFile.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncDrive = async () => {
    if (!localConfig.googleDriveLink) {
      alert("Please provide a valid Google Drive Link");
      return;
    }

    // Extract ID from link
    const match = localConfig.googleDriveLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      alert("Invalid Google Sheets link. Cannot extract ID.");
      return;
    }
    const id = match[1];
    const sheetName = localConfig.googleDriveSheet || "SiteList";

    const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;

    setIsSyncing(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const csvText = await response.text();

      const wb = XLSX.read(csvText, { type: "string" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws);

      const mapping = {};
      const officeMapping = {};
      const officesSet = new Set();
      let count = 0;
      rawData.forEach((row) => {
        const keys = Object.keys(row);
        const codeKey = keys.find((k) => {
          const clean = k.toLowerCase().replace(/[\s_]/g, "");
          return clean.includes("code") || clean === "site" || clean === "id";
        });
        const nameKey = keys.find((k) => {
          const clean = k.toLowerCase().replace(/[\s_]/g, "");
          return clean.includes("name");
        });
        const officeKey =
          keys.find((k) =>
            k.toLowerCase().replace(/[\s_]/g, "").includes("office"),
          ) ||
          keys.find((k) => {
            const clean = k.toLowerCase().replace(/[\s_]/g, "");
            return (
              clean.includes("zone") ||
              clean.includes("area") ||
              clean === "oz" ||
              clean === "operationzone"
            );
          });

        if (codeKey && nameKey && row[codeKey]) {
          const sCode = String(row[codeKey]).trim().toUpperCase();
          mapping[sCode] = String(row[nameKey]).trim();
          if (officeKey && row[officeKey]) {
            const officeName = String(row[officeKey]).trim();
            officeMapping[sCode] = officeName;
            officesSet.add(officeName);
          }
          count++;
        }
      });

      if (count > 0) {
        const officesList = Array.from(officesSet).sort();
        const initialTargets = localConfig.officeTargets || {};
        const globalTarget = localConfig.dailyCNURTarget || 1.5;
        officesList.forEach((off) => {
          if (initialTargets[off] === undefined)
            initialTargets[off] = globalTarget; // Default target
        });

        const newConfig = {
          ...localConfig,
          siteDatabase: mapping,
          officeMapping,
          officesList,
          officeTargets: initialTargets,
        };
        setLocalConfig(newConfig);
        setConfig(newConfig);
        alert(
          `Successfully synced from Google Drive! Mapped ${count} sites and ${officesList.length} offices.`,
        );
      } else {
        alert(`No Site Code / Site Name mapping found in sheet: ${sheetName}`);
      }
    } catch (err) {
      console.error(err);
      alert(
        "Failed to fetch from Google Drive. Ensure the sheet is 'Anyone with the link can view'.",
      );
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setLocalConfig((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSave = () => {
    setConfig(localConfig);
    setSaveStatus("Saved successfully!");
    setTimeout(() => setSaveStatus(""), 3000);
  };

  const handleTargetChange = (office, value) => {
    setLocalConfig((prev) => ({
      ...prev,
      officeTargets: {
        ...prev.officeTargets,
        [office]: Number(value),
      },
    }));
  };

  return (
    <div
      className="animate-fade-in"
      id="dashboard-content"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        padding: "1rem",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
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
            background:
              "linear-gradient(135deg, var(--accent), var(--accent-glow))",
            padding: "0.75rem",
            borderRadius: "12px",
          }}
        >
          <Settings size={28} color="white" />
        </div>
        <div>
          <h2 style={{ fontSize: "2rem", margin: 0 }} className="text-gradient">
            Configuration
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Manage your application settings and database connections.
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "2rem" }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.25rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--glass-border)",
            paddingBottom: "0.5rem",
          }}
        >
          <Palette size={20} color="var(--accent)" />
          Theme Appearance
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          Choose a visual style for the dashboard.
        </p>

        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div
            onClick={() => setLocalConfig({ ...localConfig, theme: "default" })}
            style={{
              flex: "1 1 200px",
              cursor: "pointer",
              padding: "1rem",
              borderRadius: "12px",
              border: `2px solid ${localConfig.theme !== "orange" && localConfig.theme !== "orange-bright" && localConfig.theme !== "mobi" && localConfig.theme !== "nokia" ? "var(--accent)" : "transparent"}`,
              background: "rgba(255,255,255,0.03)",
              transition: "all 0.3s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "60px",
                background: "#0f172a",
                borderRadius: "8px",
                marginBottom: "0.75rem",
                display: "flex",
                gap: "4px",
                padding: "8px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "100%",
                  background: "#3b82f6",
                  borderRadius: "4px",
                }}
              ></div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    height: "10px",
                    width: "60%",
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: "2px",
                  }}
                ></div>
                <div
                  style={{
                    height: "10px",
                    width: "100%",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "2px",
                  }}
                ></div>
              </div>
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Default Dark
            </span>
          </div>

          <div
            onClick={() => setLocalConfig({ ...localConfig, theme: "orange" })}
            style={{
              flex: "1 1 200px",
              cursor: "pointer",
              padding: "1rem",
              borderRadius: "12px",
              border: `2px solid ${localConfig.theme === "orange" ? "#ff7900" : "transparent"}`,
              background: "rgba(255,255,255,0.03)",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                height: "60px",
                background: "#000000",
                borderRadius: "8px",
                marginBottom: "0.75rem",
                display: "flex",
                gap: "4px",
                padding: "8px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "100%",
                  background: "#ff7900",
                  borderRadius: "4px",
                }}
              ></div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    height: "10px",
                    width: "60%",
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: "2px",
                  }}
                ></div>
                <div
                  style={{
                    height: "10px",
                    width: "100%",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "2px",
                  }}
                ></div>
              </div>
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Orange.eg Style
            </span>
          </div>

          <div
            onClick={() =>
              setLocalConfig({ ...localConfig, theme: "orange-bright" })
            }
            style={{
              flex: "1 1 200px",
              cursor: "pointer",
              padding: "1rem",
              borderRadius: "12px",
              border: `2px solid ${localConfig.theme === "orange-bright" ? "#ff7900" : "transparent"}`,
              background: "rgba(0,0,0,0.03)",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                height: "60px",
                background: "#f8fafc",
                borderRadius: "8px",
                marginBottom: "0.75rem",
                display: "flex",
                gap: "4px",
                padding: "8px",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "100%",
                  background: "#ff7900",
                  borderRadius: "4px",
                }}
              ></div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    height: "10px",
                    width: "60%",
                    background: "rgba(0,0,0,0.1)",
                    borderRadius: "2px",
                  }}
                ></div>
                <div
                  style={{
                    height: "10px",
                    width: "100%",
                    background: "rgba(0,0,0,0.05)",
                    borderRadius: "2px",
                  }}
                ></div>
              </div>
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Orange Bright
            </span>
          </div>

          <div
            onClick={() => setLocalConfig({ ...localConfig, theme: "mobi" })}
            style={{
              flex: "1 1 200px",
              cursor: "pointer",
              padding: "1rem",
              borderRadius: "12px",
              border: `2px solid ${localConfig.theme === "mobi" ? "#8cc63f" : "transparent"}`,
              background: "rgba(0,0,0,0.03)",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                height: "60px",
                background: "#ffffff",
                borderRadius: "8px",
                marginBottom: "0.75rem",
                display: "flex",
                gap: "4px",
                padding: "8px",
                border: "1px solid rgba(0,0,0,0.1)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: "-10px",
                  left: "-10px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "4px solid rgba(140, 198, 63, 0.3)",
                }}
              ></div>
              <div
                style={{
                  width: "20px",
                  height: "100%",
                  background: "#1f497d",
                  borderRadius: "4px",
                  zIndex: 1,
                }}
              ></div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    height: "10px",
                    width: "60%",
                    background: "rgba(0,0,0,0.1)",
                    borderRadius: "2px",
                  }}
                ></div>
                <div
                  style={{
                    height: "10px",
                    width: "100%",
                    background: "rgba(0,0,0,0.05)",
                    borderRadius: "2px",
                  }}
                ></div>
              </div>
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Mobi Corporate
            </span>
          </div>

          <div
            onClick={() => setLocalConfig({ ...localConfig, theme: "nokia" })}
            style={{
              flex: "1 1 200px",
              cursor: "pointer",
              padding: "1rem",
              borderRadius: "12px",
              border: `2px solid ${localConfig.theme === "nokia" ? "#124191" : "transparent"}`,
              background: "rgba(0,0,0,0.03)",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                height: "60px",
                background: "#f8fafc",
                borderRadius: "8px",
                marginBottom: "0.75rem",
                display: "flex",
                gap: "4px",
                padding: "8px",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "100%",
                  background: "#124191",
                  borderRadius: "4px",
                }}
              ></div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    height: "10px",
                    width: "60%",
                    background: "rgba(0,0,0,0.1)",
                    borderRadius: "2px",
                  }}
                ></div>
                <div
                  style={{
                    height: "10px",
                    width: "100%",
                    background: "rgba(0,0,0,0.05)",
                    borderRadius: "2px",
                  }}
                ></div>
              </div>
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Nokia Corporate
            </span>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "2rem" }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.25rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--glass-border)",
            paddingBottom: "0.5rem",
          }}
        >
          <Database size={20} color="var(--accent)" />
          Database Connection
        </h3>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              Site Database (Excel File)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleDatabaseUpload}
                ref={fileInputRef}
                style={{ display: "none" }}
                id="db-upload"
              />
              <label
                htmlFor="db-upload"
                className="btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "8px",
                  border: "1px solid var(--glass-border)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <Upload size={18} />
                Upload Local Database
              </label>
              {localConfig.siteDatabase && (
                <span
                  style={{
                    color: "var(--success)",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  ✓ {Object.keys(localConfig.siteDatabase).length} sites loaded
                </span>
              )}
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              Upload an Excel file containing "Site Code" and "Site Name"
              columns. This maps the site names automatically in the NUR
              dashboards.
            </p>
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              Google Drive Database Link
            </label>
            <input
              type="text"
              name="googleDriveLink"
              value={localConfig.googleDriveLink || ""}
              onChange={handleChange}
              placeholder="e.g. https://docs.google.com/spreadsheets/d/1BxiMVs..."
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              Subsheet Name
            </label>
            <input
              type="text"
              name="googleDriveSheet"
              value={localConfig.googleDriveSheet || "SiteList"}
              onChange={handleChange}
              placeholder="e.g. SiteList"
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div>
            <button
              className="btn-primary"
              onClick={handleSyncDrive}
              disabled={isSyncing}
              style={{ padding: "0.75rem 1.5rem", width: "max-content" }}
            >
              {isSyncing ? "Syncing..." : "Sync Database from Google Drive"}
            </button>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              Pulls directly from Google Drive (Make sure link sharing is set to
              'Anyone with link').
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "2rem" }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.25rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--glass-border)",
            paddingBottom: "0.5rem",
          }}
        >
          <Server size={20} color="#10b981" />
          Network & Target Configuration
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          Define the total number of cells for each technology and set
          performance targets.
        </p>

        <div
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "12px",
            border: "1px solid var(--glass-border)",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              fontWeight: "600",
            }}
          >
            Global Daily CNUR Target
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <input
              type="number"
              name="dailyCNURTarget"
              step="0.1"
              value={localConfig.dailyCNURTarget || 1.5}
              onChange={handleChange}
              style={{
                width: "120px",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <span
              style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}
            >
              Rows in the daily table exceeding this value will be highlighted.
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              2G Cells
            </label>
            <input
              type="number"
              name="cells2G"
              value={localConfig.cells2G || 0}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              3G Cells
            </label>
            <input
              type="number"
              name="cells3G"
              value={localConfig.cells3G || 0}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              4G Cells
            </label>
            <input
              type="number"
              name="cells4G"
              value={localConfig.cells4G || 0}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              5G Cells
            </label>
            <input
              type="number"
              name="cells5G"
              value={localConfig.cells5G || 0}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--glass-border)",
                background: "rgba(0,0,0,0.2)",
                color: "white",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "8px",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>
              Total Configured Cells (Sum)
            </span>
            <span
              style={{
                fontSize: "1.5rem",
                fontWeight: "700",
                color: "var(--accent)",
              }}
            >
              {Number(localConfig.cells2G || 0) +
                Number(localConfig.cells3G || 0) +
                Number(localConfig.cells4G || 0) +
                Number(localConfig.cells5G || 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "2rem" }}>
        <h3
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.25rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--glass-border)",
            paddingBottom: "0.5rem",
          }}
        >
          <Target size={20} color="var(--accent)" />
          Office CNUR Targets
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          Define the CNUR performance target for each office extracted from your
          site list.
        </p>

        {localConfig.officesList && localConfig.officesList.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {localConfig.officesList.map((office) => (
              <div
                key={office}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {office}
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <input
                    type="number"
                    step="0.1"
                    value={localConfig.officeTargets?.[office] ?? 1.5}
                    onChange={(e) => handleTargetChange(office, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid var(--glass-border)",
                      background: "rgba(0,0,0,0.2)",
                      color: "white",
                      outline: "none",
                      width: "100%",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    CNUR
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--text-secondary)",
              background: "rgba(255,255,255,0.01)",
              borderRadius: "8px",
              border: "1px dashed var(--glass-border)",
            }}
          >
            No offices found. Please sync your Site List database above first.
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {saveStatus && (
          <span
            style={{
              color: "var(--success)",
              fontSize: "0.875rem",
              animation: "fadeIn 0.3s ease-in",
            }}
          >
            {saveStatus}
          </span>
        )}
        <button
          className="btn-primary"
          onClick={handleSave}
          style={{ padding: "0.75rem 2rem" }}
        >
          <Save size={18} />
          Save Configuration
        </button>
      </div>
    </div>
  );
};

export default Configuration;
