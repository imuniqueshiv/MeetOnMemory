/**
 * Meeting Cost Tracker Utility Functions (Issue #2613)
 * Centralizes real-time meeting cost calculations, team metrics, filtering, sorting,
 * and cost-saving recommendations with effort levels.
 */

export const DEFAULT_AVG_SALARY = 8000; // $8,000 / month ($50/hr based on 160 hrs/mo)
export const MONTHLY_WORKING_HOURS = 160;

/**
 * Calculates hourly rate based on monthly average salary.
 * Formula: avgSalary / 160
 */
export const getHourlyRate = (avgSalary = DEFAULT_AVG_SALARY) => {
  const salary = Number(avgSalary) || DEFAULT_AVG_SALARY;
  return Math.max(0, salary / MONTHLY_WORKING_HOURS);
};

/**
 * Converts duration from minutes to hours.
 */
export const getDurationHours = (durationMinutes = 60) => {
  const minutes = Number(durationMinutes) || 30;
  return Math.max(0, minutes / 60);
};

/**
 * Maps frequency string to monthly occurrence multiplier.
 */
export const getMonthlyFrequencyMultiplier = (frequency = "weekly") => {
  const freqKey = String(frequency || "weekly")
    .toLowerCase()
    .trim();
  switch (freqKey) {
    case "daily":
      return 20;
    case "weekly":
      return 4;
    case "bi-weekly":
    case "biweekly":
      return 2;
    case "monthly":
      return 1;
    case "one-time":
    case "once":
    case "single":
      return 1;
    default:
      return 4;
  }
};

/**
 * Calculates cost for a single meeting instance.
 * Formula: (avgSalary / 160) * participants * hours
 */
export const calculateSingleMeetingCost = (
  avgSalary = DEFAULT_AVG_SALARY,
  participantsCount = 1,
  durationMinutes = 60,
) => {
  const hourlyRate = getHourlyRate(avgSalary);
  const hours = getDurationHours(durationMinutes);
  const count = Math.max(1, Number(participantsCount) || 1);
  return hourlyRate * count * hours;
};

/**
 * Calculates monthly cost for a meeting.
 * Formula: avgSalary / 160 * participants * hours * frequency
 */
export const calculateMonthlyMeetingCost = (
  avgSalary = DEFAULT_AVG_SALARY,
  participantsCount = 1,
  durationMinutes = 60,
  frequency = "weekly",
) => {
  const singleCost = calculateSingleMeetingCost(
    avgSalary,
    participantsCount,
    durationMinutes,
  );
  const multiplier = getMonthlyFrequencyMultiplier(frequency);
  return singleCost * multiplier;
};

/**
 * Calculates total person-hours per month for a meeting.
 * Formula: participants * hours * frequency
 */
export const calculateMonthlyPersonHours = (
  participantsCount = 1,
  durationMinutes = 60,
  frequency = "weekly",
) => {
  const count = Math.max(1, Number(participantsCount) || 1);
  const hours = getDurationHours(durationMinutes);
  const multiplier = getMonthlyFrequencyMultiplier(frequency);
  return count * hours * multiplier;
};

/**
 * Enriches meeting object with calculated cost and metric fields.
 */
export const enrichMeetingCostData = (
  meeting = {},
  avgSalary = DEFAULT_AVG_SALARY,
) => {
  const participantsCount =
    meeting.participantsCount !== undefined
      ? Math.max(1, Number(meeting.participantsCount))
      : Array.isArray(meeting.participants) && meeting.participants.length > 0
        ? meeting.participants.length
        : Number(meeting.maxParticipants) || 3;

  const durationMinutes =
    Number(meeting.durationMinutes || meeting.duration) || 60;
  const frequency = meeting.frequency || meeting.meetingFrequency || "weekly";
  const team = meeting.team || meeting.teamName || "General";
  const hourlyRate = getHourlyRate(avgSalary);
  const singleCost = calculateSingleMeetingCost(
    avgSalary,
    participantsCount,
    durationMinutes,
  );
  const monthlyCost = calculateMonthlyMeetingCost(
    avgSalary,
    participantsCount,
    durationMinutes,
    frequency,
  );
  const personHours = calculateMonthlyPersonHours(
    participantsCount,
    durationMinutes,
    frequency,
  );
  const frequencyMultiplier = getMonthlyFrequencyMultiplier(frequency);

  return {
    ...meeting,
    _id: meeting._id || meeting.id || Math.random().toString(),
    title: meeting.title || "Untitled Meeting",
    team,
    participantsCount,
    durationMinutes,
    frequency,
    frequencyMultiplier,
    hourlyRate,
    singleCost,
    monthlyCost,
    personHours,
  };
};

