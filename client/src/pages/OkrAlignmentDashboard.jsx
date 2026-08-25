import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, AlertCircle, CheckCircle, BarChart2, Plus, Clock, Users } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { okrService } from '../services/okrService';
// Assuming some basic UI components from standard MeetOnMemory UI folder structure, substituting with divs if not present
// For local protocol, self-contained as much as possible

const OkrAlignmentDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);
    const [okrs, setOkrs] = useState([]);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Parallel fetch for speed
            const [analyticsRes, okrsRes] = await Promise.all([
                okrService.getOkrAnalytics(),
                okrService.getOkrs()
            ]);
            setAnalytics(analyticsRes.data);
            setOkrs(okrsRes.data);
        } catch (error) {
            console.error("Error fetching OKR data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900/50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    // Mock Radar data for structural alignment
    const radarData = [
        { subject: 'Engineering', A: 120, A_desc: 'Meeting Hours' },
        { subject: 'Marketing', A: 98, A_desc: 'Meeting Hours' },
        { subject: 'Sales', A: 86, A_desc: 'Meeting Hours' },
        { subject: 'Product', A: 99, A_desc: 'Meeting Hours' },
        { subject: 'HR', A: 85, A_desc: 'Meeting Hours' },
        { subject: 'Finance', A: 65, A_desc: 'Meeting Hours' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-950 p-6 md:p-10 font-sans text-gray-100">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-gray-700/50">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center">
                        <Target className="mr-3 h-8 w-8 text-indigo-400" />
                        OKR Alignment & Impact Matrix
                    </h1>
                    <p className="text-gray-400 mt-2">Track meeting efficiency and organizational alignment against Q3 Objectives.</p>
                </div>
                <div className="mt-4 md:mt-0 flex space-x-3">
                    <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-600 transition-colors shadow-sm text-sm font-medium">
                        Export Report
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg flex items-center transition-colors text-sm font-medium">
                        <Plus className="h-4 w-4 mr-2" />
                        New Objective
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { title: "Total Objectives", value: analytics?.totalOkrs || 0, icon: Target, color: "text-blue-400", bg: "bg-blue-400/10" },
                    { title: "Avg Alignment Score", value: `${Math.round(analytics?.averageAlignment || 0)}%`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                    { title: "On Track", value: analytics?.onTrackCount || 0, icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
                    { title: "At Risk / Behind", value: analytics?.atRiskCount || 0, icon: AlertCircle, color: "text-rose-400", bg: "bg-rose-400/10" },
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-gray-600 transition-all">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${kpi.bg} blur-2xl rounded-full -mr-8 -mt-8`} />
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

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                {/* Time Investment Bar Chart */}
                <div className="lg:col-span-2 bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-indigo-400" />
                        Meeting Time Investment by Objective (Top)
                    </h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics?.timeInvestmentByObjective || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="objective" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: '#374151', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                                />
                                <Bar dataKey="hours" fill="#6366F1" radius={[4, 4, 0, 0]} name="Meeting Hours" barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Dept Focus Radar Chart */}
                <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-6 flex items-center">
                        <Users className="w-5 h-5 mr-2 text-indigo-400" />
                        Departmental Alignment
                    </h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke="#374151" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                                <Radar name="Alignment Load" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.4} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Objectives Table Header */}
            <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-700/50 flex justify-between items-center bg-gray-800/60">
                    <h2 className="text-lg font-semibold text-white">Active Objectives Register</h2>
                    <div className="flex space-x-2">
                        {['All', 'On Track', 'At Risk', 'Behind'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filter === status ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-gray-700/50 text-gray-400 hover:text-gray-200'}`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Objectives List */}
                <div className="divide-y divide-gray-700/50">
                    {okrs.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            No Objectives found. Create one to start tracking alignment.
                        </div>
                    ) : (
                        okrs.map(okr => (
                            <div key={okr._id} className="p-6 hover:bg-gray-700/20 transition-colors">
                                <div className="flex flex-col lg:flex-row justify-between lg:items-center">

                                    {/* Info */}
                                    <div className="mb-4 lg:mb-0 lg:w-1/3">
                                        <div className="flex items-center space-x-3 mb-1">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider
                        ${okr.status === 'active' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                                                {okr.quarter}
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                        ${okr.alignmentScore >= 75 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : okr.alignmentScore < 40 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                {okr.alignmentScore >= 75 ? 'On Track' : okr.alignmentScore < 40 ? 'Behind' : 'At Risk'}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">{okr.objective}</h3>
                                        <p className="text-sm text-gray-400">{okr.description?.substring(0, 80)}...</p>
                                    </div>

                                    {/* KRs Progress */}
                                    <div className="lg:w-1/3 lg:px-6">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-sm font-medium text-gray-300">Alignment / KR Progress</span>
                                            <span className="text-lg font-bold text-white">{Math.round(okr.alignmentScore || 0)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                            <div className={`h-2.5 rounded-full ${okr.alignmentScore >= 75 ? 'bg-green-500' : okr.alignmentScore < 40 ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${okr.alignmentScore || 0}%` }}></div>
                                        </div>
                                        <div className="mt-3 flex space-x-2 text-xs text-gray-500">
                                            <span>{okr.keyResults?.length || 0} Key Results Linked</span>
                                        </div>
                                    </div>

                                    {/* Meeting Time & Owner */}
                                    <div className="lg:w-1/4 flex justify-between items-center mt-4 lg:mt-0">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-indigo-400">{Math.round(okr.totalMeetingHoursLinked || 0)}</div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wide">Meeting Hrs</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-emerald-400">{okr.associatedMeetings?.length || 0}</div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wide">Meetings</div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {okr.ownerId?.avatar ? (
                                                <img src={okr.ownerId.avatar} alt="owner" className="w-10 h-10 rounded-full border-2 border-gray-600" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold border-2 border-gray-600">
                                                    {okr.ownerId?.firstName?.[0] || 'U'}
                                                </div>
                                            )}
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

export default OkrAlignmentDashboard;
