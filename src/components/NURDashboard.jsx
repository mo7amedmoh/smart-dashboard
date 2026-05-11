import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Target,
  TrendingDown,
  TrendingUp,
  AlertOctagon,
  Activity,
  Calendar,
  Clock,
  Settings,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldAlert,
  MapPin,
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
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Cell,
  PieChart,
  Pie,
  LabelList
} from "recharts";
import FileUpload from "./FileUpload";

// Helper to calculate week number starting on Sunday
const getWeekNumberStartingSunday = (date) => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const pastDaysOfYear = (d - startOfYear) / 86400000;
  const firstDayOfYear = startOfYear.getUTCDay(); // 0 is Sunday
  return Math.ceil((pastDaysOfYear + firstDayOfYear + 1) / 7);
};

// Helper to find column keys robustly with optional exclusions
const findKey = (obj, searchStr, excludeStr = null) => {
  if (!obj) return null;
  const keys = Object.keys(obj);
  return keys.find((k) => {
    const lowKey = k.toLowerCase();
    const lowSearch = searchStr.toLowerCase();
    if (!lowKey.includes(lowSearch)) return false;
    if (excludeStr && lowKey.includes(excludeStr.toLowerCase())) return false;
    return true;
  });
};

// Parse Excel duration to minutes
const parseDurationToMins = (val) => {
  if (val == null) return 0;
  if (typeof val === "number") {
    return val * 24 * 60; // Excel decimal fraction of a day
  }
  if (typeof val === "string") {
    const parts = val.split(":");
    if (parts.length === 3) {
      return (
        parseInt(parts[0] || 0, 10) * 60 +
        parseInt(parts[1] || 0, 10) +
        parseInt(parts[2] || 0, 10) / 60
      );
    } else if (parts.length === 2) {
      return parseInt(parts[0] || 0, 10) * 60 + parseInt(parts[1] || 0, 10);
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
};

// Parse Excel date
const parseExcelDate = (val) => {
  if (val == null) return new Date();
  if (typeof val === "number") {
    // Excel serial dates are local times, but the math converts them to UTC timestamps.
    // We extract the UTC components and construct a local Date to prevent timezone shifting.
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds()
    );
  }
  const d = new Date(val);
  if (!isNaN(d)) return d;
  return new Date();
};

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const extractDataWithNUR = (rawData, config) => {
  if (!rawData || !rawData.length) return [];

  const c2G = Number(config?.cells2G) || 0;
  const c3G = Number(config?.cells3G) || 0;
  const c4G = Number(config?.cells4G) || 0;
  const c5G = Number(config?.cells5G) || 0;
  const totalCellsAllConfig = (c2G + c3G + c4G + c5G) || 1;

  let lastTtId = null;

  return rawData
    .map((row) => {
      // Exclusions Check
      const blockedKey = findKey(row, "Blocked");
      const areaKey = findKey(row, "Area");
      const outageTypeKey = findKey(row, "Outage Type");
      const fmKey = findKey(row, "Force Majeure");

      const valBlocked = blockedKey
        ? String(row[blockedKey]).trim().toLowerCase()
        : "";
      const valArea = areaKey ? String(row[areaKey]).trim().toLowerCase() : "";
      const valOutage = outageTypeKey
        ? String(row[outageTypeKey]).trim().toLowerCase()
        : "";
      const valFM = fmKey ? String(row[fmKey]).trim().toLowerCase() : "";

      const isBlocked =
        valBlocked === "true" || valBlocked === "yes" || valBlocked === "1";
      const isLL = valArea === "ll";
      const isVoluntary = valOutage === "voluntary";
      const isFM = valFM === "true" || valFM === "yes" || valFM === "1";

      if (isBlocked || isLL || isVoluntary || isFM) {
        return null; // Exclude this row
      }

      const techKey =
        findKey(row, "Technology") ||
        findKey(row, "Primary Affected Service") ||
        findKey(row, "Affected Item", "Site") ||
        findKey(row, "Tech") ||
        findKey(row, "Network");
      const cellsKey = findKey(row, "Total Cells");
      const durationKey =
        findKey(row, "Incident Duration") || findKey(row, "Duration");
      const weekKey = findKey(row, "Downtime Start Week") || 
                      findKey(row, "Start Week") || 
                      findKey(row, "Week", "end") ||
                      findKey(row, "Week", "close");
      const dateKey = findKey(row, "Downtime Start") || 
                      findKey(row, "Start Date") || 
                      findKey(row, "Start", "end") || 
                      findKey(row, "Date", "end") ||
                      findKey(row, "Date", "close");
      const officeKey = findKey(row, "Office") || findKey(row, "Operation Zone") || findKey(row, "OZ");

      const technology = String(row[techKey] || "").trim();
      let configCells = 0;
      const techUpper = technology.toUpperCase();
      let detectedTech = null;
      
      if (techUpper.includes("2G") || techUpper.includes("GSM")) {
        configCells = c2G;
        detectedTech = "2G";
      } else if (techUpper.includes("3G") || techUpper.includes("UMTS") || techUpper.includes("WCDMA")) {
        configCells = c3G;
        detectedTech = "3G";
      } else if (techUpper.includes("4G") || techUpper.includes("LTE")) {
        configCells = c4G;
        detectedTech = "4G";
      } else if (techUpper.includes("5G") || techUpper.includes("NR")) {
        configCells = c5G;
        detectedTech = "5G";
      }

      if (!technology || technology === "" || technology === "null") {
        return null;
      }

      // Debugging: Log first few rows to help identify issues
      if (rawData.indexOf(row) < 5) {
        console.log(`Row Debug: TechCol="${techKey}", Val="${technology}", Detected="${detectedTech}", Cells=${configCells}`);
      }

      const totalCellsNUR = Number(row[cellsKey]) || 0;
      const durationMins = parseDurationToMins(row[durationKey]) || 0;

      const Nx = totalCellsNUR * durationMins;
      const NUR =
        configCells > 0 ? (100000 * Nx) / (configCells * 7 * 24 * 60) : 0;
      const CNUR =
        (totalCellsAllConfig > 0 && !isNaN(configCells)) ? (NUR * configCells) / totalCellsAllConfig : 0;

      // Monthly NUR Calculation (using 30 days)
      const NURMonthly = configCells > 0 ? (100000 * Nx) / (configCells * 30 * 24 * 60) : 0;
      const CNURMonthly = (totalCellsAllConfig > 0 && !isNaN(configCells)) ? (NURMonthly * configCells) / totalCellsAllConfig : 0;

      let weekStr = "W01";
      let dayName = "Unknown";
      let rawDate = null;
      let dateStr = "Unknown";
      if (dateKey && row[dateKey]) {
        rawDate = parseExcelDate(row[dateKey]);
        dayName = daysOfWeek[rawDate.getDay()];
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
        dateStr = `${rawDate.getDate()}-${months[rawDate.getMonth()]}`;
      }

      let monthStr = "Unknown";
      if (rawDate) {
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          monthStr = `${monthNames[rawDate.getMonth()]}-${rawDate.getFullYear()}`;
      }

      if (weekKey && row[weekKey]) {
        let w = String(row[weekKey]).replace(/\D/g, "");
        if (w) weekStr = `W${w.padStart(2, "0")}`;
        else weekStr = String(row[weekKey]);
      } else if (rawDate) {
        const wNum = getWeekNumberStartingSunday(rawDate);
        weekStr = `W${String(wNum).padStart(2, "0")}`;
      }

      const siteKey =
        findKey(row, "Problem Source Sitecode") ||
        findKey(row, "Site code") ||
        findKey(row, "Site");
      const siteNameKey = findKey(row, "Site Name") || findKey(row, "Name");

      const sCode = siteKey
        ? String(row[siteKey]).trim().toUpperCase()
        : "Unknown_Site";
      let sName = siteNameKey ? row[siteNameKey] : "Unknown";
      let sOffice = officeKey ? row[officeKey] : "Other";

      // Check if uploaded configuration database has a mapping
      if (config?.siteDatabase && config.siteDatabase[sCode]) {
        sName = config.siteDatabase[sCode];
      }
      if (config?.officeMapping && config.officeMapping[sCode]) {
        sOffice = config.officeMapping[sCode];
      }

      let idKey = Object.keys(row).find(k => {
        const lower = k.trim().toLowerCase();
        return [
            "number", "incident number", "ticket number", "fault number", 
            "incident id", "ticket id", "ticket no", "incident no", "alarm id"
        ].includes(lower);
      });

      if (!idKey) {
        idKey = findKey(row, "Incident") || 
                findKey(row, "Ticket") || 
                findKey(row, "Alarm");
      }

      let ttId = idKey ? String(row[idKey] || "").trim() : null;

      // Inherit TT ID from the previous row if current is empty (handles merged cells in Excel)
      if (ttId && ttId !== "null" && ttId !== "") {
          lastTtId = ttId;
      } else if (lastTtId) {
          ttId = lastTtId;
      }

      return {
        ...row,
        ttId,
        parsedTech: technology,
        parsedDurationMins: durationMins,
        siteCode: sCode,
        siteName: sName,
        office: sOffice,
        week: weekStr,
        month: monthStr,
        dayOfWeek: dayName,
        rawDate,
        dateStr,
        Nx,
        NUR,
        CNUR,
        NURMonthly,
        CNURMonthly,
        configCells,
      };
    })
    .filter(Boolean);
};

const NURDashboard = ({ config, data, setData }) => {
  const [selectedWeek, setSelectedWeek] = useState("All");
  const [selectedOZ, setSelectedOZ] = useState("All");
  const [siteComments, setSiteComments] = useState({});
  const [drillDownDay, setDrillDownDay] = useState(null);
  const drillDownRef = useRef(null);
  const themePrimary = config.theme === "orange" ? "#ff7900" : "#3b82f6";
  const themeSecondary = config.theme === "orange" ? "#ffb366" : "#8b5cf6";

  const handleCommentChange = (siteCode, text) => {
    setSiteComments((prev) => ({ ...prev, [siteCode]: text }));
  };

  const processedData = useMemo(() => {
    if (!data) return [];
    return extractDataWithNUR(data, config);
  }, [data, config]);

  const availableWeeks = useMemo(() => {
    const weeks = new Set(processedData.map((d) => d.week));
    return Array.from(weeks).sort();
  }, [processedData]);

  const availableOZs = useMemo(() => {
    const ozs = new Set(processedData.map((d) => d.office).filter(Boolean));
    return Array.from(ozs).sort();
  }, [processedData]);

  useEffect(() => {
    if (
      availableWeeks.length > 0 &&
      !availableWeeks.includes(selectedWeek) &&
      selectedWeek !== "All"
    ) {
      setSelectedWeek(availableWeeks[availableWeeks.length - 1] || "All");
    }
    // Clear drilldown when week changes to avoid stale data
    setDrillDownDay(null);
  }, [availableWeeks, selectedWeek]);

  useEffect(() => {
    if (drillDownDay && drillDownRef.current) {
      drillDownRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [drillDownDay]);

  const filteredData = useMemo(() => {
    let filtered = processedData;
    if (selectedWeek !== "All") {
      filtered = filtered.filter((d) => d.week === selectedWeek);
    }
    if (selectedOZ !== "All") {
      filtered = filtered.filter((d) => d.office === selectedOZ);
    }
    return filtered;
  }, [processedData, selectedWeek, selectedOZ]);

  useEffect(() => {
    if (filteredData.length > 0) {
      const uniqueTTs = Array.from(new Set(filteredData.map(d => d.ttId).filter(Boolean)));
      console.log(`--- Dashboard Debug: ${selectedWeek} ---`);
      console.log(`Unique TT IDs (${uniqueTTs.length}):`, uniqueTTs);
      console.log(`Total data rows:`, filteredData.length);
    }
  }, [filteredData, selectedWeek]);

  const isDataLoaded = processedData.length > 0;

  const stats = useMemo(() => {
    if (!isDataLoaded)
      return {
        totalTx: 0,
        cnur: "N/A",
        bestDay: "--",
        worstDay: "--",
        expectedClosure: "--",
      };

    const totalTx = filteredData.some(d => d.ttId) 
      ? new Set(filteredData.map(d => d.ttId).filter(Boolean)).size 
      : filteredData.length;

    const totalCNUR = filteredData.reduce((acc, curr) => acc + curr.CNUR, 0);
    const distinctWeeks = new Set(filteredData.map((d) => d.week)).size || 1;
    const weeklyCNUR =
      selectedWeek === "All" ? totalCNUR / distinctWeeks : totalCNUR;

    const dayStats = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    };
    let hasDates = false;
    filteredData.forEach((row) => {
      if (row.dayOfWeek !== "Unknown") {
        dayStats[row.dayOfWeek] += row.CNUR;
        hasDates = true;
      }
    });

    let bestDayVal = "--";
    let bestDayName = "--";
    let worstDayVal = "--";
    let worstDayName = "--";
    if (hasDates) {
      const sortedDays = Object.entries(dayStats).sort((a, b) => a[1] - b[1]);
      bestDayName = sortedDays[0][0];
      bestDayVal = sortedDays[0][1].toFixed(3);
      worstDayName = sortedDays[sortedDays.length - 1][0];
      worstDayVal = sortedDays[sortedDays.length - 1][1].toFixed(3);
    }

    let expectedClosureVal = weeklyCNUR;
    if (selectedWeek !== "All" && hasDates) {
      let maxDate = null;
      filteredData.forEach((d) => {
        if (d.rawDate) {
          if (!maxDate || d.rawDate > maxDate) maxDate = d.rawDate;
        }
      });
      if (maxDate) {
        const daysElapsed = maxDate.getDay() + 1;
        if (daysElapsed < 7) {
          expectedClosureVal = (weeklyCNUR / daysElapsed) * 7;
        }
      }
    }

    return {
      totalTx,
      cnur: weeklyCNUR.toFixed(3),
      bestDay: bestDayVal,
      bestDayName,
      worstDay: worstDayVal,
      worstDayName,
      expectedClosure: expectedClosureVal.toFixed(3),
    };
  }, [filteredData, isDataLoaded, selectedWeek]);

  const dailyTableData = useMemo(() => {
    if (!isDataLoaded) return [];
    const dateMap = {};
    filteredData.forEach((row, idx) => {
      const d = row.dateStr || "Unknown";
      const ttIdentifier = row.ttId || `row-${idx}`;

      if (!dateMap[d]) {
        dateMap[d] = {
          date: d,
          rawDate: row.rawDate || new Date(0),
          "2G": { cnur: 0, ttSet: new Set() },
          "3G": { cnur: 0, ttSet: new Set() },
          "4G": { cnur: 0, ttSet: new Set() },
          "5G": { cnur: 0, ttSet: new Set() },
          total: { cnur: 0, ttSet: new Set() },
        };
      }
      const tech = (row.parsedTech || "").toUpperCase();
      let network = null;
      if (tech.includes("2G") || tech.includes("GSM")) network = "2G";
      else if (tech.includes("3G") || tech.includes("UMTS")) network = "3G";
      else if (tech.includes("4G") || tech.includes("LTE")) network = "4G";
      else if (tech.includes("5G") || tech.includes("NR")) network = "5G";
      
      if (network) {
        dateMap[d][network].cnur += row.CNUR;
        dateMap[d][network].ttSet.add(ttIdentifier);
        dateMap[d].total.cnur += row.CNUR;
        dateMap[d].total.ttSet.add(ttIdentifier);
      }
    });

    return Object.values(dateMap).map(day => ({
        ...day,
        "2G": { cnur: day["2G"].cnur, tts: day["2G"].ttSet.size },
        "3G": { cnur: day["3G"].cnur, tts: day["3G"].ttSet.size },
        "4G": { cnur: day["4G"].cnur, tts: day["4G"].ttSet.size },
        "5G": { cnur: day["5G"].cnur, tts: day["5G"].ttSet.size },
        total: { cnur: day.total.cnur, tts: day.total.ttSet.size }
    })).sort((a, b) => a.rawDate - b.rawDate);
  }, [filteredData, isDataLoaded]);

  const tableTotals = useMemo(() => {
    const totals = {
      "2G": { cnur: 0, tts: 0 },
      "3G": { cnur: 0, tts: 0 },
      "4G": { cnur: 0, tts: 0 },
      "5G": { cnur: 0, tts: 0 },
      total: { cnur: 0, tts: 0 },
    };
    dailyTableData.forEach((row) => {
      ["2G", "3G", "4G", "5G", "total"].forEach((net) => {
        totals[net].cnur += row[net].cnur;
        totals[net].tts += row[net].tts;
      });
    });
    return totals;
  }, [dailyTableData]);

  const topSites = useMemo(() => {
    if (!isDataLoaded) return [];
    const siteMap = {};
    filteredData.forEach((row) => {
      const s = row.siteCode || "Unknown";
      if (!siteMap[s])
        siteMap[s] = {
          site: s,
          siteName: row.siteName || "Unknown",
          incidents: 0,
          duration: 0,
          cnur: 0,
        };
      siteMap[s].incidents += 1;
      siteMap[s].duration += row.parsedDurationMins || 0;
      siteMap[s].cnur += row.CNUR || 0;
    });
    return Object.values(siteMap)
      .sort((a, b) => b.cnur - a.cnur)
      .slice(0, 10);
  }, [filteredData, isDataLoaded]);

  const monthlyStats = useMemo(() => {
    if (!isDataLoaded) return [];
    const monthMap = {};
    processedData.forEach(row => {
        const m = row.month;
        if (!monthMap[m]) {
            monthMap[m] = {
                month: m,
                totalCNUR: 0,
                '2G': 0,
                '3G': 0,
                '4G': 0,
                '5G': 0,
                rawDate: row.rawDate // for sorting
            };
        }
        monthMap[m].totalCNUR += row.CNURMonthly;
        const tech = row.parsedTech.toUpperCase();
        if (tech.includes("2G") || tech.includes("GSM")) monthMap[m]['2G'] += row.CNURMonthly;
        else if (tech.includes("3G") || tech.includes("UMTS")) monthMap[m]['3G'] += row.CNURMonthly;
        else if (tech.includes("4G") || tech.includes("LTE")) monthMap[m]['4G'] += row.CNURMonthly;
        else if (tech.includes("5G") || tech.includes("NR")) monthMap[m]['5G'] += row.CNURMonthly;
    });
    return Object.values(monthMap).sort((a, b) => {
        const [mA, yA] = a.month.split('-');
        const [mB, yB] = b.month.split('-');
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (yA !== yB) return yA - yB;
        return months.indexOf(mA) - months.indexOf(mB);
    });
  }, [processedData, isDataLoaded]);

  const topRepeatedSites = useMemo(() => {
    if (!isDataLoaded) return [];
    const siteMap = {};
    const data3G = filteredData.filter((row) => {
      const tech = String(row.parsedTech || "").toUpperCase();
      return tech.includes("3G") || tech.includes("UMTS");
    });
    data3G.forEach((row) => {
      const s = row.siteCode || "Unknown";
      const date = row.rawDate;
      const hourKey = date
        ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`
        : "N/A";
      if (!siteMap[s]) {
        siteMap[s] = {
          site: s,
          siteName: row.siteName || "Unknown",
          incidents: 0,
          duration: 0,
          seenHours: new Set(),
          isChronic: false,
        };
      }
      if (!siteMap[s].seenHours.has(hourKey)) {
        siteMap[s].incidents += 1;
        siteMap[s].seenHours.add(hourKey);
      }
      siteMap[s].duration += row.parsedDurationMins || 0;
    });

    // Determine "Chronic" status across all available 3G data
    const all3G = processedData.filter((row) => {
      const tech = String(row.parsedTech || "").toUpperCase();
      return tech.includes("3G") || tech.includes("UMTS");
    });

    // Optimized Chronic detection: Create a map of siteCode -> Set of weeks in one pass
    const siteWeeksMap = {};
    all3G.forEach((r) => {
      if (!siteWeeksMap[r.siteCode]) siteWeeksMap[r.siteCode] = new Set();
      siteWeeksMap[r.siteCode].add(r.week);
    });

    Object.keys(siteMap).forEach((sCode) => {
      const siteWeeks = siteWeeksMap[sCode] || new Set();

      if (selectedWeek === "All") {
        if (siteWeeks.size > 1) siteMap[sCode].isChronic = true;
      } else {
        const currentWeekNum = parseInt(selectedWeek.replace(/\D/g, "")) || 0;
        const hasPrevious = Array.from(siteWeeks).some((w) => {
          const wNum = parseInt(w.replace(/\D/g, "")) || 0;
          return wNum < currentWeekNum;
        });
        if (hasPrevious) siteMap[sCode].isChronic = true;
      }
    });

    return Object.values(siteMap)
      .sort((a, b) => b.incidents - a.incidents)
      .slice(0, 10);
  }, [filteredData, processedData, isDataLoaded, selectedWeek]);

  const officeChartData = useMemo(() => {
    if (!isDataLoaded) return [];
    const officeMap = {};
    if (config.officesList) {
      const globalTarget = config.dailyCNURTarget || 1.5;
      config.officesList.forEach((off) => {
        officeMap[off] = {
          name: off,
          cnur: 0,
          target: config.officeTargets?.[off] || globalTarget,
        };
      });
    }
    filteredData.forEach((row) => {
      const off = row.office || "Other";
      if (!officeMap[off]) {
        // If we have a fixed list from DB, don't add new offices from report to the chart
        if (config.officesList && config.officesList.length > 0) return;
        officeMap[off] = { 
          name: off, 
          cnur: 0, 
          target: config.dailyCNURTarget || 1.5 
        };
      }
      officeMap[off].cnur += row.CNUR;
    });
    return Object.values(officeMap).sort((a, b) => b.cnur - a.cnur);
  }, [filteredData, isDataLoaded, config]);

  const trendData = useMemo(() => {
    if (!isDataLoaded) return [];
    const weekMap = {};
    filteredData.forEach((row) => {
      const w = row.week;
      if (!weekMap[w])
        weekMap[w] = { name: w, "2G": 0, "3G": 0, "4G": 0, CNUR: 0 };
      const tech = row.parsedTech.toUpperCase();
      if (tech.includes("2G") || tech.includes("GSM"))
        weekMap[w]["2G"] += row.CNUR;
      if (tech.includes("3G") || tech.includes("UMTS"))
        weekMap[w]["3G"] += row.CNUR;
      if (tech.includes("4G") || tech.includes("LTE"))
        weekMap[w]["4G"] += row.CNUR;
      weekMap[w].CNUR += row.CNUR;
    });
    return Object.values(weekMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData, isDataLoaded]);

  const drillDownData = useMemo(() => {
    if (!drillDownDay || !isDataLoaded) return [];
    // Ensure we match using a clean string comparison
    const target = String(drillDownDay).trim();
    return filteredData
      .filter((d) => (d.dateStr || "Unknown").trim() === target)
      .sort((a, b) => b.CNUR - a.CNUR)
      .slice(0, 15);
  }, [filteredData, drillDownDay, isDataLoaded]);

  const contributorStats = useMemo(() => {
    if (!isDataLoaded) return [];
    const statsMap = {};
    let totalCNUR = 0;

    const areaKey = filteredData.length > 0 ? findKey(filteredData[0], "Area") : null;
    const respKey = filteredData.length > 0 ? (
        findKey(filteredData[0], "Action OGS Responsible") || 
        findKey(filteredData[0], "Responsible")
    ) : null;

    filteredData.forEach((row) => {
      let category = areaKey ? String(row[areaKey] || "Other").trim() : "Other";
      const respVal = respKey
        ? String(row[respKey] || "")
            .trim()
            .toUpperCase()
        : "";

      // Logic: Generator + ND -> Shared Generator
      if (category.toLowerCase() === "generator" && respVal.includes("ND")) {
        category = "Shared Generator";
      }

      if (!statsMap[category]) statsMap[category] = 0;
      statsMap[category] += row.CNUR;
      totalCNUR += row.CNUR;
    });

    if (totalCNUR === 0) return [];

    return Object.entries(statsMap)
      .map(([name, value]) => ({
        name,
        value,
        percentage: (value / totalCNUR) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData, isDataLoaded]);

  const COLORS =
    config.theme === "orange"
      ? [
          "#ff7900",
          "#ff9933",
          "#ffb366",
          "#ffd1a3",
          "#a3a3a3",
          "#737373",
          "#525252",
          "#404040",
        ]
      : [
          "#8b5cf6",
          "#3b82f6",
          "#10b981",
          "#f59e0b",
          "#ef4444",
          "#ec4899",
          "#06b6d4",
          "#84cc16",
        ];

  const accessStats = useMemo(() => {
    if (!isDataLoaded || !filteredData.length)
      return { count: 0, totalCNUR: 0, percentage: 0, respMap: [] };

    const accessKey = findKey(filteredData[0], "Access Problem");
    const respKey =
      findKey(filteredData[0], "Access Problem Type") ||
      findKey(filteredData[0], "Action OGS Responsible") ||
      findKey(filteredData[0], "Responsible");

    const accessRows = filteredData.filter((row) => {
      const val = accessKey
        ? String(row[accessKey] || "")
            .trim()
            .toLowerCase()
        : "";
      return (
        val === "true" ||
        val === "yes" ||
        val === "1" ||
        row[accessKey] === true
      );
    });

    const totalFilteredCNUR =
      filteredData.reduce((acc, curr) => acc + curr.CNUR, 0) || 1;
    const totalAccessCNUR = accessRows.reduce(
      (acc, curr) => acc + curr.CNUR,
      0,
    );

    const respCounts = {};
    accessRows.forEach((row) => {
      const resp = respKey ? String(row[respKey] || "Other").trim() : "Other";
      if (!respCounts[resp]) respCounts[resp] = 0;
      respCounts[resp] += row.CNUR;
    });

    const sortedResp = Object.entries(respCounts)
      .map(([name, value]) => ({
        name,
        value,
        pct: (value / (totalAccessCNUR || 1)) * 100,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      count: accessRows.length,
      totalCNUR: totalAccessCNUR,
      percentage: (totalAccessCNUR / totalFilteredCNUR) * 100,
      respMap: sortedResp,
    };
  }, [filteredData, isDataLoaded]);

  return (
    <div
      className="animate-fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
    >
      <FileUpload onDataProcessed={setData} />

      {isDataLoaded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Timeline Filter */}
          <div
            className="glass-panel"
            style={{
              padding: "1rem 1.5rem",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--accent)",
                fontWeight: 600,
                paddingRight: "1rem",
                borderRight: "1px solid var(--glass-border)",
              }}
            >
              <Filter size={18} />
              Timeline
            </div>
            <button
              onClick={() => setSelectedWeek("All")}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "20px",
                cursor: "pointer",
                transition: "all 0.2s",
                border:
                  selectedWeek === "All"
                    ? "none"
                    : "1px solid var(--glass-border)",
                background:
                  selectedWeek === "All"
                    ? (config.theme === 'orange' ? "linear-gradient(135deg, #ff7900, #ffb366)" : "linear-gradient(135deg, var(--accent), #8b5cf6)")
                    : "transparent",
                color: selectedWeek === "All" ? "#fff" : "var(--text-secondary)",
                fontWeight: selectedWeek === "All" ? 600 : 400,
              }}
            >
              All Weeks
            </button>
            {availableWeeks.map((week) => (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "20px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  border:
                    selectedWeek === week
                      ? "none"
                      : "1px solid var(--glass-border)",
                  background:
                    selectedWeek === week
                      ? config.theme === "orange"
                        ? "linear-gradient(135deg, #ff7900, #ffb366)"
                        : "linear-gradient(135deg, var(--accent), #8b5cf6)"
                      : "rgba(255,255,255,0.02)",
                  color: selectedWeek === week ? "#fff" : "var(--text-primary)",
                  fontWeight: selectedWeek === week ? 600 : 400,
                }}
              >
                {week}
              </button>
            ))}
          </div>

          {/* Operation Zone Filter */}
          {availableOZs.length > 0 && (
            <div
              className="glass-panel"
              style={{
                padding: "1rem 1.5rem",
                display: "flex",
                gap: "1rem",
                alignItems: "center",
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--accent)",
                  fontWeight: 600,
                  paddingRight: "1rem",
                  borderRight: "1px solid var(--glass-border)",
                }}
              >
                <MapPin size={18} />
                Operation Zone
              </div>
              <button
                onClick={() => setSelectedOZ("All")}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "20px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  border:
                    selectedOZ === "All"
                      ? "none"
                      : "1px solid var(--glass-border)",
                  background:
                    selectedOZ === "All"
                      ? (config.theme === 'orange' ? "linear-gradient(135deg, #ff7900, #ffb366)" : "linear-gradient(135deg, var(--accent), #8b5cf6)")
                      : "transparent",
                  color: selectedOZ === "All" ? "#fff" : "var(--text-secondary)",
                  fontWeight: selectedOZ === "All" ? 600 : 400,
                }}
              >
                All Zones
              </button>
              {availableOZs.map((oz) => (
                <button
                  key={oz}
                  onClick={() => setSelectedOZ(oz)}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    border:
                      selectedOZ === oz
                        ? "none"
                        : "1px solid var(--glass-border)",
                    background:
                      selectedOZ === oz
                        ? config.theme === "orange"
                          ? "linear-gradient(135deg, #ff7900, #ffb366)"
                          : "linear-gradient(135deg, var(--accent), #8b5cf6)"
                        : "rgba(255,255,255,0.02)",
                    color: selectedOZ === oz ? "#fff" : "var(--text-primary)",
                    fontWeight: selectedOZ === oz ? 600 : 400,
                  }}
                >
                  {oz}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isDataLoaded && (
        <div
          id="dashboard-content"
          style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
        >
          {dailyTableData.length > 0 && (
            <div
              className="glass-panel"
              style={{ padding: "1.5rem", overflowX: "auto" }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "1.25rem",
                  marginBottom: "1rem",
                }}
              >
                <Calendar size={20} color="var(--accent)" />
                Daily Network Performance (
                {selectedWeek === "All" ? "Overall" : selectedWeek})
              </h3>
              <div
                className="table-container"
                style={{
                  border: "1px solid var(--glass-border)",
                  borderRadius: "8px",
                }}
              >
                <table
                  style={{
                    minWidth: "800px",
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "center",
                    fontSize: "0.85rem",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        rowSpan="2"
                        style={{
                          padding: "6px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          verticalAlign: "middle",
                          textAlign: "center",
                        }}
                      >
                        Date
                      </th>
                      <th
                        colSpan="2"
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        2G Network
                      </th>
                      <th
                        colSpan="2"
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        3G Network
                      </th>
                      <th
                        colSpan="2"
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        4G Network
                      </th>
                      <th
                        colSpan="2"
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        5G Network
                      </th>
                      <th
                        colSpan="2"
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        Total
                      </th>
                    </tr>
                    <tr>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        CNUR
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        TTs
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        CNUR
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        TTs
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        CNUR
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        TTs
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        CNUR
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        TTs
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        CNUR
                      </th>
                      <th
                        style={{
                          padding: "4px 8px",
                          borderBottom: "2px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        TTs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTableData.map((row, i) => {
                      const isExceed = row.total.cnur > (config.dailyCNURTarget || 1.5);
                      return (
                        <tr
                          key={i}
                          onClick={() =>
                            isExceed
                              ? setDrillDownDay(
                                  row.date === drillDownDay ? null : row.date,
                                )
                              : null
                          }
                          style={{
                            backgroundColor: isExceed
                              ? "rgba(239, 68, 68, 0.15)"
                              : i % 2 === 0
                                ? "rgba(255,255,255,0.02)"
                                : "transparent",
                            cursor: isExceed ? "pointer" : "default",
                            transition: "all 0.2s",
                          }}
                          className={isExceed ? "hover-row" : ""}
                        >
                          <td
                            style={{
                              padding: "4px 8px",
                              fontWeight: "500",
                              borderRight: "1px solid var(--glass-border)",
                              borderLeft: isExceed
                                ? "3px solid var(--danger)"
                                : "3px solid transparent",
                              textAlign: "center",
                            }}
                          >
                            {row.date}
                            {isExceed && (
                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  color: "var(--danger)",
                                  fontWeight: "bold",
                                }}
                              >
                                CLICK TO VIEW
                              </div>
                            )}
                          </td>

                          <td
                            style={{ padding: "4px 8px", textAlign: "center" }}
                          >
                            {row["2G"].cnur.toFixed(3)}
                          </td>
                          <td
                            style={{
                              padding: "4px 8px",
                              borderRight: "1px solid var(--glass-border)",
                              textAlign: "center",
                            }}
                          >
                            {row["2G"].tts}
                          </td>

                          <td
                            style={{ padding: "4px 8px", textAlign: "center" }}
                          >
                            {row["3G"].cnur.toFixed(3)}
                          </td>
                          <td
                            style={{
                              padding: "4px 8px",
                              borderRight: "1px solid var(--glass-border)",
                              textAlign: "center",
                            }}
                          >
                            {row["3G"].tts}
                          </td>

                          <td
                            style={{ padding: "4px 8px", textAlign: "center" }}
                          >
                            {row["4G"].cnur.toFixed(3)}
                          </td>
                          <td
                            style={{
                              padding: "4px 8px",
                              borderRight: "1px solid var(--glass-border)",
                              textAlign: "center",
                            }}
                          >
                            {row["4G"].tts}
                          </td>

                          <td
                            style={{ padding: "4px 8px", textAlign: "center" }}
                          >
                            {row["5G"].cnur.toFixed(3)}
                          </td>
                          <td
                            style={{
                              padding: "4px 8px",
                              borderRight: "1px solid var(--glass-border)",
                              textAlign: "center",
                            }}
                          >
                            {row["5G"].tts}
                          </td>

                          <td
                            style={{
                              padding: "4px 8px",
                              fontWeight: "600",
                              color: isExceed
                                ? "var(--danger)"
                                : "var(--accent)",
                              textAlign: "center",
                            }}
                          >
                            {row.total.cnur.toFixed(3)}
                          </td>
                          <td
                            style={{
                              padding: "4px 8px",
                              fontWeight: "600",
                              textAlign: "center",
                            }}
                          >
                            {row.total.tts}
                          </td>
                        </tr>
                      );
                    })}
                    <tr
                      style={{
                        background: "var(--accent-glow)",
                        fontWeight: "bold",
                        borderTop: "2px solid var(--glass-border)",
                      }}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        Total
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {tableTotals["2G"].cnur.toFixed(3)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        {tableTotals["2G"].tts}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {tableTotals["3G"].cnur.toFixed(3)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        {tableTotals["3G"].tts}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {tableTotals["4G"].cnur.toFixed(3)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        {tableTotals["4G"].tts}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {tableTotals["5G"].cnur.toFixed(3)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderRight: "1px solid var(--glass-border)",
                          textAlign: "center",
                        }}
                      >
                        {tableTotals["5G"].tts}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "var(--accent)",
                          textAlign: "center",
                        }}
                      >
                        {tableTotals.total.cnur.toFixed(3)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {tableTotals.total.tts}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Drill-down Section */}
          {drillDownDay && (
            <div
              ref={drillDownRef}
              className="glass-panel animate-slide-up"
              style={{
                padding: "1.5rem",
                border: "1px solid var(--danger)",
                background: "rgba(239, 68, 68, 0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "1.25rem",
                  }}
                >
                  <ShieldAlert size={20} color="var(--danger)" />
                  Top Contributors for {drillDownDay}
                </h3>
                <button
                  onClick={() => setDrillDownDay(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "1.25rem",
                  }}
                >
                  ×
                </button>
              </div>
              <div
                className="table-container"
                style={{ maxHeight: "400px", overflowY: "auto" }}
              >
                <table
                  style={{
                    width: "100%",
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                >
                  <thead
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "var(--panel-bg)",
                      zIndex: 1,
                    }}
                  >
                    <tr>
                      <th style={{ padding: "8px" }}>Site Code</th>
                      <th style={{ padding: "8px" }}>Site Name</th>
                      <th style={{ padding: "8px" }}>Tech</th>
                      <th style={{ padding: "8px" }}>Duration</th>
                      <th style={{ padding: "8px" }}>CNUR Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillDownData.length > 0 ? (
                      drillDownData.map((site, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <td style={{ padding: "8px", fontWeight: "600" }}>
                            {site.siteCode}
                          </td>
                          <td style={{ padding: "8px" }}>{site.siteName}</td>
                          <td style={{ padding: "8px" }}>{site.parsedTech}</td>
                          <td style={{ padding: "8px" }}>
                            {site.parsedDurationMins.toFixed(1)} m
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              color: "var(--danger)",
                              fontWeight: "700",
                            }}
                          >
                            {site.CNUR.toFixed(4)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          style={{
                            textAlign: "center",
                            padding: "2rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          No detailed records found for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stats Metrics */}
          <div
            className="dashboard-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <div className="glass-panel metric-card m-purple">
              <div className="metric-title">
                Weekly CNUR
                <Target size={18} color={themeSecondary} />
              </div>
              <div className="metric-value">{stats.cnur}</div>
              <div className="metric-subtitle">
                {selectedWeek === "All"
                  ? "Avg per week"
                  : "Total for selected week"}
              </div>
            </div>

            <div className="glass-panel metric-card m-blue">
              <div className="metric-title">
                Best Day
                <TrendingUp size={18} color={themePrimary} />
              </div>
              <div className="metric-value">{stats.bestDay}</div>
              <div className="metric-subtitle">{stats.bestDayName}</div>
            </div>

            <div className="glass-panel metric-card m-orange">
              <div className="metric-title" style={{ color: "var(--danger)" }}>
                Worst Day
                <TrendingDown size={18} color="#ef4444" />
              </div>
              <div className="metric-value">{stats.worstDay}</div>
              <div className="metric-subtitle">{stats.worstDayName}</div>
            </div>

            <div className="glass-panel metric-card m-green">
              <div className="metric-title">
                Expected Closure
                <Clock size={18} color="#10b981" />
              </div>
              <div className="metric-value">{stats.expectedClosure}</div>
              <div className="metric-subtitle">Expected CNUR by week end</div>
            </div>
          </div>

          {/* Charts Area */}
          <div
            className="dashboard-grid"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            {/* Weekly Trend */}
            <div
              className="glass-panel p-6"
              style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "1.25rem",
                }}
              >
                <Calendar size={20} color="var(--accent)" />
                Weekly CNUR Trend
              </h3>
              <div style={{ height: "300px", width: "100%" }}>
                <ResponsiveContainer>
                  <AreaChart
                    data={trendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorCNUR"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={themeSecondary}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={themeSecondary}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.2}
                    />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--panel-bg)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: "8px",
                        color: "var(--text-primary)"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="CNUR"
                      stroke={themeSecondary}
                      fillOpacity={1}
                      fill="url(#colorCNUR)"
                      label={{ 
                        position: 'top', 
                        fill: 'var(--text-secondary)', 
                        fontSize: 10,
                        formatter: (val) => val.toFixed(3)
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* NUR Distribution vs Target per Office */}
            <div
              className="glass-panel p-6"
              style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "1.25rem",
                }}
              >
                <BarChart3 size={20} color="var(--accent)" />
                NUR Distribution vs Target per Office
              </h3>
              <div style={{ height: "300px", width: "100%" }}>
                <ResponsiveContainer>
                  <ComposedChart
                    data={officeChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.1}
                    />
                    <XAxis dataKey="name" fontSize={10} interval={0} />
                    <YAxis />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--panel-bg)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: "8px",
                        color: "var(--text-primary)"
                      }}
                      formatter={(value) =>
                        typeof value === "number" ? value.toFixed(3) : value
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="cnur"
                      name="CNUR Impact"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList 
                        dataKey="cnur" 
                        position="top" 
                        fill="var(--text-secondary)" 
                        fontSize={9} 
                        formatter={(val) => val.toFixed(3)}
                      />
                      {officeChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.cnur > entry.target
                              ? "var(--danger)"
                              : "var(--accent)"
                          }
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                    <Line
                      type="step"
                      dataKey="target"
                      name="Target"
                      stroke="#ff4757"
                      strokeWidth={2}
                      dot={true}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Tables */}
          <div
            className="dashboard-grid"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "1.25rem",
                  }}
                >
                  <AlertOctagon size={20} color="var(--danger)" />
                  Top 10 NUR Sites (
                  {selectedWeek === "All" ? "Overall" : selectedWeek})
                </h3>
              </div>
              <div className="table-container">
                <table style={{ textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "6px 8px" }}>Site Code</th>
                      <th style={{ padding: "6px 8px" }}>Site Name</th>
                      <th style={{ padding: "6px 8px" }}>CNUR Impact</th>
                      <th style={{ padding: "6px 8px" }}>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isDataLoaded && topSites.length > 0 ? (
                      topSites.map((site, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <td style={{ fontWeight: "500", padding: "6px 8px" }}>
                            {site.site}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            {site.siteName}
                          </td>
                          <td
                            style={{
                              color: "var(--danger)",
                              fontWeight: "600",
                              padding: "6px 8px",
                            }}
                          >
                            {site.cnur.toFixed(3)}
                          </td>
                          <td style={{ padding: "4px 8px" }}>
                            <input
                              type="text"
                              value={siteComments[site.site] || ""}
                              onChange={(e) =>
                                handleCommentChange(site.site, e.target.value)
                              }
                              placeholder="Add comment..."
                              style={{
                                background: "rgba(0,0,0,0.2)",
                                border: "1px solid var(--glass-border)",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                color: "white",
                                width: "100%",
                                outline: "none",
                                fontSize: "0.85rem",
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="4"
                          style={{
                            textAlign: "center",
                            color: "var(--text-secondary)",
                            padding: "6px 8px",
                          }}
                        >
                          No data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "1.25rem",
                  }}
                >
                  <Clock size={20} color="var(--warning)" />
                  Top 10 Repeated (
                  {selectedWeek === "All" ? "Overall" : selectedWeek})
                </h3>
              </div>
              <div className="table-container">
                <table style={{ textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "6px 8px" }}>Site Code</th>
                      <th style={{ padding: "6px 8px" }}>Site Name</th>
                      <th style={{ padding: "6px 8px" }}>Recurrence</th>
                      <th style={{ padding: "6px 8px" }}>Avg Down Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isDataLoaded && topRepeatedSites.length > 0 ? (
                      topRepeatedSites.map((site, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <td style={{ fontWeight: "500", padding: "6px 8px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                              }}
                            >
                              {site.site}
                              {site.isChronic && (
                                <span
                                  style={{
                                    fontSize: "0.65rem",
                                    background: "rgba(239, 68, 68, 0.2)",
                                    color: "#ef4444",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    fontWeight: "600",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.025em",
                                  }}
                                >
                                  Chronic
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            {site.siteName}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            {site.incidents} times
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            {(site.duration / site.incidents).toFixed(1)} m
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="4"
                          style={{
                            textAlign: "center",
                            color: "var(--text-secondary)",
                            padding: "6px 8px",
                          }}
                        >
                          No data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Contributor Analysis */}
          <div
            className="glass-panel"
            style={{ padding: "1.5rem", marginBottom: "2rem" }}
          >
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "1.25rem",
                marginBottom: "1.5rem",
              }}
            >
              <PieChartIcon size={20} color="var(--accent)" />
              Contributor Analysis (Area Breakdown)
            </h3>
            <div
              className="dashboard-grid"
              style={{ gridTemplateColumns: "1fr 1fr", gap: "2rem" }}
            >
              <div style={{ height: "350px", width: "100%" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={contributorStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percentage }) =>
                        `${name} (${percentage.toFixed(1)}%)`
                      }
                    >
                      {contributorStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--panel-bg)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: "8px",
                        color: "var(--text-primary)"
                      }}
                      formatter={(value) => value.toFixed(3)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="table-container" style={{ alignSelf: "center" }}>
                <table style={{ width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr
                      style={{ borderBottom: "1px solid var(--glass-border)" }}
                    >
                      <th style={{ padding: "10px" }}>Category</th>
                      <th style={{ padding: "10px" }}>CNUR Impact</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributorStats.map((item, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <td
                          style={{
                            padding: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          ></div>
                          {item.name}
                        </td>
                        <td style={{ padding: "10px", fontWeight: "600" }}>
                          {item.value.toFixed(3)}
                        </td>
                        <td
                          style={{
                            padding: "10px",
                            textAlign: "right",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {item.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Access Problem Analysis */}
          <div
            className="dashboard-grid"
            style={{ gridTemplateColumns: "1fr 2fr", gap: "2rem" }}
          >
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                background: "rgba(var(--accent-rgb), 0.05)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "1.15rem",
                }}
              >
                <ShieldAlert size={20} color="var(--accent)" />
                Access Problem Impact
              </h3>
              <div style={{ marginTop: "1rem" }}>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: "800",
                    color: "var(--accent)",
                  }}
                >
                  {accessStats.percentage.toFixed(1)}%
                </div>
                <div
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.85rem",
                  }}
                >
                  of Total CNUR Impact
                </div>
              </div>
              <div
                style={{
                  marginTop: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Total CNUR:
                  </span>
                  <span style={{ fontWeight: "600" }}>
                    {accessStats.totalCNUR.toFixed(3)}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Incident Count:
                  </span>
                  <span style={{ fontWeight: "600" }}>{accessStats.count}</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    CNUR Exculding Access:
                  </span>
                  <span style={{ fontWeight: "600", color: "var(--accent)" }}>
                    {(stats.cnur - accessStats.totalCNUR).toFixed(3)}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "1.15rem",
                  marginBottom: "1.5rem",
                }}
              >
                <Activity size={20} color="var(--accent)" />
                Access Problem Breakdown
              </h3>
              {accessStats.respMap.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {accessStats.respMap.map((item, idx) => (
                    <div key={idx}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "0.5rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        <span style={{ fontWeight: "500" }}>{item.name}</span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {item.value.toFixed(3)} ({item.pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "8px",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${item.pct}%`,
                            height: "100%",
                            background: COLORS[idx % COLORS.length],
                            borderRadius: "4px",
                          }}
                        ></div>
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
                  }}
                >
                  No access problem data found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monthly NUR Analysis Section */}
      {isDataLoaded && (
        <div style={{ marginTop: "4rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'var(--accent-bg)', padding: '0.75rem', borderRadius: '12px' }}>
              <Calendar size={24} color="var(--accent)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.75rem', margin: 0 }} className="text-gradient">Monthly NUR Analysis</h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Aggregated performance metrics on a monthly basis (30-day normalization).</p>
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
            {/* Monthly Trend Chart */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Activity size={20} color="var(--accent)" />
                Monthly CNUR Trend
              </h3>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="totalCNUR" name="Total CNUR" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={40}>
                      <LabelList dataKey="totalCNUR" position="top" fill="var(--text-secondary)" fontSize={10} formatter={(val) => val.toFixed(3)} />
                    </Bar>
                    <Line type="monotone" dataKey="totalCNUR" name="Trend" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Tech Breakdown */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <BarChart3 size={20} color="var(--accent)" />
                Monthly NUR per Tech
              </h3>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis dataKey="month" type="category" stroke="var(--text-secondary)" fontSize={12} width={80} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="2G" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="3G" stackId="a" fill="#10b981" />
                    <Bar dataKey="4G" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="5G" stackId="a" fill="#ef4444">
                      <LabelList dataKey="totalCNUR" position="right" fill="var(--text-secondary)" fontSize={10} formatter={(val) => val.toFixed(3)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NURDashboard;
