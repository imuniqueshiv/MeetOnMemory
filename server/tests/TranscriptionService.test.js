import { jest } from "@jest/globals";

// Set environment variable BEFORE importing the service module so it reads the mock key
const MOCK_API_KEY = "test-api-key";
process.env.ASSEMBLYAI_API_KEY = MOCK_API_KEY;

// Mock the external dependencies for ESM
jest.unstable_mockModule("axios", () => ({
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.unstable_mockModule("fs", () => ({
  default: {
    readFileSync: jest.fn(),
  },
}));

jest.unstable_mockModule("../utils/fileUtils.js", () => ({
  validatePath: jest.fn(),
}));

// Import the modules dynamically AFTER mocking (required for Jest ESM)
const axios = (await import("axios")).default;
const fs = (await import("fs")).default;
const { validatePath } = await import("../utils/fileUtils.js");
const { transcribeFile, transcribeAudioUrl } = await import("../services/TranscriptionService.js");

describe("TranscriptionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("transcribeFile", () => {
    it("should upload a file and poll for transcription text", async () => {
      // 1. Setup the mocks
      const mockFilePath = "/fake/uploads/audio.mp3";
      validatePath.mockReturnValue(mockFilePath);
      fs.readFileSync.mockReturnValue("fake-audio-buffer");

      // Mock axios post (upload and start transcription job)
      axios.post
        .mockResolvedValueOnce({ data: { upload_url: "https://fake.url/audio" } }) // First post: Upload
        .mockResolvedValueOnce({ data: { id: "fake-job-id" } }); // Second post: Start Transcript

      // Mock axios get (polling)
      axios.get
        .mockResolvedValueOnce({ data: { status: "processing" } }) // First poll
        .mockResolvedValueOnce({ data: { status: "completed", text: "Hello world!" } }); // Second poll

      // 2. Execute the service method
      const result = await transcribeFile(mockFilePath);

      // 3. Assert the results and that external APIs were called correctly
      expect(result).toBe("Hello world!");
      expect(validatePath).toHaveBeenCalledWith(mockFilePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath);
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(axios.get).toHaveBeenCalledWith(
        "https://api.assemblyai.com/v2/transcript/fake-job-id",
        expect.objectContaining({ headers: { authorization: MOCK_API_KEY } })
      );
    });

    it("should throw an error if the transcription fails", async () => {
      const mockFilePath = "/fake/uploads/error.mp3";
      validatePath.mockReturnValue(mockFilePath);
      fs.readFileSync.mockReturnValue("fake-audio-buffer");

      axios.post
        .mockResolvedValueOnce({ data: { upload_url: "https://fake.url/error" } })
        .mockResolvedValueOnce({ data: { id: "fake-job-id-error" } });

      axios.get.mockResolvedValueOnce({ data: { status: "error", error: "Audio format not supported" } });

      await expect(transcribeFile(mockFilePath)).rejects.toThrow("Audio format not supported");
    });
  });

  describe("transcribeAudioUrl", () => {
    it("should submit audio url and poll for transcription text", async () => {
      const mockUrl = "https://example.com/audio.mp3";

      axios.post.mockResolvedValueOnce({ data: { id: "fake-job-id-url" } });

      axios.get
        .mockResolvedValueOnce({ data: { status: "completed", text: "Transcribed from URL!" } });

      const result = await transcribeAudioUrl(mockUrl);

      expect(result).toBe("Transcribed from URL!");
      expect(axios.post).toHaveBeenCalledWith(
        "https://api.assemblyai.com/v2/transcript",
        { audio_url: mockUrl },
        expect.objectContaining({ headers: { authorization: MOCK_API_KEY } })
      );
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });
});
