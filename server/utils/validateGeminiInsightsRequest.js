const MAX_SUMMARY_JSON_LENGTH = 10_000;

/**
 * Validate POST /api/gemini/insights body.
 * Rejects missing, malformed, or oversized `summary` payloads before calling Gemini.
 */
export const validateGeminiInsightsRequest = (body) => {
  const errors = [];
  const { summary } = body ?? {};

  if (summary === undefined || summary === null) {
    errors.push("Summary is required.");
  } else if (typeof summary !== "object" || Array.isArray(summary)) {
    errors.push("Summary must be a plain object.");
  } else {
    let serialized;
    try {
      serialized = JSON.stringify(summary);
    } catch {
      errors.push("Summary must be JSON-serializable.");
      return { isValid: false, errors };
    }

    if (serialized === "{}") {
      errors.push("Summary must not be empty.");
    }

    if (serialized.length > MAX_SUMMARY_JSON_LENGTH) {
      errors.push(
        `Summary must not exceed ${MAX_SUMMARY_JSON_LENGTH} characters when serialized.`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
