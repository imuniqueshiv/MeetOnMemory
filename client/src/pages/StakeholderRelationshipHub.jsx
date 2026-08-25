import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Star, TrendingUp, Plus, Shield, Activity, Search, Briefcase } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, ScatterChart, Scatter, ZAxis, Legend, Cell
} from 'recharts';
import { stakeholderService } from '../services/stakeholderService';

const RISK_COLORS = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E' };
const TIER_COLORS = { strategic: '#8B5CF6', key: '#6366F1', standard: '#60A5FA', inactive: '#6B7280' };
const CATEGORY_COLORS = ['#8B5CF6', '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#EF4444'];

const HealthBar = ({ score }) => {
    const color = score >= 75 ? '#22C55E' : score >= 50 ? '#EAB308' : score >= 25 ? '#F97316' : '#EF4444';
    return (
        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
    );
};

const RiskBadge = ({ risk }) => {
    const styles = {
        critical: 'bg-red-500/10 text-red-400 border-red-500/20',
        high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        low: 'bg-green-500/10 text-green-400 border-green-500/20'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${styles[risk] || styles.low}`}>
            {risk}
        </span>
    );
};

const TierBadge = ({ tier }) => {
    const styles = {
        strategic: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        key: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        standard: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${styles[tier] || styles.standard}`}>
            {tier}
        </span>
    );
};

