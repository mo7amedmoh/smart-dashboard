
// Helper to find column keys robustly with optional exclusions
export const findKey = (obj, searchStr, excludeStr = null) => {
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
export const parseDurationToMins = (val) => {
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
export const parseExcelDate = (val) => {
  if (val == null) return new Date();
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    );
  }
  const d = new Date(val);
  if (!isNaN(d)) return d;
  return new Date();
};

// Helper to calculate week number starting on Sunday
export const getWeekNumberStartingSunday = (date) => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const pastDaysOfYear = (d - startOfYear) / 86400000;
  const firstDayOfYear = startOfYear.getUTCDay(); // 0 is Sunday
  return Math.ceil((pastDaysOfYear + firstDayOfYear + 1) / 7);
};

export const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const pastDaysOfYear = (d - startOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + (startOfYear.getUTCDay() + 1)) / 7);
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

// Reusable exclusion logic
const shouldExcludeRow = (row, config, durationMins = null) => {
  if (!row) return false;

  const blockedKey = findKey(row, "Blocked");
  const areaKey = findKey(row, "Area");
  const outageTypeKey = findKey(row, "Outage Type");
  const fmKey = findKey(row, "Force Majeure");

  const valBlocked = blockedKey ? String(row[blockedKey]).trim().toLowerCase() : "";
  const valArea = areaKey ? String(row[areaKey]).trim().toLowerCase() : "";
  const valOutage = outageTypeKey ? String(row[outageTypeKey]).trim().toLowerCase() : "";
  const valFM = fmKey ? String(row[fmKey]).trim().toLowerCase() : "";

  const isBlocked = valBlocked === "true" || valBlocked === "yes" || valBlocked === "1";
  const isLL = valArea === "ll";
  const isVoluntary = valOutage === "voluntary";
  const isFM = valFM === "true" || valFM === "yes" || valFM === "1";
  const isShortDuration = durationMins !== null && durationMins < 20;

  // Defaults: existing exclusions are ON by default unless explicitly set to false
  const excludeBlocked = config?.excludeBlocked !== false;
  const excludeLL = config?.excludeLL !== false;
  const excludeVoluntary = config?.excludeVoluntary !== false;
  const excludeFM = config?.excludeFM !== false;
  // New exclusion is OFF by default
  const excludeShortDuration = !!config?.excludeShortDuration;

  if (excludeBlocked && isBlocked) return true;
  if (excludeLL && isLL) return true;
  if (excludeVoluntary && isVoluntary) return true;
  if (excludeFM && isFM) return true;
  if (excludeShortDuration && isShortDuration) return true;

  return false;
};

