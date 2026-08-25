import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
    AlertTriangle, ShieldAlert, ShieldCheck, Clock, ChevronDown,
    ChevronUp, Filter, Zap, Eye, CheckCircle2, XCircle, AlertOctagon
} from 'lucide-react';

const SEVERITY_CONFIG = {
    critical: {
        dot: 'bg-red-500',
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.7)]',
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: <AlertOctagon className="w-4 h-4" />,
        label: 'Critical'
    },
    high: {
        dot: 'bg-orange-500',
        glow: 'shadow-[0_0_8px_rgba(249,115,22,0.6)]',
        badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        icon: <ShieldAlert className="w-4 h-4" />,
        label: 'High'
    },
    medium: {
        dot: 'bg-amber-500',
        glow: '',
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: <AlertTriangle className="w-4 h-4" />,
        label: 'Medium'
    },
    low: {
        dot: 'bg-blue-500',
        glow: '',
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        icon: <Eye className="w-4 h-4" />,
        label: 'Low'
    }
};

const STATUS_CONFIG = {
    open: { icon: <XCircle className="w-3.5 h-3.5 text-red-400" />, label: 'Open', cls: 'text-red-400' },
    investigating: { icon: <Zap className="w-3.5 h-3.5 text-amber-400" />, label: 'Investigating', cls: 'text-amber-400' },
    resolved: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, label: 'Resolved', cls: 'text-emerald-400' },
    mitigated: { icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />, label: 'Mitigated', cls: 'text-indigo-400' }
};

const IncidentCard = ({ incident, isLast }) => {
    const [expanded, setExpanded] = useState(false);
    const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.medium;
    const stat = STATUS_CONFIG[incident.status] || STATUS_CONFIG.open;

    return (
        <div className="relative flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${sev.dot} ${sev.glow}`} />
                {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-white/10 to-transparent mt-1" />}
            </div>

            {/* Card */}
            <div className="flex-1 mb-6">
                <button
                    onClick={() => setExpanded(v => !v)}
                    id={`incident-toggle-${incident.id}`}
                    className="w-full text-left bg-black/40 border border-white/5 rounded-2xl p-4 hover:border-white/15 transition-all group"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${sev.badge}`}>
                                    {sev.icon} {sev.label}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${stat.cls}`}>
                                    {stat.icon} {stat.label}
                                </span>
                            </div>
                            <p className="font-bold text-sm text-gray-100 leading-snug truncate">{incident.title}</p>
                            <p className="text-gray-500 text-xs mt-0.5 font-mono">{incident.framework} · {incident.category}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(incident.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-gray-600 group-hover:text-gray-400 transition-colors">
                                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                        </div>
                    </div>
                </button>

                {/* Expanded Detail */}
                {expanded && (
                    <div className="mt-1 bg-black/60 border border-white/5 rounded-2xl p-5 space-y-4">
                        <p className="text-gray-300 text-sm leading-relaxed">{incident.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Affected Systems', value: incident.affectedSystems },
                                { label: 'Data Records', value: incident.dataRecords?.toLocaleString() ?? '--' },
                                { label: 'CVSS Score', value: incident.cvss ?? '--' },
                                { label: 'Mean Time to Detect', value: incident.mttd ?? '--' }
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                                    <p className="text-gray-500 text-[10px] uppercase tracking-wide font-bold mb-1">{label}</p>
                                    <p className="text-white font-bold text-sm">{value}</p>
                                </div>
                            ))}
                        </div>
                        {incident.remediation && (
                            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                                <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Remediation Path
                                </p>
                                <p className="text-gray-300 text-sm">{incident.remediation}</p>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                            {incident.tags?.map(tag => (
                                <span key={tag} className="text-[10px] bg-white/5 text-gray-400 px-2.5 py-1 rounded-full border border-white/10 font-medium">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ComplianceIncidentTimeline = ({ incidents = [], isLoading = false }) => {
    const [severityFilter, setSeverityFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const filtered = useMemo(() => {
        return incidents.filter(inc => {
            const sevMatch = severityFilter === 'all' || inc.severity === severityFilter;
            const statMatch = statusFilter === 'all' || inc.status === statusFilter;
            return sevMatch && statMatch;
        });
    }, [incidents, severityFilter, statusFilter]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* Filter Bar */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5" /> Filter:
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                        <button
                            key={s}
                            id={`severity-filter-${s}`}
                            onClick={() => setSeverityFilter(s)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all capitalize ${severityFilter === s
                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                    : 'border-white/10 text-gray-500 hover:border-white/25 hover:text-gray-300'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['all', 'open', 'investigating', 'mitigated', 'resolved'].map(s => (
                        <button
                            key={s}
                            id={`status-filter-${s}`}
                            onClick={() => setStatusFilter(s)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all capitalize ${statusFilter === s
                                    ? 'bg-white/15 border-white/30 text-white'
                                    : 'border-white/10 text-gray-500 hover:border-white/25 hover:text-gray-300'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline */}
            {filtered.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
                    <ShieldCheck className="w-12 h-12 text-emerald-500/30" />
                    <p className="text-sm font-medium">No incidents matching your filters</p>
                </div>
            ) : (
                <div className="pl-2">
                    {filtered.map((inc, idx) => (
                        <IncidentCard key={inc.id} incident={inc} isLast={idx === filtered.length - 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

ComplianceIncidentTimeline.propTypes = {
    incidents: PropTypes.array,
    isLoading: PropTypes.bool
};

export default ComplianceIncidentTimeline;
