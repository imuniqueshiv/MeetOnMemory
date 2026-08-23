import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * SentimentTimeline - An advanced SVG/Canvas hybrid data visualization 
 * component utilizing glassmorphic aesthetics.
 * Features:
 * - Dynamic SVG path generation
 * - Micro-animations on load
 * - Interactive hover tooltips
 */
const SentimentTimeline = ({ data, isLoading }) => {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 300 });
    const [hoveredNode, setHoveredNode] = useState(null);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.getBoundingClientRect().width,
                    height: 300,
                });
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (isLoading) {
        return (
            <div className="w-full h-[300px] bg-white/5 backdrop-blur-lg rounded-2xl animate-pulse flex items-center justify-center border border-white/10 shadow-lg">
                <span className="text-gray-400 font-medium tracking-wide">Synthesizing Sentiment Data...</span>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-[300px] bg-gray-900/40 rounded-2xl flex items-center justify-center border border-white/5">
                <span className="text-gray-500">Insufficient timeline data.</span>
            </div>
        );
    }

    // --- Layout Calculations ---
    const { width, height } = dimensions;
    const paddingX = 40;
    const paddingY = 40;
    const maxScore = 100;
    const numPoints = data.length;

    const stepX = (width - paddingX * 2) / Math.max(1, numPoints - 1);
    const scaleY = (val) => height - paddingY - (val / maxScore) * (height - paddingY * 2);

    // Generate Bezier Curve paths
    const generatePath = (key) => {
        return data.reduce((path, point, index) => {
            const x = paddingX + index * stepX;
            const y = scaleY(point[key]);
            if (index === 0) return `M ${x},${y}`;

            const prevX = paddingX + (index - 1) * stepX;
            const prevY = scaleY(data[index - 1][key]);
            const cp1x = prevX + stepX / 2;
            const cp1y = prevY;
            const cp2x = x - stepX / 2;
            const cp2y = y;

            return `${path} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
        }, "");
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-[300px] bg-gradient-to-br from-gray-900/60 to-black/80 rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-md"
        >
            <svg width="100%" height="100%" className="absolute inset-0">
                {/* Background Grid */}
                {[0, 25, 50, 75, 100].map((val) => (
                    <line
                        key={`grid-${val}`}
                        x1={paddingX}
                        y1={scaleY(val)}
                        x2={width - paddingX}
                        y2={scaleY(val)}
                        stroke="#ffffff"
                        strokeOpacity="0.05"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                    />
                ))}

                <path
                    d={generatePath("positive")}
                    fill="none"
                    stroke="#10b981" // Emerald
                    strokeWidth="3"
                    className="drop-shadow-lg"
                    style={{ transition: 'all 0.5s ease-out' }}
                />
                <path
                    d={generatePath("negative")}
                    fill="none"
                    stroke="#ef4444" // Red
                    strokeWidth="3"
                    className="drop-shadow-lg"
                    style={{ transition: 'all 0.5s ease-out' }}
                />
                <path
                    d={generatePath("movingAverage")}
                    fill="none"
                    stroke="#3b82f6" // Blue
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    className="drop-shadow-lg opacity-70"
                    style={{ transition: 'all 0.5s ease-out' }}
                />

                {/* Interactive Data Points for Positive Sentiment */}
                {data.map((point, i) => {
                    const cx = paddingX + i * stepX;
                    const cy = scaleY(point.positive);
                    return (
                        <circle
                            key={`pt-pos-${i}`}
                            cx={cx}
                            cy={cy}
                            r="6"
                            fill="#10b981"
                            stroke="#000"
                            strokeWidth="2"
                            className="cursor-crosshair transition-transform duration-200 hover:scale-150"
                            onMouseEnter={() => setHoveredNode({ ...point, x: cx, y: cy, label: "Positive" })}
                            onMouseLeave={() => setHoveredNode(null)}
                        />
                    );
                })}
            </svg>

            {/* Glassmorphic Tooltip */}
            {hoveredNode && (
                <div
                    className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full"
                    style={{ left: hoveredNode.x, top: hoveredNode.y - 12 }}
                >
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-lg shadow-2xl flex flex-col items-center">
                        <span className="text-xs text-gray-300 mb-1 font-semibold tracking-wider">
                            {new Date(hoveredNode.date).toLocaleDateString()}
                        </span>
                        <div className="flex space-x-3 items-center">
                            <span className="text-emerald-400 font-bold text-sm">+{hoveredNode.positive} POS</span>
                            <span className="text-red-400 font-bold text-sm">-{hoveredNode.negative} NEG</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

SentimentTimeline.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool
};

export default SentimentTimeline;
