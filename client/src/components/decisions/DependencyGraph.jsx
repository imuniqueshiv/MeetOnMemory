import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * DependencyGraph: Interactive organizational knowledge network map using standard HTML5 Canvas 
 * integrated with React hooks for high performance rendering.
 */
const DependencyGraph = ({ data, isLoading }) => {
    const canvasRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 400 });
    const [hoveredNode, setHoveredNode] = useState(null);

    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.contentBoxSize) {
                    setDimensions({ width: entry.contentRect.width, height: 400 });
                }
            }
        });

        if (canvasRef.current && canvasRef.current.parentElement) {
            resizeObserver.observe(canvasRef.current.parentElement);
        }
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (isLoading || !data?.nodes) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width, height } = dimensions;

        // Scale for HDPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Auto-layout mock strategy (Circular Layout)
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;

        const positionedNodes = data.nodes.map((node, i) => {
            const angle = (i / data.nodes.length) * Math.PI * 2;
            return {
                ...node,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            };
        });

        // Clear Canvas
        ctx.clearRect(0, 0, width, height);

        // Draw Edges
        if (data.edges) {
            data.edges.forEach(edge => {
                const sourceNode = positionedNodes.find(n => n.id === edge.source);
                const targetNode = positionedNodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return;

                ctx.beginPath();
                ctx.moveTo(sourceNode.x, sourceNode.y);
                ctx.lineTo(targetNode.x, targetNode.y);
                ctx.strokeStyle = edge.type === 'blocking' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)';
                ctx.lineWidth = 2 + (edge.strength * 3);
                ctx.stroke();

                // Draw directional arrow loosely
                const midX = (sourceNode.x + targetNode.x) / 2;
                const midY = (sourceNode.y + targetNode.y) / 2;
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fillText(edge.type === 'blocking' ? '🔒' : '⟷', midX, midY);
            });
        }

        // Draw Nodes
        positionedNodes.forEach(node => {
            // Glow effect
            ctx.shadowColor = node.status === 'implemented' ? 'rgba(16,185,129,0.8)' :
                node.status === 'in-progress' ? 'rgba(245,158,11,0.8)' : 'rgba(99,102,241,0.8)';
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.arc(node.x, node.y, 25, 0, 2 * Math.PI);
            ctx.fillStyle = '#1e1e1e';
            ctx.fill();

            ctx.strokeStyle = ctx.shadowColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Node Text
            ctx.shadowBlur = 0; // reset
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';

            // Wrap text loosely
            const words = node.label.split(' ');
            ctx.fillText(words.slice(0, 2).join(' '), node.x, node.y - 35);
        });

    }, [data, dimensions, isLoading]);

    if (isLoading) {
        return (
            <div className="w-full h-[400px] bg-white/5 backdrop-blur-lg rounded-2xl animate-pulse flex items-center justify-center border border-white/10 shadow-lg">
                <span className="text-gray-400 font-medium tracking-wide">Compiling Dependency Arrays...</span>
            </div>
        );
    }

    return (
        <div className="w-full h-[400px] bg-[#0a0a0c] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-black to-black rounded-3xl border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden relative group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', display: 'block' }}
                className="cursor-crosshair relative z-10"
            />
            <div className="absolute top-4 left-4 z-20 flex space-x-3 bg-black/40 p-2 rounded-lg backdrop-blur-md">
                <div className="flex items-center text-xs text-gray-300 font-medium"><div className="w-3 h-3 bg-red-500 rounded-full mr-1.5 shadow-[0_0_8px_rgb(239,68,68,0.8)]"></div> Blocking Edge</div>
                <div className="flex items-center text-xs text-gray-300 font-medium"><div className="w-3 h-3 bg-emerald-500 rounded-full mr-1.5 shadow-[0_0_8px_rgb(16,185,129,0.8)]"></div> Enabling Edge</div>
            </div>
        </div>
    );
};

DependencyGraph.propTypes = {
    data: PropTypes.object,
    isLoading: PropTypes.bool
};

export default DependencyGraph;
