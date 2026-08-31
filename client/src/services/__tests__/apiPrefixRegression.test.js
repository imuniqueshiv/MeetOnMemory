import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../apiClient";
import { assertAllCallsUseApiPrefix } from "./helpers/apiPrefixAssertionHelper.js";
import * as asyncMeetingApi from "../asyncMeetingApi";
import * as attendanceApi from "../attendanceApi";
import * as icebreakerApi from "../icebreakerApi";
import * as meetingAttendanceApi from "../meetingAttendanceApi";
import * as minutesApprovalApi from "../minutesApprovalApi";
import * as weeklyInsightApi from "../weeklyInsightApi.js";
import transferApi from "../transferApi";
import { debriefQAApi } from "../../api/debriefQAApi.js";
import * as actionItemChangeLogApi from "../../api/actionItemChangeLogApi.js";

/**
 * Centralized `/api` prefix regression suite (Issue #2657).
 *
 * Every client request path is relative: `apiClient`'s `baseURL` is the bare
 * backend origin, and the server mounts every router under `/api/...`. A path
 * that omits the prefix therefore 404s at runtime while looking perfectly
 * correct in review — the most common silent failure mode in this codebase.
 *
 * Two layers of protection live here:
 *
 *  1. An enumerated table of the critical modules whose prefixes were repaired
 *     across the prefix-fix issue series (weekly insights, ownership transfer,
 *     minutes approval, attendance, debrief Q&A, icebreakers, async meetings).
 *     Each entry pins the exact path a function must call, so a regression is
 *     reported as a path diff rather than a mystery 404.
 *  2. A static scan of every module under `client/src/services` and
 *     `client/src/api` that fails when *any* service — including one added
 *     tomorrow — issues a relative request that does not start with `/api/`.
 */

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const MEETING_ID = "m-100";
const ORG_ID = "org-100";

/**
 * Critical client service paths, grouped by module.
 *
 * `invoke` calls the real exported function against the mocked `apiClient`;
 * `method`/`path` describe the request that call must produce.
 */
