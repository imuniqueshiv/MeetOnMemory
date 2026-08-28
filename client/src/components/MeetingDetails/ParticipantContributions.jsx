import React from "react";
import {
  useMeetingContributions,
  useCalculateMeetingContributions,
} from "../../hooks/useParticipantContributions";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const ParticipantContributions = ({ meetingId }) => {
  const { data, isLoading, isError } = useMeetingContributions(meetingId);
  const { mutate: calculateContributions, isPending } =
    useCalculateMeetingContributions();

  if (isLoading) return <div>Loading contributions...</div>;
  if (isError) return <div>Error loading contributions.</div>;

  const contributions = data?.contributions || [];
  const equityScore = data?.equityScore || 0;

  const handleCalculate = () => {
    calculateContributions(meetingId);
  };

  // Format data for Recharts Radar
  // Recharts radar expects data like: [{ subject: 'Math', A: 120, B: 110, fullMark: 150 }, ...]
  const radarData = [
    { dimension: "Verbal", fullMark: 100 },
    { dimension: "Task", fullMark: 100 },
    { dimension: "Decisional", fullMark: 100 },
    { dimension: "Collaborative", fullMark: 100 },
  ];

  contributions.forEach((c) => {
    radarData[0][c.participantName] = c.dimensions.verbal;
    radarData[1][c.participantName] = c.dimensions.task;
    radarData[2][c.participantName] = c.dimensions.decisional;
    radarData[3][c.participantName] = c.dimensions.collaborative;
  });

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F"];

  return (
    <div className="p-6 bg-white rounded-lg shadow-md space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-semibold">
          Participant Contribution Profile
        </h2>
        <button
          onClick={handleCalculate}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending
            ? "Calculating..."
            : contributions.length === 0
              ? "Calculate Now"
              : "Recalculate"}
        </button>
      </div>

      {contributions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-4 text-center">
              Multi-Dimensional Contributions
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  data={radarData}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  {contributions.map((c, index) => (
                    <Radar
                      key={c.participantId}
                      name={c.participantName}
                      dataKey={c.participantName}
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                      fillOpacity={0.3}
                    />
                  ))}
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Equity Gauge & Summary */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center justify-center h-48">
              <h3 className="text-lg font-medium mb-2">Meeting Equity Score</h3>
              <div
                className="text-5xl font-bold"
                style={{
                  color:
                    equityScore > 70
                      ? "#10B981"
                      : equityScore > 40
                        ? "#F59E0B"
                        : "#EF4444",
                }}
              >
                {equityScore}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {equityScore > 70
                  ? "Highly balanced participation."
                  : equityScore > 40
                    ? "Moderate imbalances detected."
                    : "Significant imbalances detected."}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              <h3 className="text-lg font-medium mb-4">
                Rankings & Coaching Tips
              </h3>
              <div className="space-y-4">
                {contributions
                  .sort((a, b) => b.overallImpact - a.overallImpact)
                  .map((c) => (
                    <div
                      key={c.participantId}
                      className="border-b pb-4 last:border-0"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">
                          {c.participantName}
                        </span>
                        <span className="text-sm bg-blue-100 text-blue-800 py-1 px-2 rounded-full">
                          Impact: {c.overallImpact}
                        </span>
                      </div>
                      {c.coachingTips.length > 0 && (
                        <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                          {c.coachingTips.map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-10">
          No contribution data available yet. Click 'Calculate Now' to generate
          it.
        </div>
      )}
    </div>
  );
};

export default ParticipantContributions;
