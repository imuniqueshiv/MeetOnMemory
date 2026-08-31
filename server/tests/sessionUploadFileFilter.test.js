import { describe, it, expect, jest } from "@jest/globals";

jest.unstable_mockModule("../controllers/sessionController.js", () => ({
  generateSession: jest.fn(),
  getSessions: jest.fn(),
  getSessionById: jest.fn(),
  createSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
}));

const {
  sessionFileFilter,
  ALLOWED_SLIDE_EXTENSIONS,
  ALLOWED_SLIDE_MIME_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES,
} = await import("../routes/sessionRoutes.js");

describe("Session Upload Multer sessionFileFilter (#2737)", () => {
  it("exports allowed extensions and mime types for slides and video", () => {
    expect(ALLOWED_SLIDE_EXTENSIONS).toContain(".pdf");
    expect(ALLOWED_SLIDE_EXTENSIONS).toContain(".pptx");
    expect(ALLOWED_SLIDE_MIME_TYPES).toContain("application/pdf");
    expect(ALLOWED_VIDEO_EXTENSIONS).toContain(".mp4");
    expect(ALLOWED_VIDEO_EXTENSIONS).toContain(".webm");
    expect(ALLOWED_VIDEO_MIME_TYPES).toContain("video/mp4");
  });

  describe("Slides Field Validation", () => {
    it("accepts valid presentation and image slide formats", () => {
      const validSlides = [
        {
          fieldname: "slides",
          originalname: "deck.pdf",
          mimetype: "application/pdf",
        },
        {
          fieldname: "slides",
          originalname: "pitch.pptx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
        {
          fieldname: "slides",
          originalname: "legacy.ppt",
          mimetype: "application/vnd.ms-powerpoint",
        },
        {
          fieldname: "slides",
          originalname: "slide1.png",
          mimetype: "image/png",
        },
        {
          fieldname: "slides",
          originalname: "slide2.jpg",
          mimetype: "image/jpeg",
        },
        {
          fieldname: "slides",
          originalname: "slide3.webp",
          mimetype: "image/webp",
        },
      ];

      validSlides.forEach((file) => {
        const cb = jest.fn();
        sessionFileFilter({}, file, cb);
        expect(cb).toHaveBeenCalledWith(null, true);
      });
    });

    it("rejects malicious or invalid extensions in slides field", () => {
      const invalidSlides = [
        {
          fieldname: "slides",
          originalname: "malware.exe",
          mimetype: "application/x-msdownload",
        },
        {
          fieldname: "slides",
          originalname: "exploit.sh",
          mimetype: "text/x-shellscript",
        },
        {
          fieldname: "slides",
          originalname: "hack.php",
          mimetype: "application/x-php",
        },
        {
          fieldname: "slides",
          originalname: "payload.js",
          mimetype: "application/javascript",
        },
      ];

      invalidSlides.forEach((file) => {
        const cb = jest.fn();
        sessionFileFilter({}, file, cb);
        expect(cb).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("Invalid slide file format"),
          }),
          false,
        );
      });
    });
  });

  describe("Video Field Validation", () => {
    it("accepts valid video formats", () => {
      const validVideos = [
        {
          fieldname: "video",
          originalname: "session.mp4",
          mimetype: "video/mp4",
        },
        {
          fieldname: "video",
          originalname: "recording.webm",
          mimetype: "video/webm",
        },
        {
          fieldname: "video",
          originalname: "presentation.mov",
          mimetype: "video/quicktime",
        },
        {
          fieldname: "video",
          originalname: "archive.mkv",
          mimetype: "video/x-matroska",
        },
      ];

      validVideos.forEach((file) => {
        const cb = jest.fn();
        sessionFileFilter({}, file, cb);
        expect(cb).toHaveBeenCalledWith(null, true);
      });
    });

    it("rejects non-video or malicious payloads in video field", () => {
      const invalidVideos = [
        {
          fieldname: "video",
          originalname: "video_trojan.exe",
          mimetype: "application/octet-stream",
        },
        {
          fieldname: "video",
          originalname: "script.sh",
          mimetype: "text/x-sh",
        },
        {
          fieldname: "video",
          originalname: "notes.txt",
          mimetype: "text/plain",
        },
      ];

      invalidVideos.forEach((file) => {
        const cb = jest.fn();
        sessionFileFilter({}, file, cb);
        expect(cb).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("Invalid video file format"),
          }),
          false,
        );
      });
    });
  });

  describe("Unexpected Field Validation", () => {
    it("rejects uploads under unexpected field names", () => {
      const cb = jest.fn();
      sessionFileFilter(
        {},
        {
          fieldname: "avatar",
          originalname: "avatar.png",
          mimetype: "image/png",
        },
        cb,
      );
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Unexpected field for upload"),
        }),
        false,
      );
    });
  });
});