/**
 * Aggregates meeting costs and person-hours by team.
 */
export const calculateTeamMetrics = (
  meetings = [],
  teamSalaryOverrides = {},
  defaultAvgSalary = DEFAULT_AVG_SALARY,
) => {
  const teamMap = {};

  meetings.forEach((m) => {
    const enriched = enrichMeetingCostData(
      m,
      teamSalaryOverrides[m.team] || defaultAvgSalary,
    );
    const team = enriched.team;

    if (!teamMap[team]) {
      const avgSalary = teamSalaryOverrides[team] || defaultAvgSalary;
      teamMap[team] = {
        teamName: team,
        avgSalary,
        hourlyRate: getHourlyRate(avgSalary),
        meetingCount: 0,
        totalMonthlyCost: 0,
        totalPersonHours: 0,
        memberCount: 0,
        memberEmails: new Set(),
      };
    }

    teamMap[team].meetingCount += 1;
    teamMap[team].totalMonthlyCost += enriched.monthlyCost;
    teamMap[team].totalPersonHours += enriched.personHours;

    if (Array.isArray(m.participants)) {
      m.participants.forEach((p) => {
        if (p.email || p.name) {
          teamMap[team].memberEmails.add(p.email || p.name);
        }
      });
    }
  });

  return Object.values(teamMap).map((team) => {
    const memberCount = Math.max(1, team.memberEmails.size || 5);
    const costPerMember = team.totalMonthlyCost / memberCount;

    return {
      ...team,
      memberCount,
      costPerMember,
      memberEmails: Array.from(team.memberEmails),
    };
  });
};

/**
 * Filters and sorts meetings list deterministically.
 */
export const filterAndSortMeetings = (
  meetings = [],
  selectedTeam = "all",
  sortBy = "cost",
  sortOrder = "desc",
  avgSalary = DEFAULT_AVG_SALARY,
) => {
  const enriched = meetings.map((m) => enrichMeetingCostData(m, avgSalary));

  const filtered =
    selectedTeam === "all"
      ? enriched
      : enriched.filter(
          (m) =>
            String(m.team).toLowerCase() === String(selectedTeam).toLowerCase(),
        );

  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "cost":
        comparison = a.monthlyCost - b.monthlyCost;
        break;
      case "participants":
        comparison = a.participantsCount - b.participantsCount;
        break;
      case "duration":
        comparison = a.durationMinutes - b.durationMinutes;
        break;
      case "frequency":
        comparison = a.frequencyMultiplier - b.frequencyMultiplier;
        break;
      default:
        comparison = a.monthlyCost - b.monthlyCost;
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return sorted;
};

/**
 * Generates actionable cost-saving recommendations with effort levels (Low, Medium, High).
 */
