export const validateAiSearchRequest = (body) => {
  const { query, filters } = body;
  const errors = [];

  if (typeof query !== "string") {
    errors.push("Query must be a string.");
  } else {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      errors.push("Query text is required.");
    }

    if (trimmedQuery.length > 500) {
      errors.push("Query must not exceed 500 characters.");
    }
  }

  if (
    filters !== undefined &&
    (typeof filters !== "object" || filters === null || Array.isArray(filters))
  ) {
    errors.push("Filters must be an object.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
