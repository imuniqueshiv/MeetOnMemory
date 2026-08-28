import React, { useState, useEffect } from "react";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Target,
  ListTodo,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { getMeetingCostDetails } from "../../services/meetingCostApi.js";

export const MeetingCostCard = ({ meetingId }) => {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCost = async () => {
      if (!meetingId) return;
      try {
        setLoading(true);
        const res = await getMeetingCostDetails(meetingId);
        if (res.success && res.data) {
          setCostData(res.data);
        }
      } catch (err) {
        console.error("Error fetching meeting cost details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCost();
  }, [meetingId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6 text-center text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-500" />
        Calculating meeting financial metrics...
      </div>
    );
  }

  if (!costData) return null;

  const {
    totalCost,
    currency,
    hourlyRate,
    participantCount,
    durationMinutes,
    decisionsCount,
    actionItemsCount,
    costPerDecision,
    costPerActionItem,
    isBudgetExceeded,
  } = costData;

  return (
    <div
      aria-label="Meeting Financial Investment and Efficiency Card"
      data-testid="meeting-cost-card"
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-6 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Financial Investment & ROI
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Estimated attendee time cost based on organization rates
            </p>
          </div>
        </div>

        <div>
          <span
            data-testid="cost-budget-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isBudgetExceeded
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            }`}
          >
            {isBudgetExceeded ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Budget Threshold Exceeded
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Optimal Investment
              </>
            )}
          </span>
        </div>
      </div>

      {/* Primary KPI Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Total Cost
          </span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">
            ${totalCost} <span className="text-xs font-normal">{currency}</span>
          </div>
          <span className="text-[10px] text-slate-400">
            ${hourlyRate}/hr avg rate
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Time Invested
          </span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
            <Clock className="w-4 h-4 text-blue-500" />
            {durationMinutes}m
          </div>
          <span className="text-[10px] text-slate-400">
            {participantCount} participants
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Cost / Decision
          </span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
            <Target className="w-4 h-4 text-purple-500" />
            {costPerDecision !== null ? `$${costPerDecision}` : "N/A"}
          </div>
          <span className="text-[10px] text-slate-400">
            {decisionsCount} decisions recorded
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Cost / Action Item
          </span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
            <ListTodo className="w-4 h-4 text-emerald-500" />
            {costPerActionItem !== null ? `$${costPerActionItem}` : "N/A"}
          </div>
          <span className="text-[10px] text-slate-400">
            {actionItemsCount} action items
          </span>
        </div>
      </div>
    </div>
  );
};

export default MeetingCostCard;
