import React, { useState, useEffect } from 'react';
import OkrService from '../services/okrService';
import GoalTreeMap from '../components/okr/GoalTreeMap';
import { Target, Activity, Trello, Crosshair, Users, Map, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * OkrDashboard
 * The centralized command center for enterprise OKR cascading goals.
 */
const OkrDashboard = () => {
    const [hierarchyData, setHierarchyData] = useState([]);
    const [healthMetrics, setHealthMetrics] = useState(null);
    const [topology, setTopology] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [hierarchy, health, topo] = await Promise.all([
                OkrService.getHierarchy(),
                OkrService.getHealth(),
                OkrService.getTopology()
            ]);
            setHierarchyData(hierarchy);
            setHealthMetrics(health);
            setTopology(topo);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load OKR topology matrices.');
        } finally {
            setLoading(false);
        }
    };

    const HealthCard = ({ title, value, icon, color, subValue }) => (
        <div className="relative overflow-hidden bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col hover:-translate-y-1 hover:bg-white/10 transition-all cursor-pointer">
            <div className={`absolute top-0 right-0 w-24 h-24 ${color} rounded-full blur-3xl opacity-20`}></div>
            <div className="flex justify-between items-start mb-4 z-10 relative">
                <span className="text-gray-400 font-medium text-sm tracking-widest uppercase">{title}</span>
                <div className={`p-2 rounded-lg bg-white/5 ${color.replace('bg-', 'text-')}`}>
                    {icon}
                </div>
            </div>
            <div className="z-10 relative flex items-end justify-between">
                <h2 className="text-4xl font-black text-white">{value}</h2>
                {subValue && <span className="text-sm text-gray-400 font-medium pb-1">{subValue}</span>}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8 pt-10 font-sans pb-32">

            <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 pb-6 border-b border-white/10">
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                            <Crosshair className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white">Objective Alignment</h1>
                    </div>
                    <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
                        Monitor organizational OKR cascading matrices derived natively from meeting actions, architectural shifts, and direct telemetry.
                    </p>
                </div>

                <div className="mt-6 md:mt-0 flex items-center space-x-4">
                    <button
                        onClick={fetchDashboardData}
                        className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : 'text-gray-300'}`} />
                        <span>Sync</span>
                    </button>
                    <button className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all">
                        <Download className="w-4 h-4 text-indigo-200" />
                        <span>Export View</span>
                    </button>
                </div>
            </header>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <HealthCard
                    title="Overall Health"
                    value={loading ? '..' : `${healthMetrics?.overallHealth}%`}
                    color="bg-emerald-500"
                    icon={<Activity className="w-5 h-5" />}
                    subValue={loading ? '' : `Velocity: ${healthMetrics?.trendVelocity}`}
                />
                <HealthCard
                    title="On-Track Nodes"
                    value={loading ? '..' : healthMetrics?.onTrackNodes}
                    color="bg-blue-500"
                    icon={<Target className="w-5 h-5" />}
                />
                <HealthCard
                    title="At-Risk Nodes"
                    value={loading ? '..' : healthMetrics?.atRiskNodes}
                    color="bg-red-500"
                    icon={<AlertTriangle className="w-5 h-5" />}
                />
                <HealthCard
                    title="Active Domains"
                    value={loading ? '..' : topology.length || 0}
                    color="bg-amber-500"
                    icon={<Map className="w-5 h-5" />}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center"><Trello className="w-5 h-5 mr-2 text-indigo-400" /> Goal Hierarchy</h2>
                    </div>
                    <GoalTreeMap data={hierarchyData} isLoading={loading} />
                </div>

                <div className="w-full flex flex-col space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center"><Users className="w-5 h-5 mr-2 text-indigo-400" /> Topology Distribution</h2>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex-grow flex flex-col">
                        {loading ? (
                            <div className="w-full h-full min-h-[300px] animate-pulse bg-white/5 rounded-2xl"></div>
                        ) : (
                            <div className="flex flex-col space-y-4 justify-center flex-grow">
                                {topology.map((t, idx) => (
                                    <div key={idx} className="w-full">
                                        <div className="flex justify-between items-center mb-1 text-sm font-medium">
                                            <span className="text-gray-300">{t.name}</span>
                                            <span className="text-white font-bold">{t.value}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${t.value}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-white/10">
                            <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-gray-300 transition-colors">
                                View Deep Distribution
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default OkrDashboard;
