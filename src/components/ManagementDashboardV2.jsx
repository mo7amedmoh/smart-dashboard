import React, { useMemo } from "react";
import { Activity, HardDrive, Wifi, TrendingUp, TrendingDown, Layers, BarChart3, Target, Zap, Shield, Users, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, LabelList, AreaChart, Area, RadialBarChart, RadialBar, Legend } from "recharts";
import { extractDataWithNUR, extractHWData, extractTxData } from "../utils/dataUtils";

const COLORS = ["#6366f1","#3b82f6","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#8b5cf6"];

const StatCard = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="glass-panel" style={{ padding:"1.25rem", position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color }} />
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <div style={{ fontSize:"0.75rem", color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:600, marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:"2rem", fontWeight:700, color:"var(--text-primary)", lineHeight:1.1 }}>{value}</div>
        {sub && <div style={{ fontSize:"0.8rem", color:"var(--text-secondary)", marginTop:4, display:"flex", alignItems:"center", gap:4 }}>
          {trend === "up" && <TrendingUp size={14} color="#10b981"/>}
          {trend === "down" && <TrendingDown size={14} color="#ef4444"/>}
          {sub}
        </div>}
      </div>
      <div style={{ background:`${color}20`, padding:8, borderRadius:10 }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  </div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", margin:"0.5rem 0 1rem" }}>
    <div style={{ background:"linear-gradient(135deg, var(--accent), #8b5cf6)", padding:8, borderRadius:10 }}>
      <Icon size={18} color="white" />
    </div>
    <div>
      <h3 style={{ margin:0, fontSize:"1.15rem" }}>{title}</h3>
      {subtitle && <p style={{ margin:0, fontSize:"0.8rem", color:"var(--text-secondary)" }}>{subtitle}</p>}
    </div>
  </div>
);

