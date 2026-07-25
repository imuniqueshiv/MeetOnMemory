import request from "supertest";
import { app } from "../../server.js";

/**
 * Creates a supertest agent that is pre-configured with a valid CSRF token.
 *
 * Usage:
 *   const { agent, csrfToken } = await createCsrfAgent();
 *   const res = await agent
 *     .post("/api/some-route")
 *     .set("X-CSRF-Token", csrfToken)
 *     .send({ ... });
 *
 * @returns {{ agent: request.SuperAgentTest, csrfToken: string }}
 */
export async function createCsrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get("/api/csrf-token");
  return { agent, csrfToken: res.body.csrfToken };
}

/**
 * Fetches a fresh CSRF token using an existing agent.
 * Useful when a previous token may have been rotated.
 *
 * @param {request.SuperAgentTest} agent
 * @returns {string}
 */
export async function refreshCsrfToken(agent) {
  const res = await agent.get("/api/csrf-token");
  return res.body.csrfToken;
}
