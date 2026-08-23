import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * SecurityRadarChart
 * Advanced native canvas implementation charting multidimensional security threats.
 * Dynamically computes mathematical hexagon/polygon perimeters.
 */
const SecurityRadarChart = ({ data, isLoading }) => {
    const canvasRef = useRef(null);
    const [size, setSize] = useState({ w: 400, h: 400 });

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                const p = canvasRef.current.parentElement;
                setSize({ w: p.clientWidth, h: p.clientHeight || 400 });
            }
        };
        handleResize();
        const observer = new ResizeObserver(handleResize);
        if (canvasRef.current) observer.observe(canvasRef.current.parentElement);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (isLoading || !data || data.length < 3) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { w, h } = size;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const center = { x: w / 2, y: h / 2 };
        const radius = Math.min(w, h) / 2 - 50;
        const sides = data.length;
        const angleStep = (Math.PI * 2) / sides;

        // Draw Radar Geometric Backing Lines
        const maxLevels = 5;
        for (let level = 1; level <= maxLevels; level++) {
            const r = (radius / maxLevels) * level;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const currentAngle = angleStep * i - Math.PI / 2;
                const x = center.x + r * Math.cos(currentAngle);
                const y = center.y + r * Math.sin(currentAngle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Background fill for rings
            if (level % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
                ctx.fill();
            }
        }

        // Draw Axis Spoke Lines
        for (let i = 0; i < sides; i++) {
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            const currentAngle = angleStep * i - Math.PI / 2;
            ctx.lineTo(center.x + radius * Math.cos(currentAngle), center.y + radius * Math.sin(currentAngle));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.stroke();
        }

        // Plot Data Area Polygon
        ctx.beginPath();
        const dataPoints = [];
        for (let i = 0; i < sides; i++) {
            const valueRatio = data[i].value / data[i].max;
            const currentAngle = angleStep * i - Math.PI / 2;
            const x = center.x + (radius * valueRatio) * Math.cos(currentAngle);
            const y = center.y + (radius * valueRatio) * Math.sin(currentAngle);
            dataPoints.push({ x, y, label: data[i].axis, ratio: valueRatio });

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Fill Matrix
        ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(129, 140, 248, 1)';
        ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Draw data points & Text
        dataPoints.forEach((point, i) => {
            // Point
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = point.ratio > 0.7 ? '#ef4444' : '#818cf8';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#9ca3af';
            ctx.font = 'bold 11px sans-serif';
            const angle = angleStep * i - Math.PI / 2;
            // Pushing text out slightly more than the radius
            const labelX = center.x + (radius + 25) * Math.cos(angle);
            const labelY = center.y + (radius + 25) * Math.sin(angle);

            ctx.textAlign = Math.cos(angle) > 0.1 ? 'left' : Math.cos(angle) < -0.1 ? 'right' : 'center';
            ctx.textBaseline = Math.sin(angle) > 0.1 ? 'top' : Math.sin(angle) < -0.1 ? 'bottom' : 'middle';
            ctx.fillText(point.label, labelX, labelY);
        });

    }, [data, size, isLoading]);

    if (isLoading) {
        return (
            <div className="w-full h-full min-h-[400px] rounded-3xl bg-white/5 animate-pulse flex items-center justify-center border border-white/10"></div>
        );
    }

    return (
        <div className="w-full h-full min-h-[400px] border border-indigo-500/10 rounded-3xl bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-black to-black relative shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <canvas ref={canvasRef} className="block w-full h-full" style={{ width: '100%', height: '100%' }}></canvas>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
        </div>
    );
};

SecurityRadarChart.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool
};

export default SecurityRadarChart;
