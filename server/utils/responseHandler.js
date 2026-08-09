/**
 * Standardizes successful API responses.
 * @param {Object} res - Express response object
 * @param {Object} data - Payload data to include in the response (will be spread into the response)
 * @param {string} [message="Success"] - Success message
 * @param {number} [statusCode=200] - HTTP status code
 */
export const sendSuccess = (
  res,
  data = {},
  message = "Success",
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
};

/**
 * Standardizes error API responses.
 * @param {Object} res - Express response object
 * @param {number} [statusCode=500] - HTTP status code
 * @param {string} [message="Server Error"] - Error message
 * @param {Object} [errorData={}] - Additional error details
 */
export const sendError = (
  res,
  statusCode = 500,
  message = "Server Error",
  errorData = {},
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...errorData,
  });
};
