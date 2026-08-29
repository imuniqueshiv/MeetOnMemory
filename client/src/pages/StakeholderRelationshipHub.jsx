import React, { useState, useEffect } from 'react';
import {
    Users, AlertTriangle, Star, Heart, Search, Filter, Plus, Building2,
    Briefcase, TrendingUp, Shield, ShieldAlert, ShieldCheck, ShieldX,
    MessageSquare, Calendar, ChevronDown, ChevronUp, X, Send, BarChart3
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, ResponsiveContainer, Cell,
    ScatterChart, Scatter, ZAxis
} from 'recharts';
import { stakeholderService } from '../services/stakeholderService';

const CATEGORY_COLORS = {
    client: '#6366F1',
    vendor: '#F59E0B',
    partner: '#10B981',
    investor: '#EC4899'
};

const RISK_COLORS = {
    low: { text: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/10', bar: '#22C55E' },
    medium: { text: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/10', bar: '#EAB308' },
    high: { text: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/10', bar: '#F97316' },
    critical: { text: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/10', bar: '#EF4444' }
};

const HEALTH_COLOR = (score) => {
    if (score >= 70) return '#22C55E';
    if (score >= 45) return '#EAB308';
    if (score >= 20) return '#F97316';
    return '#EF4444';
};

const TIER_ICONS = {
    strategic: Star,
    operational: Briefcase,
    tactical: Shield
};

const HealthBar = ({ score, height = 8 }) => (
    <div className="w-full bg-gray-700 rounded-full overflow-hidden" style={{ height }}>
        <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${score}%`, backgroundColor: HEALTH_COLOR(score) }}
        />
    </div>
);

const HealthRing = ({ score, size = 64 }) => {
    const r = (size - 8) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (score / 100) * circumference;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth="5" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={HEALTH_COLOR(score)} strokeWidth="5"
                strokeDasharray={circumference} strokeDashoffset={offset}
                strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
            <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">{score}</text>
        </svg>
    );
};

const RiskBadge = ({ risk }) => {
    const rc = RISK_COLORS[risk] || RISK_COLORS.medium;
    const IconMap = { low: ShieldCheck, medium: Shield, high: ShieldAlert, critical: ShieldX };
    const Icon = IconMap[risk] || Shield;
    return (
        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${rc.border} ${rc.bg} ${rc.text}`}>
            <Icon className="w-3 h-3" />
            <span className="capitalize">{risk}</span>
        </span>
    );
};

const StakeholderRelationshipHub = () => {
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const [stakeholders, setStakeholders] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRisk, setFilterRisk] = useState('All');
    const [filterTier, setFilterTier] = useState('All');
    const [expandedId, setExpandedId] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showInteractionModal, setShowInteractionModal] = useState(false);
    const [selectedStakeholder, setSelectedStakeholder] = useState(null);
    const [newStakeholder, setNewStakeholder] = useState({
        name: '', email: '', company: '', category: 'client', tier: 'operational', notes: ''
    });
    const [newInteraction, setNewInteraction] = useState({
        type: 'meeting', sentiment: 0, engagement: 50, summary: '', meetingId: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [analyticsRes, stakeholdersRes] = await Promise.all([
                stakeholderService.getAnalytics(),
                stakeholderService.getStakeholders({})
            ]);
            setAnalytics(analyticsRes.data);
            setStakeholders(stakeholdersRes.data);
        } catch (err) {
            console.error('Failed to fetch stakeholder data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStakeholder = async () => {
        try {
            await stakeholderService.createStakeholder(newStakeholder);
            setShowAddModal(false);
            setNewStakeholder({ name: '', email: '', company: '', category: 'client', tier: 'operational', notes: '' });
            fetchData();
        } catch (err) {
            console.error('Failed to create stakeholder', err);
        }
    };

    const handleLogInteraction = async () => {
        try {
            await stakeholderService.logInteraction(selectedStakeholder._id, newInteraction);
            setShowInteractionModal(false);
            setSelectedStakeholder(null);
            setNewInteraction({ type: 'meeting', sentiment: 0, engagement: 50, summary: '', meetingId: '' });
            fetchData();
        } catch (err) {
            console.error('Failed to log interaction', err);
        }
    };

    const handleDeleteStakeholder = async (id) => {
        try {
            await stakeholderService.deleteStakeholder(id);
            fetchData();
        } catch (err) {
            console.error('Failed to delete stakeholder', err);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading Stakeholder Intelligence Hub...</p>
                </div>
            </div>
        );
    }

    const filtered = stakeholders.filter(s => {
        const matchesSearch = !searchQuery ||
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.company || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRisk = filterRisk === 'All' || s.riskLevel === filterRisk;
        const matchesTier = filterTier === 'All' || s.tier === filterTier;
        return matchesSearch && matchesRisk && matchesTier;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950/20 p-6 md:p-10 font-sans text-gray-100">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-gray-700/50">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center tracking-tight">
                        <Users className="mr-3 h-8 w-8 text-indigo-400" />
                        Stakeholder & Vendor Relationship Intelligence Hub
                    </h1>
                    <p className="text-gray-400 mt-2">Track relationship health across clients, vendors, partners, and investors — powered by meeting engagement and sentiment data.</p>
                </div>
                <div className="mt-4 md:mt-0">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white rounded-lg shadow-lg flex items-center text-sm font-medium transition-all"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Add Stakeholder
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {[
                    { title: 'Total Stakeholders', value: analytics?.total || 0, icon: Users, color: 'text-indigo-400', bg: 'from-indigo-600/10 to-indigo-600/5' },
                    { title: 'At-Risk Relationships', value: analytics?.atRisk || 0, icon: AlertTriangle, color: 'text-rose-400', bg: 'from-rose-600/10 to-rose-600/5' },
                    { title: 'Strategic Partners', value: analytics?.strategic || 0, icon: Star, color: 'text-amber-400', bg: 'from-amber-600/10 to-amber-600/5' },
                    { title: 'Avg Health Score', value: `${analytics?.avgHealth || 0}%`, icon: Heart, color: 'text-emerald-400', bg: 'from-emerald-600/10 to-emerald-600/5' }
                ].map((kpi, i) => (
                    <div key={i} className={`bg-gradient-to-br ${kpi.bg} backdrop-blur border border-gray-700/50 rounded-xl p-6 shadow-xl hover:border-gray-600 transition-all`}>
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

            {/* Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Category Breakdown Horizontal Bar Chart */}
                <div className="bg-gray-800/40 backdrop-blur border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-5 flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2 text-indigo-400" /> Stakeholder by Category
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics?.categoryBreakdown || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                                <ReTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} name="Count">
                                    {(analytics?.categoryBreakdown || []).map((entry, i) => (
                                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#6B7280'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Health vs Meeting Engagement Scatter Chart */}
                <div className="bg-gray-800/40 backdrop-blur border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-5 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-indigo-400" /> Health vs. Meeting Engagement
                    </h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" dataKey="engagement" name="Meetings" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Meetings Attended', position: 'bottom', fill: '#6B7280', fontSize: 11 }} />
                                <YAxis type="number" dataKey="health" name="Health" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Health Score', angle: -90, position: 'insideLeft', fill: '#6B7280', fontSize: 11 }} />
                                <ZAxis range={[60, 200]} />
                                <ReTooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                                    formatter={(value, name) => [value, name]}
                                />
                                <Scatter data={analytics?.scatterData || []} fill="#818CF8">
                                    {(analytics?.scatterData || []).map((entry, i) => (
                                        <Cell key={i} fill={CATEGORY_COLORS[entry.category] || '#818CF8'} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by name or company..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
                <div className="flex space-x-3">
                    <div className="flex items-center space-x-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <select
                            value={filterRisk}
                            onChange={(e) => setFilterRisk(e.target.value)}
                            className="px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
                        >
                            {['All', 'low', 'medium', 'high', 'critical'].map(r => (
                                <option key={r} value={r}>{r === 'All' ? 'All Risk' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <select
                        value={filterTier}
                        onChange={(e) => setFilterTier(e.target.value)}
                        className="px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
                    >
                        {['All', 'strategic', 'operational', 'tactical'].map(t => (
                            <option key={t} value={t}>{t === 'All' ? 'All Tiers' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Relationship Ledger */}
            <div className="bg-gray-800/40 backdrop-blur border border-gray-700/50 rounded-xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-700/40">
                    <h2 className="text-lg font-semibold text-white flex items-center">
                        <Briefcase className="w-5 h-5 mr-2 text-indigo-400" /> Relationship Ledger
                        <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length} stakeholders)</span>
                    </h2>
                </div>

                {filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p>No stakeholders found. Add your first stakeholder to begin tracking relationships.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700/40">
                        {filtered.map(stakeholder => {
                            const TierIcon = TIER_ICONS[stakeholder.tier] || Briefcase;
                            const isExpanded = expandedId === stakeholder._id;
                            const recentInteractions = (stakeholder.interactions || []).slice(-5).reverse();

                            return (
                                <div key={stakeholder._id} className="hover:bg-gray-750 transition-colors">
                                    {/* Stakeholder Row */}
                                    <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : stakeholder._id)}>
                                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                                            <HealthRing score={stakeholder.healthScore} size={48} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <h3 className="text-base font-bold text-white truncate">{stakeholder.name}</h3>
                                                    <RiskBadge risk={stakeholder.riskLevel} />
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium capitalize border"
                                                        style={{
                                                            color: CATEGORY_COLORS[stakeholder.category],
                                                            borderColor: CATEGORY_COLORS[stakeholder.category] + '40',
                                                            backgroundColor: CATEGORY_COLORS[stakeholder.category] + '15'
                                                        }}>
                                                        {stakeholder.category}
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-3 text-xs text-gray-400">
                                                    <span className="flex items-center space-x-1">
                                                        <TierIcon className="w-3 h-3" />
                                                        <span className="capitalize">{stakeholder.tier}</span>
                                                    </span>
                                                    {stakeholder.company && (
                                                        <span className="flex items-center space-x-1">
                                                            <Building2 className="w-3 h-3" />
                                                            <span>{stakeholder.company}</span>
                                                        </span>
                                                    )}
                                                    <span>{stakeholder.totalMeetingsAttended || 0} meetings</span>
                                                </div>
                                                <div className="mt-2 w-48">
                                                    <HealthBar score={stakeholder.healthScore} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3 ml-4">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedStakeholder(stakeholder); setShowInteractionModal(true); }}
                                                className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-medium hover:bg-indigo-600/30 transition-colors"
                                            >
                                                Log Interaction
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteStakeholder(stakeholder._id); }}
                                                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                        </div>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className="px-6 pb-5 border-t border-gray-700/30 pt-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Details Column */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Email</span>
                                                            <span className="text-gray-200">{stakeholder.email || '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Company</span>
                                                            <span className="text-gray-200">{stakeholder.company || '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Status</span>
                                                            <span className="text-gray-200 capitalize">{stakeholder.status}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Last Interaction</span>
                                                            <span className="text-gray-200">
                                                                {stakeholder.lastInteractionDate
                                                                    ? new Date(stakeholder.lastInteractionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                        {stakeholder.notes && (
                                                            <div className="mt-2 p-2 bg-gray-800/60 rounded text-gray-300 text-xs leading-relaxed">
                                                                {stakeholder.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Recent Interactions */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                                                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Recent Interactions
                                                    </h4>
                                                    {recentInteractions.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {recentInteractions.map((interaction, idx) => (
                                                                <div key={idx} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <span className="text-xs font-medium text-indigo-400 capitalize">{interaction.type}</span>
                                                                        <span className="text-xs text-gray-500">
                                                                            {interaction.date ? new Date(interaction.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                                                        </span>
                                                                    </div>
                                                                    {interaction.summary && (
                                                                        <p className="text-xs text-gray-300 leading-relaxed mb-2">{interaction.summary}</p>
                                                                    )}
                                                                    <div className="flex items-center space-x-4 text-xs">
                                                                        <span className={`flex items-center space-x-1 ${interaction.sentiment >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                            <span>Sentiment: {interaction.sentiment > 0 ? '+' : ''}{interaction.sentiment.toFixed(2)}</span>
                                                                        </span>
                                                                        <span className="text-gray-400">Engagement: {interaction.engagement}%</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 italic">No interactions logged yet.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Stakeholder Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
                            <h3 className="text-lg font-bold text-white">Add New Stakeholder</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
                                <input type="text" value={newStakeholder.name} onChange={e => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. Acme Corp" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                                    <input type="email" value={newStakeholder.email} onChange={e => setNewStakeholder({ ...newStakeholder, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="contact@example.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Company</label>
                                    <input type="text" value={newStakeholder.company} onChange={e => setNewStakeholder({ ...newStakeholder, company: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="Company name" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Category *</label>
                                    <select value={newStakeholder.category} onChange={e => setNewStakeholder({ ...newStakeholder, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                                        <option value="client">Client</option>
                                        <option value="vendor">Vendor</option>
                                        <option value="partner">Partner</option>
                                        <option value="investor">Investor</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Tier</label>
                                    <select value={newStakeholder.tier} onChange={e => setNewStakeholder({ ...newStakeholder, tier: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                                        <option value="strategic">Strategic</option>
                                        <option value="operational">Operational</option>
                                        <option value="tactical">Tactical</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Notes</label>
                                <textarea value={newStakeholder.notes} onChange={e => setNewStakeholder({ ...newStakeholder, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 h-20 resize-none" placeholder="Optional notes..." />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 p-5 border-t border-gray-700/50">
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleCreateStakeholder}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center">
                                <Plus className="w-4 h-4 mr-1.5" /> Create Stakeholder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Interaction Modal */}
            {showInteractionModal && selectedStakeholder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-bold text-white">Log Interaction</h3>
                                <p className="text-sm text-gray-400 mt-0.5">with {selectedStakeholder.name}</p>
                            </div>
                            <button onClick={() => { setShowInteractionModal(false); setSelectedStakeholder(null); }} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Interaction Type</label>
                                <select value={newInteraction.type} onChange={e => setNewInteraction({ ...newInteraction, type: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                                    <option value="meeting">Meeting</option>
                                    <option value="email">Email</option>
                                    <option value="call">Call</option>
                                    <option value="note">Note</option>
                                    <option value="follow_up">Follow-up</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                    Sentiment ({newInteraction.sentiment > 0 ? '+' : ''}{newInteraction.sentiment.toFixed(2)})
                                </label>
                                <input type="range" min="-1" max="1" step="0.1" value={newInteraction.sentiment}
                                    onChange={e => setNewInteraction({ ...newInteraction, sentiment: parseFloat(e.target.value) })}
                                    className="w-full accent-indigo-500" />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Negative</span><span>Neutral</span><span>Positive</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">
                                    Engagement Level ({newInteraction.engagement}%)
                                </label>
                                <input type="range" min="0" max="100" step="5" value={newInteraction.engagement}
                                    onChange={e => setNewInteraction({ ...newInteraction, engagement: parseInt(e.target.value) })}
                                    className="w-full accent-indigo-500" />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Disengaged</span><span>Moderate</span><span>Highly Engaged</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Summary</label>
                                <textarea value={newInteraction.summary} onChange={e => setNewInteraction({ ...newInteraction, summary: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 h-20 resize-none"
                                    placeholder="Brief summary of the interaction..." />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 p-5 border-t border-gray-700/50">
                            <button onClick={() => { setShowInteractionModal(false); setSelectedStakeholder(null); }}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                            <button onClick={handleLogInteraction}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center">
                                <Send className="w-4 h-4 mr-1.5" /> Log Interaction
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StakeholderRelationshipHub;
