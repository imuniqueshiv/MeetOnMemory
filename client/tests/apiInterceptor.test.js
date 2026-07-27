// eslint-disable-next-line no-unused-vars
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import apiClient from "../src/services/apiClient.js";

let mock;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

  afterEach(() => {
    mock.restore();
  });

  const clientErrorCases = [
    [400, "Bad Request"],
    [408, "Request Timeout"],
    [409, "Conflict"],
    [422, "Unprocessable Entity"],
    [429, "Too Many Requests"],
  ];

  test.each(clientErrorCases)(
    "preserves response and backend message for %s",
    async (status, message) => {
      mock.onGet("/client-error").reply(status, { message });

      try {
        await apiClient.get("/client-error");
        throw new Error("Request should have failed");
      } catch (error) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(status);
        expect(error.response.data.message).toBe(message);
        expect(error.message).toBe(message);
      }
    },
  );

  const serverErrorCases = [502, 503, 504];

  test.each(serverErrorCases)(
    "returns friendly server message for %s",
    async (status) => {
      mock.onGet("/server-error").reply(status, { message: "Original backend message" });

      try {
        await apiClient.get("/server-error");
        throw new Error("Request should have failed");
      } catch (error) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(status);
        expect(error.response.data.message).toBe(
          "Server unavailable. Please try again later.",
        );
        expect(error.message).toBe(
          "Server unavailable. Please try again later.",
        );
      }
    },
  );

