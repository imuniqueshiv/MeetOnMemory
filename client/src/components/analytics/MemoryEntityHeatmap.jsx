import React from 'react';
import PropTypes from 'prop-types';

/**
 * MemoryEntityHeatmap
 * Utilizes a responsive flex-wrap packing system to display Named Entity Recognition (NER)
 * weights with high-contrast, premium aesthetic styling.
 */
const MemoryEntityHeatmap = ({ data, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-full min-h-[300px] bg-white/5 backdrop-blur-lg rounded-2xl animate-pulse p-6 border border-white/10 shadow-lg">
                <div className="h-6 w-1/4 bg-white/10 rounded mb-6"></div>
                <div className="flex flex-wrap gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-10 w-24 bg-white/5 rounded-full"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full min-h-[300px] bg-gray-900/40 rounded-2xl p-6 border border-white/5 flex items-center justify-center">
                <span className="text-gray-500 font-medium">No entities detected yet.</span>
            </div>
        );
    }

    // Pre-calculate color mappings based on business category and trend
    const getCategoryColor = (category, weight) => {
        // Opacity based on weight (heavier = more opaque)
        const baseOpacity = Math.max(0.1, weight / 100);
        switch (category) {
            case 'Engineering': return `rgba(59, 130, 246, ${baseOpacity + 0.1})`; // Blue
            case 'Business': return `rgba(16, 185, 129, ${baseOpacity + 0.1})`; // Emerald
            case 'Operations': return `rgba(245, 158, 11, ${baseOpacity + 0.1})`; // Amber
            case 'Legal': return `rgba(239, 68, 68, ${baseOpacity + 0.1})`; // Red
            case 'Marketing': return `rgba(168, 85, 247, ${baseOpacity + 0.1})`; // Purple
            default: return `rgba(255, 255, 255, ${baseOpacity + 0.1})`;
        }
    };

    const getTrendIcon = (trend) => {
        if (trend === 'up') return <span className="text-emerald-400 text-xs font-bold leading-none ml-1">↗</span>;
        if (trend === 'down') return <span className="text-red-400 text-xs font-bold leading-none ml-1">↘</span>;
        return <span className="text-gray-400 text-xs font-bold leading-none ml-1">→</span>;
    };

    return (
        <div className="w-full relative overflow-hidden bg-gradient-to-tr from-gray-900/80 to-slate-900/90 rounded-2xl p-6 border border-white/10 shadow-2xl backdrop-blur-md">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-end mb-6 border-b border-white/10 pb-4">
                <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Entity Extraction Heatmap</h3>
                    <p className="text-sm text-gray-400 mt-1">AI-driven Named Entity Recognition (NER) clustering.</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
                {data.sort((a, b) => b.weight - a.weight).map((entity, idx) => (
                    <div
                        key={idx}
                        className="group relative px-4 py-2 rounded-full cursor-pointer transition-all duration-300 hover:scale-105 border border-white/5 hover:border-white/20 overflow-hidden"
                        style={{ backgroundColor: getCategoryColor(entity.category, entity.weight) }}
                    >
                        {/* Background Hover Shine */}
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200"></div>

                        <div className="relative z-10 flex items-center justify-between pointer-events-none">
                            <span className="text-white font-medium text-sm drop-shadow-md mr-2 tracking-wide">
                                {entity.name}
                            </span>
                            <span className="bg-black/40 text-xs text-white px-2 py-0.5 rounded-full font-bold">
                                {entity.weight}% {getTrendIcon(entity.trend)}
                            </span>
                        </div>

                        {/* Extended Tooltip on Hover */}
                        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 w-max max-w-[200px] z-50">
                            <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-3 py-2 rounded-lg shadow-2xl flex flex-col text-xs space-y-1">
                                <span className="text-gray-300 font-bold block mb-1">Category: <span className="text-white font-normal">{entity.category}</span></span>
                                <span className="text-gray-300">Mentions: <span className="text-white font-bold">{entity.recentOccurrences} (30 days)</span></span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

MemoryEntityHeatmap.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool
};

export default MemoryEntityHeatmap;
