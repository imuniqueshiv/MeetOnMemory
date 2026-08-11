import { describe, it, expect, vi } from "vitest";
import meetingSocket from "../socket/meetingSocket.js";

// Mock the Meeting model globally for this test file
vi.mock("../models/meetingModel.js", () => ({
  default: {
    findById: vi.fn().mockResolvedValue({
      _id: "meeting_789",
      uploadedBy: "user_456",
    }),
  },
}));

describe("Meeting Presence Spoofing Prevention", () => {
  it("ignores client userInfo and uses auth context", async () => {
    let connectionCallback;
    const mockIo = {
      on: (event, cb) => {
        if (event === "connection") {
          connectionCallback = cb;
        }
      },
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    };

    meetingSocket(mockIo);

    // Create a mock socket representing authenticated client
    const mockSocket = {
      id: "socket_123",
      userId: "user_456",
      userRole: "admin",
      user: {
        name: "Legit User",
        email: "legit@example.com",
        profilePic: "https://example.com/pic.png",
      },
      join: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    };

    // Trigger connection
    connectionCallback(mockSocket);

    // Find the join-meeting listener registered on socket
    const joinMeetingCall = mockSocket.on.mock.calls.find(
      (call) => call[0] === "join-meeting",
    );
    expect(joinMeetingCall).toBeDefined();
    const joinMeetingListener = joinMeetingCall[1];

    // Call join-meeting with a spoofed userInfo payload
    const spoofedUserInfo = {
      name: "Imposter Admin",
      email: "imposter@example.com",
      profilePic: "https://example.com/fake.png",
      role: "owner",
    };

    await joinMeetingListener({
      roomId: "meeting_789",
      userInfo: spoofedUserInfo,
    });

    // Check that socket.to was called to broadcast the user joined event
    expect(mockSocket.to).toHaveBeenCalledWith("meeting_789");

    // Find the user-joined broadcast call
    const toResult = mockSocket.to.mock.results[0].value;
    const userJoinedCall = toResult.emit.mock.calls.find(
      (call) => call[0] === "user-joined",
    );
    expect(userJoinedCall).toBeDefined();
    const broadcastedUser = userJoinedCall[1];

    // Assert that the spoofed fields were ignored and correct server-side fields were used
    expect(broadcastedUser.name).toBe("Legit User");
    expect(broadcastedUser.email).toBe("legit@example.com");
    expect(broadcastedUser.profilePic).toBe("https://example.com/pic.png");
    expect(broadcastedUser.role).toBe("admin");
  });
});
