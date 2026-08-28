// server/tests/minutes.test.js
import { handleApprovalAction } from "../controllers/minutesApprovalController";

describe("MoM Governance Verification Engine", () => {
  test("Should strictly reject approval attempts from unauthorized user roles", async () => {
    const mockReq = {
      params: { minutesId: "mom-990" },
      body: { userId: "usr-43", role: "STANDARD_ATTENDEE", action: "APPROVE" },
    };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handleApprovalAction(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "UNAUTHORIZED_ACTION: User lacks approval authority",
      }),
    );
  });
});
