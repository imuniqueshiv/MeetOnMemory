import React, { useState, useEffect } from 'react';
import { Lightbulb, Database, Award, CheckCircle, Plus, FileText, Search, Activity } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { ipVaultService } from '../services/ipVaultService';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B'];

const IpVaultDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const [ideas, setIdeas] = useState([]);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [analyticsRes, ideasRes] = await Promise.all([
                ipVaultService.getIpAnalytics(),
                ipVaultService.getIpIdeas({})
            ]);
            setAnalytics(analyticsRes.data);
            setIdeas(ideasRes.data);
        } catch (error) {
            console.error("Failed to fetch IP Vault data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900/50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-500"></div>
            </div>
        );
    }

    const filteredIdeas = filter === 'All' ? ideas : ideas.filter(i => i.status === filter.toLowerCase());

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-gray-900 to-fuchsia-950 p-6 md:p-10 font-sans text-gray-100">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-gray-700/50">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center">
                        <Lightbulb className="mr-3 h-8 w-8 text-fuchsia-400" />
                        Intellectual Property Vault
                    </h1>
                    <p className="text-gray-400 mt-2">Discover, classify, and track potential patents extracted from organic meeting dialogs.</p>
                </div>
                <div className="mt-4 md:mt-0 flex space-x-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search concepts..."
                            className="pl-9 pr-4 py-2 bg-gray-800/60 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-fuchsia-500 w-64"
                        />
                    </div>
                    <button className="px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-lg shadow-lg flex items-center transition-all text-sm font-medium">
                        <Plus className="h-4 w-4 mr-2" />
                        Register IP
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { title: "Total Concepts Logged", value: analytics?.totalIp || 0, icon: Database, color: "text-indigo-400", bg: "bg-indigo-400/10" },
                    { title: "Patentable Score > 80", value: analytics?.highValueIp || 0, icon: Activity, color: "text-fuchsia-400", bg: "bg-fuchsia-400/10" },
                    { title: "Currently Filed", value: analytics?.filedIp || 0, icon: FileText, color: "text-amber-400", bg: "bg-amber-400/10" },
                    { title: "Granted Patents", value: ideas.filter(i => i.status === 'granted').length, icon: Award, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-gray-600 transition-all">
                        <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${kpi.bg} blur-2xl rounded-full`} />
                        <div className="flex items-center space-x-4 relative z-10">
                            <div className={`p-3 rounded-lg ${kpi.bg}`}>
                                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm font-medium">{kpi.title}</p>
                                <h3 className="text-3xl font-bold text-white mt-1">{kpi.value}</h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Readiness Curve */}
                <div className="lg:col-span-2 bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-indigo-400" />
                        Patentability Readiness Curve
                    </h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics?.readinessTimeline || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#C026D3" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#C026D3" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '...' : v} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                                />
                                <Area type="monotone" dataKey="score" stroke="#C026D3" fillOpacity={1} fill="url(#colorScore)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Domain Distribution */}
                <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
                        <Database className="w-5 h-5 mr-2 text-fuchsia-400" />
                        Tech Domain Distribution
                    </h2>
                    <div className="h-72 w-full relative">
                        {analytics?.domains?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.domains}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {analytics.domains.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }} />
                                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-500">No data available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-700/50 flex flex-col md:flex-row justify-between md:items-center bg-gray-800/60">
                    <h2 className="text-lg font-semibold text-white">Innovation Ledger</h2>
                    <div className="flex space-x-2 mt-4 md:mt-0">
                        {['All', 'Identified', 'Under_Review', 'Filed', 'Granted'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filter === status ? 'bg-fuchsia-600 text-white' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'}`}
                            >
                                {status.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-gray-700/50">
                    {filteredIdeas.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            No intellectual property records found for this filter.
                        </div>
                    ) : (
                        filteredIdeas.map(idea => (
                            <div key={idea._id} className="p-6 hover:bg-gray-700/10 transition-colors">
                                <div className="flex flex-col lg:flex-row justify-between">
                                    <div className="lg:w-1/2">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider
                        ${idea.status === 'granted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    idea.status === 'filed' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                                                {idea.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">{idea.techDomain.replace('_', ' ')}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">{idea.conceptName}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed mb-4">{idea.description.substring(0, 140)}...</p>

                                        <div className="flex items-center space-x-2 mt-2">
                                            <span className="text-xs text-gray-500 font-medium mr-2">Discovered in:</span>
                                            <span className="text-sm text-indigo-300 flex items-center bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20">
                                                {idea.originMeetingId?.title || "Direct Entry"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="lg:w-1/3 mt-6 lg:mt-0 flex flex-col items-start lg:items-end lg:pr-4">
                                        <div className="w-full lg:w-48 mb-6">
                                            <div className="flex justify-between items-end mb-1">
                                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Patentability</span>
                                                <span className="text-lg font-bold text-white">{idea.patentabilityScore}</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-1.5 rounded-full ${idea.patentabilityScore >= 80 ? 'bg-fuchsia-500' : 'bg-indigo-500'}`} style={{ width: `${idea.patentabilityScore}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-start lg:items-end">
                                            <span className="text-xs text-gray-500 font-medium mb-2">Primary Inventors</span>
                                            <div className="flex -space-x-3">
                                                {idea.inventors?.map((inv, idx) => (
                                                    inv.avatar ? (
                                                        <img key={idx} src={inv.avatar} alt="inv" className="w-10 h-10 rounded-full border-2 border-gray-800 shadow-md" title={`${inv.firstName} ${inv.lastName}`} />
                                                    ) : (
                                                        <div key={idx} className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold border-2 border-gray-800 shadow-md" title={`${inv.firstName || ''}`}>
                                                            {inv.firstName?.[0] || 'I'}
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
export default IpVaultDashboard;

// Placeholder TrendingUp since lucide-react export might not have it loaded in some environments if not destructured correctly, just fallback
function TrendingUp(props) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
}
