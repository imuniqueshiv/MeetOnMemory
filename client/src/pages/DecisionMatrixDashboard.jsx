import React, { useState, useEffect } from 'react';
import DecisionMatrixService from '../services/decisionMatrixService';
import DependencyGraph from '../components/decisions/DependencyGraph';
import {
    Network, ShieldAlert, Zap, TrendingUp, Filter, Share2, CircleDot, ChevronUp, Clock
} from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * DecisionMatrixDashboard
 * Enterprise mapping of interconnected executive meeting decisions and their cross-system latency constraints.
 */
const DecisionMatrixDashboard = () => {
    const [topology, setTopology] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [risks, setRisks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [topoData, metricData, riskData] = await Promise.all([
                    DecisionMatrixService.getTopology(),
                    DecisionMatrixService.getMetrics(),
                    DecisionMatrixService.getRisks()
                ]);
                setTopology(topoData);
                setMetrics(metricData);
                setRisks(riskData);
            } catch (err) {
                toast.error("Telemetry failed to retrieve decision architecture.");
                console.error("Dashboard Integration Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const MiniCard = ({ label, value, icon, accent = "blue" }) => (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors flex items-center justify-between group">
            <div>
                <p className="text-gray-400 font-semibold text-xs tracking-wider uppercase mb-1">{label}</p>
                <span className="text-3xl font-black text-white">{value}</span>
            </div>
            <div className={`text-${accent}-400 bg-${accent}-500/10 p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black/95 text-gray-100 p-8 pt-10 font-sans pb-32">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end pb-6 border-b border-white/10">
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.15)]">
                            <Network className="w-8 h-8 text-pink-400" />
                        </div>
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-pink-100 via-pink-400 to-indigo-500">
                            Decision Dependency Matrix
                        </h1>
                    </div>
                    <p className="text-sm text-gray-400 max-w-2xl leading-relaxed mt-3 font-medium">
                        Discover latent execution blockers across organizational boundaries via AI graph extraction of meeting logs.
                    </p>
                </div>
                <div className="mt-6 md:mt-0 flex space-x-3">
                    <button className="flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all font-semibold">
                        <Filter className="w-4 h-4" /> <span>Filters</span>
                    </button>
                    <button className="flex items-center space-x-2 bg-pink-600 hover:bg-pink-500 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-pink-600/20 transition-all cursor-pointer">
                        <Share2 className="w-4 h-4 text-pink-200" /> <span>Publish Report</span>
                    </button>
                </div>
            </header>

            {/* Analytics KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <MiniCard
                    label="Decisions Executed (Q3)"
                    value={loading ? '-' : metrics?.decisionsMadeThisQuarter}
                    icon={<TrendingUp className="w-6 h-6" />} accent="emerald"
                />
                <MiniCard
                    label="Avg Time to Resolve"
                    value={loading ? '-' : `${metrics?.averageTimeToExecuteDays}d`}
                    icon={<Clock className="w-6 h-6" />} accent="blue"
                />
                <MiniCard
                    label="Currently Blocked"
                    value={loading ? '-' : metrics?.blockedDecisions}
                    icon={<CircleDot className="w-6 h-6" />} accent="red"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Canvas Component */}
                <div className="lg:col-span-3 flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center text-white"><Zap className="w-5 h-5 text-indigo-400 mr-2" /> Interactive Graph Topology</h2>
                    </div>
                    <DependencyGraph data={topology} isLoading={loading} />
                </div>

                {/* Systemic Risk Mitigations Column */}
                <div className="flex flex-col space-y-4">
                    <h2 className="text-xl font-bold flex items-center text-white mb-2"><ShieldAlert className="w-5 h-5 text-red-400 mr-2" /> Critical Blockers</h2>
                    <div className="flex flex-col space-y-4 bg-white/5 border border-white/10 p-5 rounded-3xl h-[400px] overflow-y-auto">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => <div key={i} className="w-full h-24 bg-white/5 rounded-xl animate-pulse"></div>)
                        ) : risks.map(risk => (
                            <div key={risk.id} className="bg-black/60 border border-white/5 rounded-2xl p-4 flex flex-col hover:border-white/10 transition-colors shadow-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-${risk.severity === 'critical' ? 'red' : 'amber'}-500/20 text-${risk.severity === 'critical' ? 'red' : 'amber'}-400`}>
                                        {risk.severity} Priority
                                    </span>
                                    <ChevronUp className={`w-4 h-4 text-${risk.severity === 'critical' ? 'red' : 'amber'}-400`} />
                                </div>
                                <p className="text-sm text-gray-200 mt-1 leading-snug">{risk.alert}</p>
                            </div>
                        ))}
                        {!loading && risks.length === 0 && (
                            <div className="text-gray-500 font-medium text-sm text-center mt-10">No critical blockers identified.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DecisionMatrixDashboard;
