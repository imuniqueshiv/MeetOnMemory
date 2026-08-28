import { expect } from "vitest";

/**
 * Shared test helper asserting that all calls made to a mocked API client start with `/api/`.
 * @param {Object} mockApiClient - Object containing mocked methods (get, post, put, patch, delete)
 */
export const assertAllCallsUseApiPrefix = (mockApiClient) => {
  const methods = ["get", "post", "put", "patch", "delete"];
  methods.forEach((method) => {
    if (mockApiClient[method] && mockApiClient[method].mock) {
      mockApiClient[method].mock.calls.forEach((call) => {
        const url = call[0];
        if (typeof url === "string") {
          expect(url).toMatch(/^\/api\//);
        }
      });
    }
  });
};
