import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * GoalTreeMap: High-contrast Canvas/DOM tree visualization for OKR data.
 * Utilizes pseudo-elements and flexbox structural styling to implement an organizational tree map layout.
 */
const GoalTreeMap = ({ data, isLoading }) => {
    const [expandedNodes, setExpandedNodes] = useState({});

    if (isLoading) {
        return (
            <div className="w-full min-h-[400px] bg-white/5 backdrop-blur-lg rounded-2xl animate-pulse p-6 border border-white/10 shadow-lg flex items-center justify-center">
                <span className="text-gray-400 font-medium tracking-wide">Mapping Hierarchical Matrix...</span>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full min-h-[400px] bg-gray-900/40 rounded-2xl p-6 flex flex-col items-center justify-center border border-white/5">
                <span className="text-gray-500 font-medium text-lg">Empty Alignment Architecture</span>
                <p className="text-gray-600 text-sm mt-2">Initialize OKRs to populate this matrix map.</p>
            </div>
        );
    }

    const toggleNode = (id) => {
        setExpandedNodes(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const getProgressColor = (progress) => {
        if (progress >= 80) return "bg-emerald-500 border-emerald-400 shadow-emerald-500/30";
        if (progress >= 50) return "bg-amber-500 border-amber-400 shadow-amber-500/30";
        return "bg-red-500 border-red-400 shadow-red-500/30";
    };

    const renderProgressCircle = (progress) => {
        const strokeDasharray = `${progress}, 100`;
        let strokeColor = "#ef4444";
        if (progress >= 50) strokeColor = "#f59e0b";
        if (progress >= 80) strokeColor = "#10b981";

        return (
            <svg className="w-10 h-10 transform -rotate-90">
                <circle cx="20" cy="20" r="16" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <circle
                    cx="20" cy="20" r="16" fill="transparent"
                    stroke={strokeColor} strokeWidth="4"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset="0"
                    className="transition-all duration-1000 ease-out"
                />
                <text x="20" y="20" transform="rotate(90 20 20)" dominantBaseline="central" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                    {progress}%
                </text>
            </svg>
        );
    };

    return (
        <div className="w-full bg-gradient-to-br from-slate-900 via-gray-900 to-black rounded-3xl p-8 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-x-auto relative">
            <div className="flex flex-col space-y-8 min-w-max">
                {data.map((objective, i) => (
                    <div key={objective.id} className="flex flex-col relative w-full">

                        {/* Top Level Objective Node */}
                        <div
                            onClick={() => toggleNode(objective.id)}
                            className="group relative z-10 w-96 flex items-center p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl cursor-pointer transition-all duration-300 shadow-xl border-l-4 !border-l-indigo-500 hover:scale-[1.02]"
                        >
                            <div className="mr-4">
                                {renderProgressCircle(objective.progress)}
                            </div>
                            <div className="flex-grow">
                                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block mb-1">{objective.owner}</span>
                                <h3 className="text-white font-bold leading-tight group-hover:text-indigo-200 transition-colors">{objective.title}</h3>
                            </div>
                            <div className="text-gray-500 ml-4">
                                {expandedNodes[objective.id] ? "▲" : "▼"}
                            </div>
                        </div>

                        {/* Children Key Results */}
                        <div className={`transition-all duration-500 ease-in-out ml-12 mt-4 pl-8 border-l-2 border-white/10 ${expandedNodes[objective.id] ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                            <div className="flex flex-col space-y-4">
                                {objective.children?.map(kr => (
                                    <div key={kr.id} className="relative group w-[450px] p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all flex items-center shadow-lg border-l-4 !border-l-indigo-400/50">
                                        {/* Connecting Line */}
                                        <div className="absolute -left-[34px] top-1/2 w-[32px] h-[2px] bg-white/10 pointer-events-none"></div>

                                        <div className="flex-grow pr-4">
                                            <h4 className="text-gray-200 text-sm font-medium">{kr.title}</h4>
                                            <div className="w-full h-1.5 bg-black/50 rounded-full mt-2 overflow-hidden shadow-inner">
                                                <div
                                                    className={`h-full ${getProgressColor(kr.progress)}`}
                                                    style={{ width: `${kr.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end">
                                            <span className="text-white font-bold text-lg">{kr.progress}%</span>
                                            <span className="text-gray-500 text-[10px] uppercase font-semibold mt-0.5">Confidence {kr.confidence * 100}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
};

GoalTreeMap.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool
};

export default GoalTreeMap;
