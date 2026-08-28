import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/userModel.js", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

const createdNotifications = [];
const mockSave = vi.fn().mockResolvedValue(true);

vi.mock("../models/notificationModel.js", () => {
  return {
    default: class MockNotification {
      constructor(data) {
        Object.assign(this, data);
        createdNotifications.push(data);
        this.save = mockSave;
      }
    },
  };
});

import User from "../models/userModel.js";
import {
  sanitizeMarkup,
  processMentionNotifications,
} from "../services/mentionNotificationService.js";

describe("mentionNotificationService", () => {
  beforeEach(() => {
    createdNotifications.length = 0;
    vi.clearAllMocks();
  });

  describe("sanitizeMarkup", () => {
    it("escapes HTML control characters to prevent XSS", () => {
      const rawInput = "<script>alert('xss')</script>";
      const sanitized = sanitizeMarkup(rawInput);
      expect(sanitized).toBe(
        "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
      );
    });
  });

  describe("processMentionNotifications", () => {
    it("creates notification for mentioned team members excluding self", async () => {
      const author = { _id: "author-123", name: "Sarah" };
      const mentionedUserId = "507f1f77bcf86cd799439011";

      User.findById.mockImplementation((id) =>
        Promise.resolve({ _id: id, name: "Target Member" }),
      );

      const notified = await processMentionNotifications({
        text: `Hey @[Target Member](${mentionedUserId}), please check this comment`,
        author,
        organizationId: "org-1",
        meeting: { _id: "m-100", title: "Product Review" },
        commentId: "c-555",
      });

      expect(notified).toContain(mentionedUserId);
      expect(createdNotifications[0]).toEqual(
        expect.objectContaining({
          user: mentionedUserId,
          title: "Sarah mentioned you in a comment",
          category: "meetings",
        }),
      );
    });
  });
});