const StakeholderRelationshipHub = () => {
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const [stakeholders, setStakeholders] = useState([]);
    const [search, setSearch] = useState('');
    const [filterRisk, setFilterRisk] = useState('All');
    const [filterTier, setFilterTier] = useState('All');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [analyticsRes, stakeholderRes] = await Promise.all([
                stakeholderService.getAnalytics(),
                stakeholderService.getStakeholders({})
            ]);
            setAnalytics(analyticsRes.data);
            setStakeholders(stakeholderRes.data);
        } catch (err) {
            console.error('Error fetching stakeholder data', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-violet-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Stakeholder Intelligence...</p>
                </div>
            </div>
        );
    }

    const filtered = stakeholders.filter(s => {
        const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.company?.toLowerCase().includes(search.toLowerCase());
        const matchRisk = filterRisk === 'All' || s.riskLevel === filterRisk.toLowerCase();
        const matchTier = filterTier === 'All' || s.tier === filterTier.toLowerCase();
        return matchSearch && matchRisk && matchTier;
    });

    const scatterData = (analytics?.riskMatrix || []).map(s => ({
        name: s.name,
        x: s.meetings,
        y: s.health,
        z: 200,
        risk: s.risk
    }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-violet-950/30 to-gray-900 p-6 md:p-10 font-sans text-gray-100">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-gray-700/50">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center tracking-tight">
                        <Briefcase className="mr-3 h-8 w-8 text-violet-400" />
                        Stakeholder Relationship Hub
                    </h1>
                    <p className="text-gray-400 mt-2">Monitor vendor, client, and partner health scores derived from meeting engagement telemetry.</p>
                </div>
                <div className="mt-4 md:mt-0 flex space-x-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search stakeholders..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500 w-60"
                        />
                    </div>
                    <button className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white rounded-lg shadow-lg flex items-center text-sm font-medium transition-all">
                        <Plus className="h-4 w-4 mr-2" /> Add Stakeholder
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {[
                    { title: 'Total Stakeholders', value: analytics?.total || 0, icon: Users, color: 'text-violet-400', bg: 'from-violet-600/10 to-violet-600/5' },
                    { title: 'At-Risk Relationships', value: analytics?.atRisk || 0, icon: AlertTriangle, color: 'text-rose-400', bg: 'from-rose-600/10 to-rose-600/5' },
                    { title: 'Strategic Accounts', value: analytics?.strategicCount || 0, icon: Star, color: 'text-amber-400', bg: 'from-amber-600/10 to-amber-600/5' },
                    { title: 'Avg. Relationship Health', value: `${analytics?.avgHealth || 0}%`, icon: Activity, color: 'text-emerald-400', bg: 'from-emerald-600/10 to-emerald-600/5' },
                ].map((kpi, i) => (
                    <div key={i} className={`bg-gradient-to-br ${kpi.bg} backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl hover:border-gray-600 transition-all`}>
                        <div className="flex items-center space-x-4">
                            <div className="p-3 rounded-xl bg-gray-800/60">
                                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">{kpi.title}</p>
                                <h3 className="text-3xl font-bold text-white mt-0.5">{kpi.value}</h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Category Breakdown */}
                <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-5 flex items-center">
                        <Shield className="w-5 h-5 mr-2 text-violet-400" /> Stakeholder Category Breakdown
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics?.categoryData || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                                <ReTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} name="Count">
                                    {(analytics?.categoryData || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Risk vs Meeting Engagement Scatter */}
                <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-5 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-violet-400" /> Health vs. Meeting Engagement
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" dataKey="x" name="Meetings" tick={{ fill: '#9CA3AF', fontSize: 11 }} label={{ value: 'Meetings', position: 'insideBottom', offset: -5, fill: '#6B7280', fontSize: 11 }} />
                                <YAxis type="number" dataKey="y" name="Health" domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 11 }} label={{ value: 'Health', angle: -90, position: 'insideLeft', fill: '#6B7280', fontSize: 11 }} />
                                <ZAxis type="number" dataKey="z" range={[60, 60]} />
                                <ReTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }} formatter={(val, name) => [val, name]} />
                                <Scatter data={scatterData} name="Stakeholders">
                                    {scatterData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.risk] || '#6366F1'} fillOpacity={0.8} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex space-x-3 mt-3 justify-center">
                        {Object.entries(RISK_COLORS).map(([risk, color]) => (
                            <div key={risk} className="flex items-center space-x-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-xs text-gray-400 capitalize">{risk}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stakeholder List */}
            <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-700/50 bg-gray-800/60 flex flex-col md:flex-row justify-between md:items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">Relationship Ledger</h2>
                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500 mr-1">Risk:</span>
                            {['All', 'Critical', 'High', 'Medium', 'Low'].map(r => (
                                <button key={r} onClick={() => setFilterRisk(r)}
                                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterRisk === r ? 'bg-violet-600 text-white' : 'bg-gray-700/60 text-gray-300 hover:bg-gray-700'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500 mr-1">Tier:</span>
                            {['All', 'Strategic', 'Key', 'Standard'].map(t => (
                                <button key={t} onClick={() => setFilterTier(t)}
                                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${filterTier === t ? 'bg-violet-600 text-white' : 'bg-gray-700/60 text-gray-300 hover:bg-gray-700'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-700/30">
                    <div className="col-span-3">Stakeholder</div>
                    <div className="col-span-2">Category / Tier</div>
                    <div className="col-span-3">Relationship Health</div>
                    <div className="col-span-1 text-center">Meetings</div>
                    <div className="col-span-2 text-center">Risk</div>
                    <div className="col-span-1 text-center">Owner</div>
                </div>

                <div className="divide-y divide-gray-700/30">
                    {filtered.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">No stakeholders match the current filters.</div>
                    ) : (
                        filtered.map(s => (
                            <div key={s._id} className="grid grid-cols-12 px-6 py-4 hover:bg-gray-700/10 transition-colors items-center">
                                {/* Name & Company */}
                                <div className="col-span-3 flex items-center space-x-3">
                                    {s.avatar ? (
                                        <img src={s.avatar} alt={s.name} className="w-10 h-10 rounded-full border border-gray-600 object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                            {s.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">{s.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{s.company || '—'} · {s.role || '—'}</p>
                                    </div>
                                </div>

                                {/* Category / Tier */}
                                <div className="col-span-2 flex flex-col space-y-1">
                                    <span className="text-xs text-gray-300 capitalize">{s.category}</span>
                                    <TierBadge tier={s.tier} />
                                </div>

                                {/* Health Bar */}
                                <div className="col-span-3 pr-6">
                                    <div className="flex justify-between mb-1.5">
                                        <span className="text-xs text-gray-400">Health</span>
                                        <span className="text-xs font-bold text-white">{s.relationshipHealth}%</span>
                                    </div>
                                    <HealthBar score={s.relationshipHealth} />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Last: {s.lastInteraction ? new Date(s.lastInteraction).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}
                                    </p>
                                </div>

                                {/* Meetings */}
                                <div className="col-span-1 text-center">
                                    <span className="text-lg font-bold text-violet-300">{s.totalMeetings}</span>
                                </div>

                                {/* Risk */}
                                <div className="col-span-2 text-center">
                                    <RiskBadge risk={s.riskLevel} />
                                </div>

                                {/* Account Manager */}
                                <div className="col-span-1 flex justify-center">
                                    {s.accountManager?.avatar ? (
                                        <img src={s.accountManager.avatar} alt="am" className="w-8 h-8 rounded-full border border-gray-600" title={`${s.accountManager.firstName}`} />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                                            {s.accountManager?.firstName?.[0] || '?'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default StakeholderRelationshipHub;