const CRITICAL_MODULE_PATHS = [
  {
    module: "weeklyInsightApi",
    calls: [
      {
        name: "getLatestInsight",
        invoke: () => weeklyInsightApi.getLatestInsight(ORG_ID),
        method: "get",
        path: `/api/weekly-insights/${ORG_ID}/latest`,
      },
      {
        name: "getInsightHistory",
        invoke: () => weeklyInsightApi.getInsightHistory(ORG_ID, 2, 10),
        method: "get",
        path: `/api/weekly-insights/${ORG_ID}`,
      },
      {
        name: "triggerManualGeneration",
        invoke: () => weeklyInsightApi.triggerManualGeneration(ORG_ID),
        method: "post",
        path: `/api/weekly-insights/${ORG_ID}/generate`,
      },
    ],
  },
  {
    module: "transferApi",
    calls: [
      {
        name: "initiateTransfer",
        invoke: () => transferApi.initiateTransfer(MEETING_ID, "u-200"),
        method: "post",
        path: `/api/meetings/${MEETING_ID}/transfers`,
      },
      {
        name: "getTransferInbox",
        invoke: () => transferApi.getTransferInbox(),
        method: "get",
        path: "/api/ownership-transfers/inbox",
      },
      {
        name: "acceptTransfer",
        invoke: () => transferApi.acceptTransfer("t-100"),
        method: "post",
        path: "/api/ownership-transfers/t-100/accept",
      },
      {
        name: "rejectTransfer",
        invoke: () => transferApi.rejectTransfer("t-100"),
        method: "post",
        path: "/api/ownership-transfers/t-100/reject",
      },
    ],
  },
  {
    module: "minutesApprovalApi",
    calls: [
      {
        name: "getApprovalStatus",
        invoke: () => minutesApprovalApi.getApprovalStatus(MEETING_ID),
        method: "get",
        path: `/api/meetings/${MEETING_ID}/minutes-approval`,
      },
      {
        name: "submitApproval",
        invoke: () =>
          minutesApprovalApi.submitApproval(MEETING_ID, "Summary", ["u-200"]),
        method: "post",
        path: `/api/meetings/${MEETING_ID}/minutes-approval/submit`,
      },
      {
        name: "respondApproval",
        invoke: () =>
          minutesApprovalApi.respondApproval(
            MEETING_ID,
            "approved",
            "Looks ok",
          ),
        method: "put",
        path: `/api/meetings/${MEETING_ID}/minutes-approval/respond`,
      },
    ],
  },
  {
    module: "attendanceApi",
    calls: [
      {
        name: "getAttendanceStats",
        invoke: () => attendanceApi.getAttendanceStats({ range: "30d" }),
        method: "get",
        path: "/api/attendance-analytics/stats",
      },
      {
        name: "getAttendanceHeatmap",
        invoke: () => attendanceApi.getAttendanceHeatmap({ range: "30d" }),
        method: "get",
        path: "/api/attendance-analytics/heatmap",
      },
      {
        name: "getAttendanceTrends",
        invoke: () => attendanceApi.getAttendanceTrends({ range: "30d" }),
        method: "get",
        path: "/api/attendance-analytics/trends",
      },
      {
        name: "getMeetingTypeBreakdown",
        invoke: () => attendanceApi.getMeetingTypeBreakdown({ range: "30d" }),
        method: "get",
        path: "/api/attendance-analytics/types",
      },
      {
        name: "exportAttendanceCSV",
        invoke: () => attendanceApi.exportAttendanceCSV({ range: "30d" }),
        method: "get",
        path: "/api/attendance-analytics/export",
      },
    ],
  },
  {
    module: "meetingAttendanceApi",
    calls: [
      {
        name: "getMeetingAttendance",
        invoke: () => meetingAttendanceApi.getMeetingAttendance(MEETING_ID),
        method: "get",
        path: `/api/meetings/${MEETING_ID}/attendance`,
      },
      {
        name: "checkIn",
        invoke: () =>
          meetingAttendanceApi.checkIn(
            MEETING_ID,
            "user@example.com",
            "2026-08-31T10:00:00.000Z",
          ),
        method: "post",
        path: `/api/meetings/${MEETING_ID}/attendance/checkin`,
      },
      {
        name: "checkOut",
        invoke: () =>
          meetingAttendanceApi.checkOut(
            MEETING_ID,
            "user@example.com",
            "2026-08-31T11:00:00.000Z",
          ),
        method: "post",
        path: `/api/meetings/${MEETING_ID}/attendance/checkout`,
      },
      {
        name: "markExcused",
        invoke: () =>
          meetingAttendanceApi.markExcused(MEETING_ID, "user@example.com"),
        method: "put",
        path: `/api/meetings/${MEETING_ID}/attendance/excuse`,
      },
      {
        name: "finalizeAttendance",
        invoke: () => meetingAttendanceApi.finalizeAttendance(MEETING_ID),
        method: "post",
        path: `/api/meetings/${MEETING_ID}/attendance/finalize`,
      },
    ],
  },
  {
    module: "debriefQAApi",
    calls: [
      {
        name: "askQuestion",
        invoke: () => debriefQAApi.askQuestion(MEETING_ID, "What was decided?"),
        method: "post",
        path: "/api/debrief/session",
      },
      {
        name: "getSession",
        invoke: () => debriefQAApi.getSession(MEETING_ID),
        method: "get",
        path: `/api/debrief/session/${MEETING_ID}`,
      },
    ],
  },
  {
    module: "icebreakerApi",
    calls: [
      {
        name: "generateIcebreakers",
        invoke: () => icebreakerApi.generateIcebreakers(MEETING_ID, ["u-200"]),
        method: "post",
        path: "/api/icebreakers/generate",
      },
      {
        name: "selectIcebreaker",
        invoke: () =>
          icebreakerApi.selectIcebreaker(MEETING_ID, "fun", "Prompt text"),
        method: "post",
        path: "/api/icebreakers/select",
      },
    ],
  },
  {
    module: "asyncMeetingApi",
    calls: [
      {
        name: "getAsyncMeetings",
        invoke: () => asyncMeetingApi.getAsyncMeetings({ status: "pending" }),
        method: "get",
        path: "/api/async-meetings",
      },
      {
        name: "getAsyncMeetingById",
        invoke: () => asyncMeetingApi.getAsyncMeetingById("async-100"),
        method: "get",
        path: "/api/async-meetings/async-100",
      },
      {
        name: "createAsyncMeeting",
        invoke: () => asyncMeetingApi.createAsyncMeeting({ title: "Sync" }),
        method: "post",
        path: "/api/async-meetings",
      },
      {
        name: "submitAsyncUpdate",
        invoke: () => asyncMeetingApi.submitAsyncUpdate("async-100", []),
        method: "post",
        path: "/api/async-meetings/async-100/submit",
      },
    ],
  },
  {
    module: "actionItemChangeLogApi",
    calls: [
      {
        name: "fetchChangeLogs",
        invoke: () => actionItemChangeLogApi.fetchChangeLogs("a-100", {}),
        method: "get",
        path: "/api/action-items/a-100/changelog",
      },
      {
        name: "fetchChangeLogStats",
        invoke: () => actionItemChangeLogApi.fetchChangeLogStats("a-100"),
        method: "get",
        path: "/api/action-items/a-100/changelog/stats",
      },
    ],
  },
];

