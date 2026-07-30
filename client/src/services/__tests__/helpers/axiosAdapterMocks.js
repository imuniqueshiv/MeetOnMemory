/**
 * Shared axios adapter mocks for apiClient interceptor integration tests.
 * Centralizes adapter setup so tests can focus on behavior, not boilerplate.
 */

/**
 * @param {import("axios").AxiosInstance} axiosInstance
 * @returns {import("axios").AxiosAdapter | undefined}
 */
export function captureAdapter(axiosInstance) {
  return axiosInstance.defaults.adapter;
}

/**
 * @param {import("axios").AxiosInstance} axiosInstance
 * @param {import("axios").AxiosAdapter | undefined} adapter
 */
export function restoreAdapter(axiosInstance, adapter) {
  axiosInstance.defaults.adapter = adapter;
}

/**
 * @param {import("axios").AxiosInstance} axiosInstance
 * @param {unknown} [data]
 * @param {number} [status]
 */
export function mockSuccessfulResponse(axiosInstance, data = {}, status = 200) {
  axiosInstance.defaults.adapter = async (config) => ({
    data,
    status,
    statusText: "OK",
    headers: {},
    config,
  });
}

/**
 * @param {import("axios").AxiosInstance} axiosInstance
 * @param {{ status?: number, data?: unknown }} [options]
 */
export function mockErrorResponse(
  axiosInstance,
  { status = 500, data = {} } = {},
) {
  axiosInstance.defaults.adapter = async (config) =>
    Promise.reject({
      config,
      response: {
        status,
        data,
        headers: {},
        config,
      },
      isAxiosError: true,
    });
}

/**
 * @param {import("axios").AxiosInstance} axiosInstance
 * @param {string} [message]
 */
export function mockNetworkFailure(axiosInstance, message = "Network Error") {
  axiosInstance.defaults.adapter = async () =>
    Promise.reject(new Error(message));
}

/**
 * Reject with a custom / partial Axios-like error shape.
 * Use for malformed responses that are awkward to express with mockErrorResponse.
 *
 * @param {import("axios").AxiosInstance} axiosInstance
 * @param {object | ((config: import("axios").InternalAxiosRequestConfig) => object)} errorOrFactory
 */
export function mockCustomError(axiosInstance, errorOrFactory) {
  axiosInstance.defaults.adapter = async (config) => {
    const error =
      typeof errorOrFactory === "function"
        ? errorOrFactory(config)
        : { config, ...errorOrFactory };
    return Promise.reject(error);
  };
}
