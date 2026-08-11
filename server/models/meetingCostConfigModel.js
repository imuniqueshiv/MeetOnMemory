import mongoose from "mongoose";

/**
 * Per-member hourly rate override (Issue #1161).
 *
 * This used to be `memberRateOverrides: { type: Map, of: Number }` keyed by
 * email address. Mongoose maps cannot have keys containing `"."`, and every
 * real email address has at least one — in the domain. The two write paths
 * failed differently, and neither was visible to the caller:
 *
 *     cfg.memberRateOverrides.set("jane.doe@example.com", 120);
 *     // throws: Mongoose maps do not support keys that contain "."
 *
 *     Object.assign(cfg, { memberRateOverrides: { "jane.doe@example.com": 120 } });
 *     // no throw; the entry is silently dropped
 *     cfg.memberRateOverrides.get("jane.doe@example.com");      // undefined
 *     cfg.toObject({ flattenMaps: true }).memberRateOverrides;  // {}
 *
 * `updateConfig` takes the second path, so `PUT /api/meeting-cost/config`
 * answered `200 { success: true }` with an empty map and stored nothing. Every
 * cost calculation then fell back to `defaultHourlyRate` for every participant
 * — internally consistent, plausible, and wrong.
 *
 * An array of subdocuments stores the address verbatim, has no reserved-
 * character rules, and can be validated. Keying by user `_id` would also avoid
 * the problem, but rates are configured against people an admin identifies by
 * email and not every participant has a `User` row, so the array is the closer
 * fit for how the feature is actually used.
 */
const memberRateOverrideSchema = new mongoose.Schema(
  {
    // Stored normalized (trimmed + lowercased) by `setMemberRateOverrides`, so
    // an override set for `Jane.Doe@Example.com` applies to a participant
    // recorded as `jane.doe@example.com`. The old `Map.get(participant.email)`
    // was exact-match and case-sensitive, which would have been a second silent
    // miss even without the dot problem.
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const meetingCostConfigSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    defaultHourlyRate: {
      type: Number,
      default: 50, // Default cost per hour per participant
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    memberRateOverrides: {
      type: [memberRateOverrideSchema],
      default: [],
    },
    includePreparationTime: {
      type: Boolean,
      default: false,
    },
    prepTimeMultiplier: {
      type: Number,
      default: 1.0, // Multiplier for meeting duration to account for prep time (e.g., 1.5x)
      min: 0,
    },
  },
  { timestamps: true },
);

/** Normalizes an email for override lookup and storage. */
export const normalizeOverrideEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

/**
 * Reads the overrides as a plain `email -> rate` lookup.
 *
 * Tolerates the old `Map` / plain-object shape so a config document written
 * before this change still loads. In practice every stored map is empty — the
 * dotted keys never reached disk — but the read path should not assume that.
 *
 * @param {object|null|undefined} config
 * @returns {Map<string, number>}
 */
export const readMemberRateOverrides = (config) => {
  const lookup = new Map();
  const raw = config?.memberRateOverrides;
  if (!raw) return lookup;

  const add = (email, rate) => {
    const key = normalizeOverrideEmail(email);
    const value = Number(rate);
    if (key && Number.isFinite(value) && value >= 0) lookup.set(key, value);
  };

  if (Array.isArray(raw)) {
    raw.forEach((entry) => add(entry?.email, entry?.hourlyRate));
  } else if (
    typeof raw.forEach === "function" &&
    typeof raw.get === "function"
  ) {
    raw.forEach((rate, email) => add(email, rate)); // legacy Map
  } else if (typeof raw === "object") {
    Object.entries(raw).forEach(([email, rate]) => add(email, rate)); // legacy object
  }

  return lookup;
};

/**
 * Validates and applies a set of overrides, accepting either the new array form
 * or the `{ email: rate }` object clients previously sent.
 *
 * Throws on a malformed entry rather than dropping it — a silent drop is the
 * bug this whole change exists to remove.
 *
 * @param {object} config document to mutate
 * @param {Array|object} input
 * @returns {Array<{email: string, hourlyRate: number}>}
 */
export const setMemberRateOverrides = (config, input) => {
  const entries = Array.isArray(input)
    ? input.map((entry) => [entry?.email, entry?.hourlyRate])
    : Object.entries(input ?? {});

  const seen = new Set();
  const normalized = [];

  for (const [rawEmail, rawRate] of entries) {
    const email = normalizeOverrideEmail(rawEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid override email: ${JSON.stringify(rawEmail)}`);
    }

    // `Number()` coerces `null`, `""`, `[]` and `false` to 0 and `true` to 1,
    // so a bare `Number.isFinite` check would silently accept "no rate" as a
    // rate of zero — a free meeting, not a validation error the admin sees.
    const isNumericInput =
      typeof rawRate === "number" ||
      (typeof rawRate === "string" && rawRate.trim() !== "");
    const hourlyRate = isNumericInput ? Number(rawRate) : Number.NaN;

    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      throw new Error(
        `Invalid hourly rate for ${email}: ${JSON.stringify(rawRate)}`,
      );
    }

    if (seen.has(email)) {
      throw new Error(`Duplicate override for ${email}`);
    }
    seen.add(email);

    normalized.push({ email, hourlyRate });
  }

  config.memberRateOverrides = normalized;
  return normalized;
};

const MeetingCostConfig = mongoose.model(
  "MeetingCostConfig",
  meetingCostConfigSchema,
);
export default MeetingCostConfig;
