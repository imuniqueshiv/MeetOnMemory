import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * ResourceUtilizationChart
 * Heavy mathematical geometry abstraction drawing overlapping area curves.
 * Demonstrates meeting Cost vectors versus Value Realization.
 */
const ResourceUtilizationChart = ({ data, isLoading }) => {
    const canvasRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 350 });

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                setDimensions({
                    width: canvasRef.current.parentElement.getBoundingClientRect().width,
                    height: 350,
                });
            }
        };
        handleResize();
        const ro = new ResizeObserver(() => handleResize());
        if (canvasRef.current) ro.observe(canvasRef.current.parentElement);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (isLoading || !data || data.length === 0 || dimensions.width === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { width, height } = dimensions;
        const padding = 40;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        // Calculate maximums for scaling algorithm
        const maxCost = Math.max(...data.map(d => d.cost));
        const maxVal = Math.max(...data.map(d => d.valueGenerated));
        const absoluteMax = Math.max(maxCost, maxVal) * 1.1;

        const stepX = (width - padding * 2) / Math.max(1, data.length - 1);
        const getX = (index) => padding + index * stepX;
        const getY = (val) => height - padding - (val / absoluteMax) * (height - padding * 2);

        // Grid lines 
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = padding + i * ((height - padding * 2) / 4);
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        const drawCurve = (key, hexColor, fillLinearColors) => {
            ctx.beginPath();
            ctx.moveTo(getX(0), height - padding);
            ctx.lineTo(getX(0), getY(data[0][key]));

            for (let i = 1; i < data.length; i++) {
                const cp1x = getX(i - 1) + stepX / 2;
                const cp1y = getY(data[i - 1][key]);
                const cp2x = getX(i) - stepX / 2;
                const cp2y = getY(data[i][key]);
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, getX(i), getY(data[i][key]));
            }

            ctx.lineTo(getX(data.length - 1), height - padding);
            ctx.closePath();

            const grd = ctx.createLinearGradient(0, padding, 0, height - padding);
            grd.addColorStop(0, fillLinearColors[0]);
            grd.addColorStop(1, fillLinearColors[1]);

            ctx.fillStyle = grd;
            ctx.fill();

            // Stroke
            ctx.beginPath();
            ctx.moveTo(getX(0), getY(data[0][key]));
            for (let i = 1; i < data.length; i++) {
                const cp1x = getX(i - 1) + stepX / 2;
                const cp1y = getY(data[i - 1][key]);
                const cp2x = getX(i) - stepX / 2;
                const cp2y = getY(data[i][key]);
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, getX(i), getY(data[i][key]));
            }
            ctx.strokeStyle = hexColor;
            ctx.lineWidth = 3;
            ctx.shadowColor = hexColor;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0; // reset
        };

        drawCurve('cost', '#ef4444', ['rgba(239, 68, 68, 0.4)', 'rgba(239, 68, 68, 0.0)']);
        drawCurve('valueGenerated', '#10b981', ['rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.0)']);

    }, [data, dimensions, isLoading]);

    if (isLoading) {
        return (
            <div className="w-full h-[350px] bg-white/5 backdrop-blur-lg rounded-2xl animate-pulse flex items-center justify-center border border-white/10"></div>
        );
    }

    return (
        <div className="w-full h-[350px] bg-black/40 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} className="block" />
            <div className="absolute top-4 left-4 z-10 flex space-x-4 bg-white/5 p-2 px-3 rounded-lg backdrop-blur-md border border-white/5">
                <span className="flex items-center text-xs font-bold text-gray-300"><div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div> Burn Rate</span>
                <span className="flex items-center text-xs font-bold text-gray-300"><div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div> Extracted Value</span>
            </div>
        </div>
    );
};

ResourceUtilizationChart.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool
};

export default ResourceUtilizationChart;