export const extractDataWithNUR = (rawData, config) => {
  if (!rawData || !rawData.length) return [];

  const c2G = Number(config?.cells2G) || 0;
  const c3G = Number(config?.cells3G) || 0;
  const c4G = Number(config?.cells4G) || 0;
  const c5G = Number(config?.cells5G) || 0;
  const totalCellsAllConfig = c2G + c3G + c4G + c5G || 1;

  let lastTtId = null;

  return rawData
    .map((row) => {
      const durationKey = findKey(row, "Incident Duration") || findKey(row, "Duration");
      const durationMins = parseDurationToMins(row[durationKey]) || 0;

      // Apply common exclusions
      if (shouldExcludeRow(row, config, durationMins)) {
        return null;
      }

      const techKey =
        findKey(row, "Technology") ||
        findKey(row, "Primary Affected Service") ||
        findKey(row, "Affected Item", "Site") ||
        findKey(row, "Tech") ||
        findKey(row, "Network");
      const cellsKey = findKey(row, "Total Cells");
      const weekKey =
        findKey(row, "Downtime Start Week") ||
        findKey(row, "Start Week") ||
        findKey(row, "Week", "end") ||
        findKey(row, "Week", "close");
      const dateKey =
        findKey(row, "Downtime Start") ||
        findKey(row, "Start Date") ||
        findKey(row, "Start", "end") ||
        findKey(row, "Date", "end") ||
        findKey(row, "Date", "close");
      const officeKey = findKey(row, "Office") || findKey(row, "SC Office");
      const ozKey = findKey(row, "Operation Zone") || findKey(row, "OZ");

      const technology = String(row[techKey] || "").trim();
      let configCells = 0;
      const techUpper = technology.toUpperCase();
      let detectedTech = null;

      if (techUpper.includes("2G") || techUpper.includes("GSM")) {
        configCells = c2G;
        detectedTech = "2G";
      } else if (
        techUpper.includes("3G") ||
        techUpper.includes("UMTS") ||
        techUpper.includes("WCDMA")
      ) {
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

      const totalCellsNUR = Number(row[cellsKey]) || 0;

      const Nx = totalCellsNUR * durationMins;
      const NUR =
        configCells > 0 ? (100000 * Nx) / (configCells * 7 * 24 * 60) : 0;
      const CNUR =
        totalCellsAllConfig > 0 && !isNaN(configCells)
          ? (NUR * configCells) / totalCellsAllConfig
          : 0;

      // Monthly NUR Calculation (using 30 days)
      const NURMonthly =
        configCells > 0 ? (100000 * Nx) / (configCells * 30 * 24 * 60) : 0;
      const CNURMonthly =
        totalCellsAllConfig > 0 && !isNaN(configCells)
          ? (NURMonthly * configCells) / totalCellsAllConfig
          : 0;

      let weekStr = "W01";
      let dayName = "Unknown";
      let rawDate = null;
      let dateStr = "Unknown";
      if (dateKey && row[dateKey]) {
        rawDate = parseExcelDate(row[dateKey]);
        dayName = daysOfWeek[rawDate.getDay()];
        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        dateStr = `${rawDate.getDate()}-${months[rawDate.getMonth()]}`;
      }

      let monthStr = "Unknown";
      if (rawDate) {
        const monthNames = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
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

      if (config?.siteDatabase && config.siteDatabase[sCode]) {
        sName = config.siteDatabase[sCode];
      }
      if (config?.officeMapping && config.officeMapping[sCode]) {
        sOffice = config.officeMapping[sCode];
      }
      let sOZ = ozKey ? String(row[ozKey] || "Other").trim() : "Other";
      if (sOZ === "Other" && config?.ozMapping && config.ozMapping[sCode]) {
        sOZ = config.ozMapping[sCode];
      }

      let idKey = Object.keys(row).find((k) => {
        const lower = k.trim().toLowerCase();
        return [
          "number", "incident number", "ticket number", "fault number",
          "incident id", "ticket id", "ticket no", "incident no", "alarm id",
        ].includes(lower);
      });

      if (!idKey) {
        idKey = findKey(row, "Incident") || findKey(row, "Ticket") || findKey(row, "Alarm");
      }

      let ttId = idKey ? String(row[idKey] || "").trim() : null;

      if (ttId && ttId !== "null" && ttId !== "") {
        lastTtId = ttId;
      } else if (lastTtId) {
        ttId = lastTtId;
      }

      const solutionKey = findKey(row, "Solution") || findKey(row, "Resolution") || findKey(row, "Action Taken");
      const solution = solutionKey ? String(row[solutionKey] || "").trim() : "";

      return {
        ...row,
        ttId,
        parsedTech: technology,
        parsedDurationMins: durationMins,
        siteCode: sCode,
        siteName: sName,
        office: sOffice,
        oz: sOZ,
        solution,
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

export const extractHWData = (data, config) => {
    if (!data || !data.length) return [];

    const statusKey = findKey(data[0], 'status');
    const openTimeKey = findKey(data[0], 'open time') || findKey(data[0], 'opened') || findKey(data[0], 'created') || findKey(data[0], 'date');
    const closeTimeKey = findKey(data[0], 'close time') || findKey(data[0], 'closed') || findKey(data[0], 'resolved');
    const siteNameKey = findKey(data[0], 'site name') || findKey(data[0], 'site');
    const siteCodeKey = findKey(data[0], 'site code') || findKey(data[0], 'code') || findKey(data[0], 'site id') || findKey(data[0], 'node');
    const actionKey = findKey(data[0], 'action');
    const idKey = findKey(data[0], 'id') || findKey(data[0], 'ticket') || findKey(data[0], 'ref');

    return data.map((row, index) => {
        // Apply common exclusions
        if (shouldExcludeRow(row, config)) {
            return null;
        }

        const rawStatus = String(row[statusKey] || '').trim();
        const statusLower = rawStatus.toLowerCase();
        
        let status = 'Other';
        if (statusLower.includes('assign')) status = 'Assigned';
        else if (statusLower.includes('pend')) status = 'Pending';
        else if (statusLower.includes('close') || statusLower.includes('resolve')) status = 'Closed';

        const openTime = parseExcelDate(row[openTimeKey]);
        const closeTime = parseExcelDate(row[closeTimeKey]);
        
        const openWeek = openTime ? `W${getWeekNumber(openTime)}` : null;
        const closeWeek = (status === 'Closed' && closeTime) ? `W${getWeekNumber(closeTime)}` : null;
        const id = idKey ? String(row[idKey]) : `row-${index}`;
        const sCode = siteCodeKey ? String(row[siteCodeKey] || '').trim().toUpperCase() : '';
        
        let sName = row[siteNameKey] || 'Unknown';
        if (config?.siteDatabase && config.siteDatabase[sCode]) {
            sName = config.siteDatabase[sCode];
        }

        return {
            ...row,
            id,
            status,
            rawStatus,
            openTime,
            closeTime,
            openWeek,
            closeWeek,
            siteCode: sCode,
            siteName: sName,
            action: row[actionKey] || 'N/A'
        };
    }).filter(Boolean);
};

export const extractTxData = (rawData, config) => {
  if (!rawData || !rawData.length) return [];

  return rawData.map((row, idx) => {
    // Apply common exclusions
    if (shouldExcludeRow(row, config)) {
        return null;
    }

    const numKey = findKey(row, "Number") || findKey(row, "Incident") || findKey(row, "ID");
    const openKey = findKey(row, "Open Time") || findKey(row, "Start");
    const closeKey = findKey(row, "Close Time") || findKey(row, "End");
    const typeKey = findKey(row, "Outage Type") || findKey(row, "Type");
    const titleKey = findKey(row, "Title") || findKey(row, "Impacted");
    const descKey = findKey(row, "Description");
    const statusKey = findKey(row, "Status");

    const title = String(row[titleKey] || "");
    const openTime = parseExcelDate(row[openKey]);
    const closeTime = row[closeKey] ? parseExcelDate(row[closeKey]) : null;

    const siteCodeRegex = /([0-9]{3,6}[A-Z]{1,2})/gi;
    const matches = Array.from(title.matchAll(siteCodeRegex));

    let neSite = "Unknown";
    let feSite = "Unknown";
    let linkId = "Unknown";
    let mappedLinkId = "Unknown";

    if (matches.length >= 2) {
      neSite = matches[0][1].toUpperCase();
      feSite = matches[1][1].toUpperCase();
      const sites = [neSite, feSite].sort();
      linkId = sites.join("<>");
      const nameA = config?.siteDatabase?.[sites[0]] || "Unknown Site";
      const nameB = config?.siteDatabase?.[sites[1]] || "Unknown Site";
      mappedLinkId = `${nameA} . ${sites[0]} <> ${nameB} . ${sites[1]}`;
    } else if (matches.length === 1) {
      neSite = matches[0][1].toUpperCase();
    }

    const displayTitle = matches.length >= 2 ? mappedLinkId : title;
    const status = String(row[statusKey] || "Unknown");

    return {
      ...row,
      id: row[numKey] || `TX-${idx}`,
      openTime,
      closeTime,
      outageType: row[typeKey] || "Unknown",
      title: displayTitle,
      originalTitle: title,
      description: row[descKey] || "",
      status,
      neSite,
      feSite,
      linkId: matches.length >= 2 ? mappedLinkId : linkId,
      dateStr: `${openTime.getDate()}-${openTime.toLocaleString("default", { month: "short" })}`,
    };
  }).filter(Boolean);
};
