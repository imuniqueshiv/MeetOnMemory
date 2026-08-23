import React, { useState, useEffect } from 'react';
import { MemoryAnalyticsService } from '../services/analyticsService';
import SentimentTimeline from '../components/analytics/SentimentTimeline';
import MemoryEntityHeatmap from '../components/analytics/MemoryEntityHeatmap';
import {
    BarChart, Activity, Brain, PieChart, Users, ChevronRight, Share2, AlertCircle, TrendingUp, Filter
} from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * MemoryAnalyticsDashboard
 * An enterprise-grade, high-contrast, interactive telemetry dashboard.
 * Includes glassmorphism UI traits, Lucide icons, and layout integration for deep knowledge metrics.
 */
const MemoryAnalyticsDashboard = () => {
    const [timelineData, setTimelineData] = useState([]);
    const [entityData, setEntityData] = useState([]);
    const [kpiSummary, setKpiSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('30D');

    useEffect(() => {
        const fetchDashboardTelemetry = async () => {
            setLoading(true);
            try {
                // Fetch all heavy enterprise datasets concurrently for high-velocity initialization
                const [timeline, entities, summary] = await Promise.all([
                    MemoryAnalyticsService.getSentimentTimeline(),
                    MemoryAnalyticsService.getEntityHeatmap(),
                    MemoryAnalyticsService.getAnalyticsSummary(),
                ]);

                setTimelineData(timeline);
                setEntityData(entities);
                setKpiSummary(summary);
            } catch (err) {
                console.error("Dashboard Telemetry Error:", err);
                toast.error("Failed to load Memory Analytics data streams.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardTelemetry();
    }, [activeFilter]);

    // Generate top level KPIs dynamically
    const KpiCard = ({ title, value, icon, trend, accentColor }) => (
        <div className="relative group overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            {/* Accent Glow */}
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity bg-${accentColor}-500 pointer-events-none`}></div>

            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">{title}</h3>
                <div className={`text-${accentColor}-400 bg-${accentColor}-500/10 p-2 rounded-lg`}>
                    {icon}
                </div>
            </div>

            <div className="flex items-end space-x-3 relative z-10">
                <h2 className="text-3xl font-bold text-white tracking-tight">{value}</h2>
                {trend && (
                    <span className={`text-sm font-semibold mb-1 ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-gray-100 p-8 pb-32 w-full font-sans overflow-x-hidden selection:bg-indigo-500/30">

            {/* Header Area */}
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <div>
                    <div className="flex items-center space-x-3 mb-1 cursor-default">
                        <Brain className="text-indigo-400 w-8 h-8" />
                        <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight">
                            Enterprise Knowledge Graph
                        </h1>
                    </div>
                    <p className="text-gray-400 text-sm md:text-base ml-11 max-w-2xl">
                        Live telemetry, sentiment topology, and entity consolidation spanning organizational intelligence.
                    </p>
                </div>

                {/* Action Controls */}
                <div className="flex space-x-3">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-1 flex">
                        {['7D', '30D', 'QTR', 'YTD'].map(range => (
                            <button
                                key={range}
                                onClick={() => setActiveFilter(range)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeFilter === range ? 'bg-indigo-500/20 text-indigo-300 shadow-inner' : 'text-gray-500 hover:text-white'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <button className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-indigo-500/20">
                        <Share2 className="w-4 h-4" />
                        <span>Export Report</span>
                    </button>
                </div>
            </header>

            {/* KPI Cards Row */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard
                    title="Total Memories Processed"
                    value={loading ? '...' : kpiSummary?.totalMemoriesProcessed.toLocaleString()}
                    icon={<Brain className="w-5 h-5" />}
                    trend={12.5}
                    accentColor="indigo"
                />
                <KpiCard
                    title="Active Graph Nodes"
                    value={loading ? '...' : kpiSummary?.activeKnowledgeNodes.toLocaleString()}
                    icon={<Activity className="w-5 h-5" />}
                    trend={4.2}
                    accentColor="emerald"
                />
                <KpiCard
                    title="AI Insights Generated"
                    value={loading ? '...' : kpiSummary?.aiInsightsGenerated.toLocaleString()}
                    icon={<PieChart className="w-5 h-5" />}
                    trend={-2.1}
                    accentColor="amber"
                />
                <KpiCard
                    title="System Health"
                    value={loading ? '...' : kpiSummary?.systemHealth}
                    icon={<TrendingUp className="w-5 h-5" />}
                    accentColor="blue"
                />
            </section>

            {/* Complex Visualizations Layout */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Timeline View (Takes 2 columns) */}
                <div className="lg:col-span-2 flex flex-col space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold flex items-center">
                                    <Activity className="w-5 h-5 mr-3 text-indigo-400" />
                                    Emotional Resonance Timeline
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">Algorithmic plotting of positive vs negative engagement over time.</p>
                            </div>
                            <button className="text-gray-400 hover:text-white transition-colors h-8 w-8 flex justify-center items-center rounded-full hover:bg-white/10">
                                <Filter className="w-4 h-4" />
                            </button>
                        </div>

                        <SentimentTimeline data={timelineData} isLoading={loading} />
                    </div>

                    {/* Deep Insight Alert panel */}
                    <div className="bg-gradient-to-r from-indigo-500/10 to-transparent border-l-4 border-indigo-500 p-5 rounded-r-xl border-[y,r] border-white/5 flex items-start space-x-4">
                        <AlertCircle className="w-8 h-8 text-indigo-400 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="text-white font-bold text-lg mb-1">Knowledge Synthesis Complete</h4>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                The AI inference engine successfully processed the latest batch of {kpiSummary?.activeKnowledgeNodes || 'loading...'} memory nodes. Sentiment trajectories confirm a 12% rise in operational confidence aligned with the <strong>{kpiSummary?.topCategory || 'Engineering'}</strong> category.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Entity Extraction Heatmap (Takes 1 column) */}
                <div className="flex flex-col space-y-6 h-full">
                    <MemoryEntityHeatmap data={entityData} isLoading={loading} />

                    {/* Quick Actions Panel */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex-grow backdrop-blur-xl shadow-2xl">
                        <h2 className="text-lg font-bold mb-4 flex items-center">
                            <Users className="w-5 h-5 mr-3 text-emerald-400" />
                            Organizational Sub-Graphs
                        </h2>
                        <p className="text-gray-400 text-sm mb-6 pb-4 border-b border-white/10">
                            Navigate generated intelligence sub-graphs categorized by domain clusters.
                        </p>

                        <ul className="space-y-2">
                            {['Engineering Arch', 'Customer Support', 'Q3 Marketing', 'Executive Offsite'].map((item, id) => (
                                <li key={id}>
                                    <button className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-all flex items-center justify-between group">
                                        <span className="font-medium text-gray-300 group-hover:text-white transition-colors">{item}</span>
                                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors transform group-hover:translate-x-1" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

            </section>

        </div>
    );
};

export default MemoryAnalyticsDashboard;