const ManagementDashboardV2 = ({ config, nurData, hwData, txData, selectedWeek }) => {
  const processedNUR = useMemo(() => nurData ? extractDataWithNUR(nurData, config) : [], [nurData, config]);
  const processedHW = useMemo(() => {
    if (!hwData) return [];
    return extractHWData(hwData, config).filter(d => d.status !== "Closed");
  }, [hwData, config]);
  const processedTx = useMemo(() => {
    if (!txData) return [];
    return extractTxData(txData, config).filter(d => {
      const s = d.status.toLowerCase();
      return !s.includes("solved") && !s.includes("closed") && !s.includes("cleared") && !s.includes("resolved");
    });
  }, [txData, config]);

  // NUR Summary
  const nurSummary = useMemo(() => {
    if (!processedNUR.length) return { totalCNUR: 0, weeklyAvg: 0, totalTTs: 0, techBreakdown: [], topSites: [], monthlyTrend: [], weeklyTrend: [], areaBreakdown: [] };
    const totalCNUR = processedNUR.reduce((a, c) => a + (c.CNUR || 0), 0);
    const weeks = new Set(processedNUR.map(d => d.week));
    const weeklyAvg = totalCNUR / (weeks.size || 1);
    const totalTTs = new Set(processedNUR.map(d => d.ttId).filter(Boolean)).size || processedNUR.length;

    // Tech breakdown
    const techMap = {};
    processedNUR.forEach(r => {
      const t = r.parsedTech?.toUpperCase() || "";
      let tech = "Other";
      if (t.includes("2G") || t.includes("GSM")) tech = "2G";
      else if (t.includes("3G") || t.includes("UMTS")) tech = "3G";
      else if (t.includes("4G") || t.includes("LTE")) tech = "4G";
      else if (t.includes("5G") || t.includes("NR")) tech = "5G";
      techMap[tech] = (techMap[tech] || 0) + r.CNUR;
    });
    const techBreakdown = Object.entries(techMap).map(([name, value]) => ({ name, value: +value.toFixed(3) })).sort((a, b) => b.value - a.value);

    // Top sites
    const siteMap = {};
    processedNUR.forEach(r => {
      const s = r.siteCode || "Unknown";
      if (!siteMap[s]) siteMap[s] = { site: s, name: r.siteName, cnur: 0, count: 0 };
      siteMap[s].cnur += r.CNUR;
      siteMap[s].count++;
    });
    const topSites = Object.values(siteMap).sort((a, b) => b.cnur - a.cnur).slice(0, 5);

    // Monthly trend
    const monthMap = {};
    processedNUR.forEach(r => {
      const m = r.month;
      if (!monthMap[m]) monthMap[m] = { month: m, cnur: 0 };
      monthMap[m].cnur += r.CNURMonthly || 0;
    });
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyTrend = Object.values(monthMap).sort((a, b) => {
      const [mA, yA] = a.month.split("-"); const [mB, yB] = b.month.split("-");
      if (yA !== yB) return yA - yB;
      return months.indexOf(mA) - months.indexOf(mB);
    });

    // Weekly trend
    const weekMap = {};
    processedNUR.forEach(r => {
      if (!weekMap[r.week]) weekMap[r.week] = { week: r.week, cnur: 0 };
      weekMap[r.week].cnur += r.CNUR || 0;
    });
    const weeklyTrend = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));

    // Area breakdown
    const areaMap = {};
    processedNUR.forEach(r => {
      const areaKey = Object.keys(r).find(k => k.toLowerCase().replace(/[\s_]/g, "") === "area");
      const area = areaKey ? String(r[areaKey] || "Other").trim() : "Other";
      areaMap[area] = (areaMap[area] || 0) + r.CNUR;
    });
    const areaBreakdown = Object.entries(areaMap).map(([name, value]) => ({ name, value: +value.toFixed(3) })).sort((a, b) => b.value - a.value).slice(0, 6);

    return { totalCNUR: totalCNUR.toFixed(3), weeklyAvg: weeklyAvg.toFixed(3), totalTTs, techBreakdown, topSites, monthlyTrend, weeklyTrend, areaBreakdown };
  }, [processedNUR]);

  // HW Summary
  const hwSummary = useMemo(() => {
    const total = processedHW.length;
    const pending = processedHW.filter(d => d.status === "Pending").length;
    const assigned = total - pending;
    const officeMap = {};
    processedHW.forEach(r => {
      const off = (r.office || r["SC Office"] || r["Office"] || "Other").toUpperCase();
      officeMap[off] = (officeMap[off] || 0) + 1;
    });
    const byOffice = Object.entries(officeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    return { total, pending, assigned, byOffice };
  }, [processedHW]);

  // TX Summary
  const txSummary = useMemo(() => {
    const total = processedTx.length;
    const pending = processedTx.filter(d => d.status.toLowerCase().includes("pend")).length;
    const active = total - pending;
    const linkMap = {};
    processedTx.forEach(d => { if (d.linkId !== "Unknown") linkMap[d.linkId] = (linkMap[d.linkId] || 0) + 1; });
    const topLinks = Object.entries(linkMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + "…" : name, value }));
    return { total, pending, active, topLinks };
  }, [processedTx]);

  // Office consolidated
  const officeConsolidated = useMemo(() => {
    const map = {};
    processedHW.forEach(r => {
      const off = (r.office || r["SC Office"] || r["Office"] || "").toUpperCase();
      if (!off) return;
      if (!map[off]) map[off] = { name: off, hw: 0, tx: 0 };
      map[off].hw++;
    });
    processedTx.forEach(r => {
      const off = (r.office || r["SC Office"] || r["Office"] || "").toUpperCase();
      if (!off) return;
      if (!map[off]) map[off] = { name: off, hw: 0, tx: 0 };
      map[off].tx++;
    });
    return Object.values(map).map(d => ({ ...d, total: d.hw + d.tx })).sort((a, b) => b.total - a.total);
  }, [processedHW, processedTx]);

  const noData = !processedNUR.length && !processedHW.length && !processedTx.length;

  return (
    <div className="animate-fade-in" id="dashboard-content" style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"1rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
          <div style={{ background:"linear-gradient(135deg, #6366f1, #8b5cf6)", padding:"0.75rem", borderRadius:14 }}>
            <Layers size={26} color="white" />
          </div>
          <div>
            <h1 className="text-gradient" style={{ fontSize:"2rem", fontWeight:700, margin:0 }}>Executive Summary</h1>
            <p style={{ color:"var(--text-secondary)", margin:0, fontSize:"0.85rem" }}>Consolidated view across all modules • Management Dashboard V2</p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding:"0.5rem 1rem", display:"flex", alignItems:"center", gap:8 }}>
          <Clock size={14} color="var(--accent)" />
          <span style={{ fontSize:"0.8rem", color:"var(--text-secondary)" }}>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>

      {noData && (
        <div className="glass-panel" style={{ padding:"4rem", textAlign:"center" }}>
          <Layers size={48} color="var(--accent)" style={{ marginBottom:"1rem", opacity:0.5 }} />
          <h2 className="text-gradient" style={{ fontSize:"1.5rem", marginBottom:"0.5rem" }}>No Data Available</h2>
          <p style={{ color:"var(--text-secondary)" }}>Upload data in the NUR, Network HW, and Tx Issue tabs to see the executive summary here.</p>
        </div>
      )}

      {!noData && (<>
        {/* KPI Cards Row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"1rem" }}>
          <StatCard icon={Activity} label="Total CNUR" value={nurSummary.totalCNUR} sub={`Avg/wk: ${nurSummary.weeklyAvg}`} color="#6366f1" />
          <StatCard icon={Target} label="NUR Incidents" value={nurSummary.totalTTs} sub="Unique trouble tickets" color="#3b82f6" />
          <StatCard icon={HardDrive} label="HW Backlog" value={hwSummary.total} sub={`${hwSummary.pending} pending · ${hwSummary.assigned} assigned`} color="#f59e0b" />
          <StatCard icon={Wifi} label="TX Active" value={txSummary.total} sub={`${txSummary.active} active · ${txSummary.pending} pending`} color="#ef4444" />
          <StatCard icon={Users} label="Resources" value={config.resourceList?.length || 0} sub="Team members" color="#10b981" />
        </div>

        {/* Section: NUR Analysis */}
        <SectionTitle icon={Activity} title="NUR Analysis Summary" subtitle="Network unavailability rate breakdown" />
        <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:"1rem" }}>
          {/* Weekly CNUR Trend */}
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>📈 Weekly CNUR Trend</h4>
            <div style={{ height:250 }}>
              <ResponsiveContainer>
                <AreaChart data={nurSummary.weeklyTrend}>
                  <defs>
                    <linearGradient id="v2grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                  <XAxis dataKey="week" stroke="var(--text-secondary)" fontSize={11}/>
                  <YAxis stroke="var(--text-secondary)" fontSize={11}/>
                  <RechartsTooltip contentStyle={{ background:"var(--panel-bg)", border:"1px solid var(--panel-border)", borderRadius:8 }}/>
                  <Area type="monotone" dataKey="cnur" stroke="#6366f1" fill="url(#v2grad)" strokeWidth={2}>
                    <LabelList dataKey="cnur" position="top" offset={8} style={{ fill:"var(--text-secondary)", fontSize:10 }} formatter={v => Number(v).toFixed(3)}/>
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Tech Breakdown Pie */}
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>🔧 Technology Contribution</h4>
            <div style={{ height:250, display:"flex", alignItems:"center" }}>
              {nurSummary.techBreakdown.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={nurSummary.techBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                      {nurSummary.techBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                    </Pie>
                    <RechartsTooltip/>
                  </PieChart>
                </ResponsiveContainer>
              ) : <p style={{ color:"var(--text-secondary)", textAlign:"center", width:"100%" }}>No data</p>}
            </div>
          </div>
        </div>

        {/* NUR Area + Top Sites */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          {/* Area Breakdown */}
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>📊 CNUR by Area/Cause</h4>
            <div style={{ height:220 }}>
              {nurSummary.areaBreakdown.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={nurSummary.areaBreakdown} layout="vertical" margin={{ left:10, right:30 }}>
                    <XAxis type="number" hide/>
                    <YAxis dataKey="name" type="category" width={100} fontSize={10} stroke="var(--text-secondary)"/>
                    <RechartsTooltip/>
                    <Bar dataKey="value" fill="#6366f1" radius={[0,4,4,0]}>
                      <LabelList dataKey="value" position="right" style={{ fontSize:10 }}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{ color:"var(--text-secondary)", textAlign:"center", paddingTop:80 }}>No area data</p>}
            </div>
          </div>
          {/* Top 5 Sites */}
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>🏗️ Top 5 Impacted Sites</h4>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {nurSummary.topSites.map((s, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.6rem 0.8rem", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid var(--glass-border)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:`${COLORS[i]}20`, color:COLORS[i], display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12 }}>{i+1}</div>
                    <div>
                      <div style={{ fontSize:"0.85rem", fontWeight:600 }}>{s.site}</div>
                      <div style={{ fontSize:"0.7rem", color:"var(--text-secondary)" }}>{s.name}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:"0.85rem", fontWeight:700, color:COLORS[i] }}>{s.cnur.toFixed(3)}</div>
                    <div style={{ fontSize:"0.65rem", color:"var(--text-secondary)" }}>{s.count} TTs</div>
                  </div>
                </div>
              ))}
              {nurSummary.topSites.length === 0 && <p style={{ color:"var(--text-secondary)", textAlign:"center", padding:40 }}>No site data</p>}
            </div>
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="glass-panel" style={{ padding:"1.25rem" }}>
          <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>📅 Monthly CNUR Performance</h4>
          <div style={{ height:250 }}>
            {nurSummary.monthlyTrend.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={nurSummary.monthlyTrend} margin={{ top:20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                  <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={11}/>
                  <YAxis stroke="var(--text-secondary)" fontSize={11}/>
                  <RechartsTooltip contentStyle={{ background:"var(--panel-bg)", border:"1px solid var(--panel-border)", borderRadius:8 }}/>
                  <Bar dataKey="cnur" fill="var(--accent)" radius={[4,4,0,0]}>
                    <LabelList dataKey="cnur" position="top" offset={8} style={{ fill:"var(--text-primary)", fontSize:10, fontWeight:600 }} formatter={v => Number(v).toFixed(3)}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color:"var(--text-secondary)", textAlign:"center", paddingTop:80 }}>No monthly data</p>}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop:"1px dashed var(--accent)", margin:"0.5rem 0", opacity:0.3 }}/>

        {/* Section: Backlog Overview */}
        <SectionTitle icon={HardDrive} title="Backlog & Pending Tasks" subtitle="Hardware and Transmission consolidated view" />

        {/* Office Consolidated */}
        {officeConsolidated.length > 0 && (
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>🏢 Pending Tasks per Office (HW + TX)</h4>
            <div style={{ height:280 }}>
              <ResponsiveContainer>
                <BarChart data={officeConsolidated} margin={{ top:20, bottom:20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1}/>
                  <XAxis dataKey="name" stroke="var(--text-primary)" fontSize={10} interval={0}/>
                  <YAxis hide/>
                  <RechartsTooltip/>
                  <Legend/>
                  <Bar dataKey="hw" stackId="a" fill="#f59e0b" name="Hardware" radius={[0,0,0,0]}/>
                  <Bar dataKey="tx" stackId="a" fill="#3b82f6" name="Transmission" radius={[4,4,0,0]}>
                    <LabelList dataKey="total" position="top" style={{ fill:"var(--text-primary)", fontWeight:"bold", fontSize:11 }}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          {/* HW by Office */}
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>⚙️ HW Cases by Office</h4>
            <div style={{ height:220 }}>
              {hwSummary.byOffice.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={hwSummary.byOffice} layout="vertical" margin={{ left:10, right:30 }}>
                    <XAxis type="number" hide/>
                    <YAxis dataKey="name" type="category" width={80} fontSize={10} stroke="var(--text-secondary)"/>
                    <RechartsTooltip/>
                    <Bar dataKey="value" fill="#f59e0b" radius={[0,4,4,0]} name="Cases">
                      <LabelList dataKey="value" position="right" style={{ fontSize:10, fontWeight:600 }}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{ color:"var(--text-secondary)", textAlign:"center", paddingTop:80 }}>No HW data</p>}
            </div>
          </div>

          {/* TX Top Links */}
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <h4 style={{ marginBottom:"1rem", fontSize:"0.95rem" }}>📡 Top Impacted TX Links</h4>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {txSummary.topLinks.map((l, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.6rem 0.8rem", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid var(--glass-border)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:`${COLORS[i]}20`, color:COLORS[i], display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12 }}>{i+1}</div>
                    <span style={{ fontSize:"0.8rem", fontWeight:500 }}>{l.name}</span>
                  </div>
                  <span style={{ fontSize:"0.85rem", fontWeight:700, color:COLORS[i] }}>{l.value} hits</span>
                </div>
              ))}
              {txSummary.topLinks.length === 0 && <p style={{ color:"var(--text-secondary)", textAlign:"center", padding:40 }}>No TX link data</p>}
            </div>
          </div>
        </div>

        {/* Resources */}
        {config.resourceList?.length > 0 && (<>
          <div style={{ borderTop:"1px dashed var(--accent)", margin:"0.5rem 0", opacity:0.3 }}/>
          <SectionTitle icon={Users} title="Project Resources" subtitle="Assigned team members" />
          <div className="glass-panel" style={{ padding:"1.25rem" }}>
            <div className="table-container" style={{ maxHeight:280, overflowY:"auto" }}>
              <table style={{ width:"100%", textAlign:"left", fontSize:"0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--glass-border)" }}>
                    <th style={{ padding:10 }}>Name</th>
                    <th style={{ padding:10 }}>Role</th>
                    <th style={{ padding:10 }}>Office</th>
                  </tr>
                </thead>
                <tbody>
                  {config.resourceList.map((res, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding:10, fontWeight:500 }}>{res.name}</td>
                      <td style={{ padding:10 }}>{res.role}</td>
                      <td style={{ padding:10 }}>{res.office}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>)}
      </>)}
    </div>
  );
};

export default ManagementDashboardV2;
