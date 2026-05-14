import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Cell, PieChart, Pie } from 'recharts';
import { HardDrive, Activity, Clock, CheckCircle, AlertCircle, MessageSquare, Filter, Download, Info } from 'lucide-react';
import FileUpload from './FileUpload';

import { findKey, getWeekNumber, extractHWData } from '../utils/dataUtils';

const NetworkHWDashboard = ({ config, data, setData }) => {
    const [pendingComments, setPendingComments] = useState(() => {
        const saved = localStorage.getItem('network_hw_comments');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('network_hw_comments', JSON.stringify(pendingComments));
    }, [pendingComments]);

    const handleCommentChange = (id, field, value) => {
        setPendingComments(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const processedData = useMemo(() => {
        return extractHWData(data, config);
    }, [data, config]);

    const stats = useMemo(() => {
        const counts = { Assigned: 0, Pending: 0, Closed: 0, Total: 0 };
        processedData.forEach(row => {
            if (counts[row.status] !== undefined) {
                counts[row.status]++;
                counts.Total++;
            }
        });
        return counts;
    }, [processedData]);

    const weeklyTrend = useMemo(() => {
        const weekMap = {};
        processedData.forEach(row => {
            if (row.openWeek) {
                if (!weekMap[row.openWeek]) weekMap[row.openWeek] = { name: row.openWeek, Opened: 0, Closed: 0 };
                weekMap[row.openWeek].Opened++;
            }
            if (row.closeWeek) {
                if (!weekMap[row.closeWeek]) weekMap[row.closeWeek] = { name: row.closeWeek, Opened: 0, Closed: 0 };
                weekMap[row.closeWeek].Closed++;
            }
        });
        return Object.values(weekMap).sort((a, b) => a.name.localeCompare(b.name));
    }, [processedData]);

    const pendingCases = useMemo(() => {
        return processedData.filter(row => row.status === 'Pending');
    }, [processedData]);

    const pieData = [
        { name: 'Assigned', value: stats.Assigned, color: config.theme === 'orange' ? '#ff7900' : '#3b82f6' },
        { name: 'Pending', value: stats.Pending, color: '#f59e0b' },
        { name: 'Closed', value: stats.Closed, color: '#10b981' }
    ].filter(d => d.value > 0);

    const isDataLoaded = processedData.length > 0;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'var(--accent-bg)', padding: '0.75rem', borderRadius: '12px' }}>
                        <HardDrive size={24} color="var(--accent)" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Network Hardware Analysis</h2>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Upload hardware reports to track status and weekly closures.</p>
                    </div>
                </div>
                <FileUpload 
                    onDataProcessed={setData} 
                    title="Upload Network HW Report" 
                    description="Upload your hardware status report to track ticket progress and weekly closure trends."
                />
            </div>

            {isDataLoaded && (
                <div id="dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Top Stats */}
                    <div className="dashboard-grid">
                        <div className="glass-panel metric-card m-blue">
                            <Activity className="icon" />
                            <div className="value">{stats.Total}</div>
                            <div className="label">Total Cases</div>
                        </div>
                        <div className="glass-panel metric-card m-orange">
                            <Clock className="icon" />
                            <div className="value">{stats.Pending}</div>
                            <div className="label">Pending Cases</div>
                        </div>
                        <div className="glass-panel metric-card m-green">
                            <CheckCircle className="icon" />
                            <div className="value">{stats.Closed}</div>
                            <div className="label">Closed Cases</div>
                        </div>
                        <div className="glass-panel metric-card m-purple">
                            <AlertCircle className="icon" />
                            <div className="value">{stats.Assigned}</div>
                            <div className="label">Assigned Cases</div>
                        </div>
                    </div>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        {/* Weekly Trend Chart */}
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <Activity size={20} color="var(--accent)" />
                                Weekly Progress (Opened vs Closed)
                            </h3>
                            <div style={{ height: '300px', width: '100%' }}>
                                <ResponsiveContainer>
                                    <BarChart data={weeklyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={12} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="Opened" fill={config.theme === 'orange' ? '#ff7900' : '#3b82f6'} radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Closed" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Status Distribution Pie */}
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <Filter size={20} color="var(--accent)" />
                                Status Distribution
                            </h3>
                            <div style={{ height: '300px', width: '100%' }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip 
                                             contentStyle={{ backgroundColor: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Pending Cases Table */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <Clock size={20} color="#f59e0b" />
                                Pending Cases (Other Teams Responsibility)
                            </h3>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Showing {pendingCases.length} pending cases
                            </span>
                        </div>
                        <div className="table-container">
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                <thead>
                                    <tr style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        <th style={{ padding: '0 1rem' }}>Open Time</th>
                                        <th style={{ padding: '0 1rem' }}>Site Name</th>
                                        <th style={{ padding: '0 1rem' }}>Action</th>
                                        <th style={{ padding: '0 1rem', width: '20%' }}>Responsible Team</th>
                                        <th style={{ padding: '0 1rem', width: '25%' }}>Comment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingCases.length > 0 ? pendingCases.map((row, i) => (
                                        <tr key={i} className="hover-row" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                            <td style={{ padding: '1rem', borderRadius: '8px 0 0 8px' }}>
                                                {row.openTime ? row.openTime.toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td style={{ padding: '1rem' }}>{row.siteName}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontSize: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.action}>
                                                    {row.action}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <select 
                                                    value={pendingComments[row.id]?.team || ''}
                                                    onChange={(e) => handleCommentChange(row.id, 'team', e.target.value)}
                                                    style={{ 
                                                        width: '100%', 
                                                        background: 'rgba(0,0,0,0.2)', 
                                                        border: '1px solid rgba(255,255,255,0.1)', 
                                                        borderRadius: '6px', 
                                                        color: 'white', 
                                                        padding: '8px',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    <option value="">Select Team...</option>
                                                    {['SPM', 'Sharing Team', 'Site Management', 'Soc team', 'TE', 'New Site', 'Modifications', 'Rollout', 'Optimization', 'RQA', 'BO', 'Tx Team', 'H&S'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '1rem', borderRadius: '0 8px 8px 0' }}>
                                                <textarea 
                                                    placeholder="Add comment..."
                                                    value={pendingComments[row.id]?.comment || ''}
                                                    onChange={(e) => handleCommentChange(row.id, 'comment', e.target.value)}
                                                    style={{ 
                                                        width: '100%', 
                                                        background: 'rgba(0,0,0,0.2)', 
                                                        border: '1px solid rgba(255,255,255,0.1)', 
                                                        borderRadius: '6px', 
                                                        color: 'white', 
                                                        padding: '8px',
                                                        fontSize: '0.85rem',
                                                        resize: 'none'
                                                    }}
                                                    rows={1}
                                                />
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                                No pending cases found in the uploaded report.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetworkHWDashboard;