describe("Centralized /api prefix regression suite (#2657)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Services unwrap `response.data`, so every method must resolve a response.
    apiClient.get.mockResolvedValue({ data: {} });
    apiClient.post.mockResolvedValue({ data: {} });
    apiClient.put.mockResolvedValue({ data: {} });
    apiClient.patch.mockResolvedValue({ data: {} });
    apiClient.delete.mockResolvedValue({ data: {} });
  });

  describe.each(CRITICAL_MODULE_PATHS)("$module", ({ calls }) => {
    it.each(calls)(
      "$name requests $method $path",
      async ({ invoke, method, path }) => {
        await invoke();

        expect(apiClient[method]).toHaveBeenCalledTimes(1);
        expect(apiClient[method].mock.calls[0][0]).toBe(path);
        assertAllCallsUseApiPrefix(apiClient);
      },
    );
  });
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = resolve(__dirname, "../..");
const SCANNED_DIRS = ["services", "api"];
const HTTP_CALL_PATTERN =
  /\.(get|post|put|patch|delete)\(\s*(["'`])([^"'`]*)\2/g;

/** Every non-test module under the scanned service directories. */
const collectServiceModules = (dir) => {
  const modules = [];
  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry);
    if (statSync(entryPath).isDirectory()) {
      // `__tests__` / `__mocks__` hold expectations, not real request paths.
      if (entry.startsWith("__")) continue;
      modules.push(...collectServiceModules(entryPath));
      continue;
    }
    if (!/\.jsx?$/.test(entry)) continue;
    if (/\.(test|spec)\.jsx?$/.test(entry)) continue;
    modules.push(entryPath);
  }
  return modules;
};

/**
 * Relative request paths in `file` that are missing the `/api` prefix.
 *
 * Only root-relative string literals are inspected: absolute URLs (external
 * services) and non-path arguments such as `headers.get("Authorization")`
 * carry no prefix obligation.
 */
const findUnprefixedPaths = (file) => {
  const source = readFileSync(file, "utf8");
  const violations = [];
  for (const [, method, , url] of source.matchAll(HTTP_CALL_PATTERN)) {
    if (!url.startsWith("/")) continue;
    if (url === "/api" || url.startsWith("/api/")) continue;
    violations.push(`${method.toUpperCase()} ${url}`);
  }
  return violations;
};

describe("Service path prefix guard (#2657)", () => {
  const modules = SCANNED_DIRS.flatMap((dir) =>
    collectServiceModules(join(CLIENT_SRC, dir)),
  );

  it("scans every service module", () => {
    expect(modules.length).toBeGreaterThan(0);
  });

  it("rejects relative request paths that omit /api", () => {
    const violations = modules.flatMap((file) =>
      findUnprefixedPaths(file).map(
        (call) => `client/src/${relative(CLIENT_SRC, file)}: ${call}`,
      ),
    );

    expect(
      violations,
      `Relative request paths must start with /api — the server mounts every router under /api.\n${violations.join(
        "\n",
      )}`,
    ).toEqual([]);
  });
});
