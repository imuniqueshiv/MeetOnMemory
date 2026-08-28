import React, { useState, useEffect } from "react";
import { Clock, CheckCircle, ChevronRight, AlertTriangle } from "lucide-react";

const PlaybookGuidancePanel = ({
  playbook,
  playbookState,
  advanceStep,
  emitTimerWarning,
  isFacilitator,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!playbookState?.isActive || !playbookState.startTime || !playbook)
      return;

    const currentStep = playbook.steps[playbookState.currentStepIndex];
    if (!currentStep) return;

    const durationMs = currentStep.durationMinutes * 60 * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - playbookState.startTime;
      const remaining = Math.max(0, durationMs - elapsed);
      setTimeRemaining(remaining);

      if (remaining < 60000 && remaining > 58000 && isFacilitator) {
        emitTimerWarning(playbookState.currentStepIndex);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [playbookState, playbook, isFacilitator, emitTimerWarning]);

  if (!playbook || !playbookState?.isActive) {
    return null;
  }

  const currentStep = playbook.steps[playbookState.currentStepIndex];
  const isLastStep =
    playbookState.currentStepIndex === playbook.steps.length - 1;

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleNextStep = () => {
    if (!isLastStep) {
      advanceStep(playbookState.currentStepIndex + 1);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border ${playbookState.timerWarning ? "border-red-500" : "border-gray-200 dark:border-gray-700"} p-4`}
      data-testid="playbook-guidance-panel"
    >
      <div className="flex items-center gap-2 font-bold text-lg border-b dark:border-gray-700 pb-3 mb-3">
        <CheckCircle className="text-green-500" size={20} />
        Playbook: {playbook.name}
      </div>

      <div className="flex justify-between items-center mb-4">
        <h4 className="text-md font-semibold">
          Step {playbookState.currentStepIndex + 1}: {currentStep.title}
        </h4>
        <div
          className={`flex items-center gap-1 font-mono text-lg font-bold ${timeRemaining < 60000 ? "text-red-600" : "text-gray-700 dark:text-gray-300"}`}
        >
          <Clock size={18} /> {formatTime(timeRemaining)}
        </div>
      </div>

      {playbookState.timerWarning && (
        <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md flex items-center gap-2 mb-4 text-sm border border-yellow-200">
          <AlertTriangle size={16} />
          Time is almost up for this step!
        </div>
      )}

      <div className="space-y-4 text-sm">
        <div>
          <strong className="block mb-1 text-gray-700 dark:text-gray-300">
            Facilitator Prompts:
          </strong>
          <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
            {currentStep.facilitatorPrompts.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong className="block mb-1 text-gray-700 dark:text-gray-300">
            Expected Outputs:
          </strong>
          <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
            {currentStep.expectedOutputs.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      </div>

      {isFacilitator && (
        <div className="mt-6">
          {!isLastStep ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              Next Step <ChevronRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed rounded-md"
            >
              Playbook Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PlaybookGuidancePanel;
