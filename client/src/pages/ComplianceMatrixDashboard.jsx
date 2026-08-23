import React, { useEffect, useState } from 'react';
import ComplianceMatrixService from '../services/complianceMatrixService';
import SecurityRadarChart from '../components/compliance/SecurityRadarChart';
import {
    ShieldCheck, ShieldAlert, AlertTriangle, Fingerprint,
    Lock, EyeOff, Activity, AlertOctagon
} from 'lucide-react';
import { toast } from 'react-toastify';

const ComplianceMatrixDashboard = () => {
    const [auditData, setAuditData] = useState(null);
    const [threats, setThreats] = useState([]);
    const [piiLogs, setPiiLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTelemetry = async () => {
            setLoading(true);
            try {
                const [audit, vectors, logs] = await Promise.all([
                    ComplianceMatrixService.getAuditScores(),
                    ComplianceMatrixService.getThreatVectors(),
                    ComplianceMatrixService.getPIILogs()
                ]);
                setAuditData(audit);
                setThreats(vectors);
                setPiiLogs(logs);
            } catch (error) {
                console.error(error);
                toast.error("Compliance engine failed to sync constraints.");
            } finally {
                setLoading(false);
            }
        };
        fetchTelemetry();
    }, []);

    const StatusBadge = ({ status }) => {
        const config = {
            passing: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: <ShieldCheck className="w-4 h-4 mr-1" /> },
            warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: <AlertTriangle className="w-4 h-4 mr-1" /> },
            failing: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <ShieldAlert className="w-4 h-4 mr-1" /> }
        };
        const current = config[status] || config.passing;
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center ${current.bg} ${current.text}`}>
                {current.icon} {status}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-[#07070a] text-gray-100 p-8 pt-10 font-sans pb-32">

            <header className="mb-10 pb-8 border-b border-indigo-500/20 flex flex-col md:flex-row md:items-end justify-between">
                <div>
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                            <Fingerprint className="w-10 h-10 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-indigo-300">
                            Security & Compliance
                        </h1>
                    </div>
                    <p className="max-w-2xl text-gray-400 font-medium leading-relaxed">
                        Continuous telemetry scanning across meeting datasets. NLP auditing for PII exfiltration, framework thresholds, and cryptographic vulnerabilities.
                    </p>
                </div>
                <div className="min-w-[200px] mt-6 md:mt-0 p-4 border border-white/5 rounded-2xl bg-white/5 backdrop-blur">
                    <span className="text-xs uppercase text-gray-500 font-bold tracking-widest block mb-1">Global Health</span>
                    <div className="flex items-end">
                        <span className="text-4xl font-black text-white">{loading ? '--' : auditData?.overallScore}</span>
                        <span className="text-xs text-gray-500 font-bold mb-1 ml-1 text-emerald-500">/100</span>
                    </div>
                    <div className="w-full bg-black h-1.5 mt-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[78%]"></div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Threat Vectors Radar */}
                <div className="flex flex-col space-y-4">
                    <h2 className="text-xl font-bold flex items-center text-white"><Activity className="w-5 h-5 mr-2 text-indigo-400" /> Threat Vector Extraction</h2>
                    <div className="flex-grow w-full relative">
                        <SecurityRadarChart data={threats} isLoading={loading} />
                    </div>
                </div>

                <div className="lg:col-span-2 flex flex-col space-y-8">

                    {/* Compliance Framework Matrices */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
                        <h2 className="text-xl font-bold flex items-center text-white mb-6"><Lock className="w-5 h-5 mr-2 text-indigo-400" /> Regulatory Framework Maps</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse"></div>)
                            ) : auditData?.frameworks.map((fw, idx) => (
                                <div key={idx} className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 transition-colors">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-black text-lg tracking-wide">{fw.name}</h3>
                                        <StatusBadge status={fw.status} />
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold">
                                        <span className="text-gray-400">Score: <span className="text-white">{fw.score}</span></span>
                                        <span className="text-gray-500">Target: {fw.threshold}</span>
                                    </div>
                                    <div className="w-full bg-black/60 h-2 rounded-full mt-2 overflow-hidden shadow-inner border border-white/5">
                                        <div
                                            className={`h-full ${fw.score >= fw.threshold ? 'bg-emerald-500' : 'bg-red-500'}`}
                                            style={{ width: `${fw.score}%` }}>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PII Exfiltration Log */}
                    <div className="flex-grow bg-gradient-to-b from-red-900/10 to-transparent border border-red-500/20 rounded-3xl p-6">
                        <h2 className="text-xl font-bold flex items-center text-red-100 mb-6"><EyeOff className="w-5 h-5 mr-2 text-red-400" /> PII Exfiltration Telemetry</h2>

                        <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="h-16 bg-white/5 rounded-xl animate-pulse"></div>
                            ) : piiLogs.map((log) => (
                                <div key={log.id} className="bg-black/80 border border-red-500/30 p-4 rounded-xl flex items-center justify-between group hover:border-red-500/80 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-red-500/10 rounded-lg">
                                            <AlertOctagon className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform" />
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <span className="font-bold text-gray-200 text-sm">{log.meeting}</span>
                                                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 font-bold uppercase tracking-wider">{log.type}</span>
                                            </div>
                                            <p className="text-red-400 font-mono text-xs mt-1 blur-[3px] hover:blur-none transition-all cursor-not-allowed">
                                                "{log.snippet}"
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Conf: {log.confidence * 100}%</div>
                                        <div className="text-gray-500 text-[10px]">{new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                            {!loading && piiLogs.length === 0 && (
                                <div className="w-full py-8 flex flex-col items-center justify-center text-gray-500">
                                    <ShieldCheck className="w-12 h-12 text-emerald-500/50 mb-3" />
                                    <p className="font-medium text-sm">No PII leaks detected natively.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default ComplianceMatrixDashboard;
