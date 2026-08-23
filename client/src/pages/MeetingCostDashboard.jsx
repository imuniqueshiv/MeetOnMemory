import React, { useState, useEffect } from 'react';
import MeetingCostService from '../services/meetingCostService';
import ResourceUtilizationChart from '../components/cost/ResourceUtilizationChart';
import {
    DollarSign, PieChart, LineChart, Cpu, Lightbulb,
    ArrowUpRight, ArrowDownRight, Layers, CreditCard
} from 'lucide-react';

const MeetingCostDashboard = () => {
    const [aggregations, setAggregations] = useState(null);
    const [topography, setTopography] = useState([]);
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [agg, topo, ai] = await Promise.all([
                    MeetingCostService.getAggregations(),
                    MeetingCostService.getTopography(),
                    MeetingCostService.getInsights()
                ]);
                setAggregations(agg);
                setTopography(topo);
                setInsights(ai);
            } catch (e) {
                console.error("Dashboard error:", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

    const BurnBlock = ({ title, value, icon, meta, accent }) => (
        <div className="relative group overflow-hidden bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-3xl p-6 hover:bg-white/5 transition-colors">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${accent}-500/20 rounded-full blur-3xl`} />
            <div className="flex justify-between items-start mb-6 z-10 relative">
                <span className="text-gray-400 text-sm font-bold tracking-widest">{title}</span>
                <div className={`p-3 rounded-2xl bg-${accent}-500/20 text-${accent}-400 shadow-inner`}>
                    {icon}
                </div>
            </div>
            <div className="z-10 relative">
                <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight">{value}</h2>
                <div className="mt-2 text-sm font-medium text-gray-500">{meta}</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-gray-100 p-8 pt-10 pb-32 font-sans selection:bg-rose-500/30">
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end pb-8 border-b border-white/10">
                <div className="max-w-3xl">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-rose-500 to-orange-500 rounded-2xl shadow-lg shadow-rose-500/20">
                            <DollarSign className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                            Cost & Resource Engine
                        </h1>
                    </div>
                    <p className="text-gray-400 leading-relaxed font-medium">
                        Monitor organizational burn rate incurred through meetings. Our ML pipeline extracts value metrics to propose aggressive restructuring frameworks.
                    </p>
                </div>
                <div className="mt-8 md:mt-0 flex gap-3">
                    <button className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition">Settings</button>
                    <button className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-orange-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">Export Ledgers</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <BurnBlock
                    title="YTD Total Spend"
                    value={loading ? '-' : formatCurrency(aggregations?.yearToDateExpenditure)}
                    icon={<CreditCard className="w-6 h-6" />}
                    accent="rose"
                    meta={<span className="text-rose-400 flex items-center"><ArrowUpRight className="w-4 h-4 mr-1" /> 12.4% vs last year</span>}
                />
                <BurnBlock
                    title="Monthly Burn Rate"
                    value={loading ? '-' : formatCurrency(aggregations?.monthlyBurnRate)}
                    icon={<LineChart className="w-6 h-6" />}
                    accent="orange"
                    meta="Trailing 30-day accumulation"
                />
                <BurnBlock
                    title="Avg Meeting Cost"
                    value={loading ? '-' : formatCurrency(aggregations?.averageMeetingCost)}
                    icon={<PieChart className="w-6 h-6" />}
                    accent="blue"
                    meta="Calculated by headcount & rate"
                />
                <BurnBlock
                    title="Engine ROI Shift"
                    value={loading ? '-' : `${aggregations?.roiPercentage}%`}
                    icon={<Cpu className="w-6 h-6" />}
                    accent="emerald"
                    meta={<span className="text-emerald-400 flex items-center"><ArrowDownRight className="w-4 h-4 mr-1" /> Sustained value surplus</span>}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Advanced Charting Component */}
                <div className="lg:col-span-2 flex flex-col">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl h-full flex flex-col backdrop-blur-md">
                        <div className="mb-6 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-white flex items-center"><Layers className="w-6 h-6 text-rose-500 mr-2" /> Valuation Telemetry</h2>
                        </div>
                        <div className="flex-grow">
                            <ResourceUtilizationChart data={aggregations?.trendData} isLoading={loading} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col space-y-8">
                    {/* Topographical Split */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                        <h2 className="text-xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-500">Departmental Distribution</h2>
                        {loading ? (
                            <div className="animate-pulse space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-6 bg-white/5 rounded"></div>)}</div>
                        ) : (
                            <div className="space-y-4">
                                {topography.map((dept, idx) => (
                                    <div key={idx} className="flex flex-col">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-semibold text-gray-300">{dept.label}</span>
                                            <span className="text-sm font-bold text-white">{formatCurrency(dept.spend)}</span>
                                        </div>
                                        <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/5">
                                            <div className={`h-full rounded-full bg-${dept.color}-500 shadow-[0_0_8px_rgba(255,255,255,0.4)]`} style={{ width: `${dept.percentage}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Generative Insights Array */}
                    <div className="bg-gradient-to-b from-indigo-900/40 to-transparent border border-indigo-500/30 p-6 rounded-3xl">
                        <h2 className="text-xl font-bold text-indigo-100 mb-4 flex items-center"><Lightbulb className="w-5 h-5 mr-2 text-indigo-400" /> AI Cost Mitigation</h2>
                        <div className="space-y-3 mt-4 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                            {!loading && insights.map((insight) => (
                                <div key={insight.id} className="bg-black/60 p-4 rounded-2xl border border-white/5 hover:border-indigo-500/50 transition-colors">
                                    <div className="flex justify-between font-bold text-xs uppercase mb-2">
                                        <span className="text-indigo-400">{insight.type} Optimization</span>
                                        <span className="text-emerald-400">+${insight.potentialSavings} saved</span>
                                    </div>
                                    <p className="text-sm text-gray-300 leading-snug">{insight.msg}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MeetingCostDashboard;