export const generateCostRecommendations = (
  meetings = [],
  teamMetrics = [],
  avgSalary = DEFAULT_AVG_SALARY,
) => {
  const enriched = meetings.map((m) => enrichMeetingCostData(m, avgSalary));
  const recommendations = [];

  // Recommendation 1: Reduce long recurring meetings (> 45 mins with >= 5 participants)
  const longRecurring = enriched.filter(
    (m) =>
      m.durationMinutes > 45 &&
      m.participantsCount >= 5 &&
      ["daily", "weekly"].includes(String(m.frequency).toLowerCase()),
  );

  if (longRecurring.length > 0) {
    const potentialMonthlySavings = longRecurring.reduce((sum, m) => {
      return sum + m.monthlyCost * 0.25;
    }, 0);

    recommendations.push({
      id: "rec-trim-duration",
      title: "Trim Long Recurring Standups",
      description: `Shorten ${longRecurring.length} recurring meeting(s) over 45 minutes by 15-20 minutes.`,
      effort: "Low",
      monthlySavings: Math.round(potentialMonthlySavings),
      annualSavings: Math.round(potentialMonthlySavings * 12),
      actionText: "Set 30-min agenda cap",
    });
  } else {
    recommendations.push({
      id: "rec-trim-duration-default",
      title: "Cap Recurring Standups to 30 Minutes",
      description:
        "Keep recurring syncs under 30 minutes to reduce routine meeting overhead.",
      effort: "Low",
      monthlySavings: 350,
      annualSavings: 4200,
      actionText: "Apply 30-min cap",
    });
  }

  // Recommendation 2: Audit high-participant meetings (>= 8 participants)
  const largeMeetings = enriched.filter((m) => m.participantsCount >= 8);
  if (largeMeetings.length > 0) {
    const potentialMonthlySavings = largeMeetings.reduce((sum, m) => {
      return sum + m.monthlyCost * 0.2;
    }, 0);

    recommendations.push({
      id: "rec-audit-headcount",
      title: "Audit High-Headcount Meetings",
      description: `Review ${largeMeetings.length} large meeting(s) with 8+ attendees and designate optional observers.`,
      effort: "Medium",
      monthlySavings: Math.round(potentialMonthlySavings),
      annualSavings: Math.round(potentialMonthlySavings * 12),
      actionText: "Designate optional attendees",
    });
  } else {
    recommendations.push({
      id: "rec-audit-headcount-default",
      title: "Designate Optional Meeting Observers",
      description: "Shift non-essential attendees to async summary recipients.",
      effort: "Medium",
      monthlySavings: 500,
      annualSavings: 6000,
      actionText: "Audit attendee lists",
    });
  }

  // Recommendation 3: Convert daily status syncs to async standups
  const dailySyncs = enriched.filter(
    (m) => String(m.frequency).toLowerCase() === "daily",
  );
  if (dailySyncs.length > 0) {
    const potentialMonthlySavings = dailySyncs.reduce((sum, m) => {
      return sum + m.monthlyCost * 0.5;
    }, 0);

    recommendations.push({
      id: "rec-async-standup",
      title: "Transition Daily Syncs to Async Reports",
      description: `Convert ${dailySyncs.length} daily status meeting(s) into automated MeetOnMemory async standups.`,
      effort: "High",
      monthlySavings: Math.round(potentialMonthlySavings),
      annualSavings: Math.round(potentialMonthlySavings * 12),
      actionText: "Enable Async Standup",
    });
  } else {
    recommendations.push({
      id: "rec-async-standup-default",
      title: "Adopt Async Status Reports for Distributed Teams",
      description:
        "Replace daily status meetings with automated MeetOnMemory AI summaries.",
      effort: "High",
      monthlySavings: 800,
      annualSavings: 9600,
      actionText: "Enable Async Standup",
    });
  }

  // Recommendation 4: Optimize high-spend teams if teamMetrics provided
  if (Array.isArray(teamMetrics) && teamMetrics.length > 0) {
    const topTeam = [...teamMetrics].sort(
      (a, b) => b.totalMonthlyCost - a.totalMonthlyCost,
    )[0];
    if (topTeam && topTeam.totalMonthlyCost > 500) {
      const teamSavings = Math.round(topTeam.totalMonthlyCost * 0.15);
      recommendations.push({
        id: "rec-high-spend-team",
        title: `Optimize ${topTeam.teamName} Team Meeting Cadence`,
        description: `The ${topTeam.teamName} team has high monthly meeting spend ($${Math.round(topTeam.totalMonthlyCost)}/mo). Auditing sync frequencies can yield significant savings.`,
        effort: "Medium",
        monthlySavings: teamSavings,
        annualSavings: teamSavings * 12,
        actionText: `Review ${topTeam.teamName} syncs`,
      });
    }
  }

  return recommendations;
};
