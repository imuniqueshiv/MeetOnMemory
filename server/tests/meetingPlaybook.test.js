import { jest } from "@jest/globals";
import mongoose from "mongoose";

// Mock GenerativeAIService
jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateText: jest.fn(),
  parseJsonOutput: jest.fn(),
}));

const { generatePlaybookFromAI, createPlaybook } =
  await import("../services/meetingPlaybookService.js");
const { default: MeetingPlaybook } =
  await import("../models/meetingPlaybookModel.js");
const GenerativeAIService = await import("../services/GenerativeAIService.js");

describe("meetingPlaybookService", () => {
  beforeAll(async () => {
    // Assuming connectDB handles connection for tests or using an in-memory DB
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/meetonmemory_test",
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await MeetingPlaybook.deleteMany({});
    jest.clearAllMocks();
  });

  it("should create a playbook", async () => {
    const data = {
      name: "Test Playbook",
      description: "Test description",
      steps: [
        {
          title: "Step 1",
          durationMinutes: 10,
          facilitatorPrompts: ["Prompt 1"],
          expectedOutputs: ["Output 1"],
        },
      ],
      createdBy: new mongoose.Types.ObjectId(),
    };

    const playbook = await createPlaybook(data);
    expect(playbook).toBeDefined();
    expect(playbook.name).toBe("Test Playbook");
    expect(playbook.steps.length).toBe(1);
  });

  it("should generate a playbook from AI", async () => {
    const mockParsedOutput = {
      name: "AI Generated Playbook",
      description: "AI description",
      steps: [
        {
          title: "AI Step 1",
          durationMinutes: 15,
          facilitatorPrompts: ["AI Prompt"],
          expectedOutputs: ["AI Output"],
        },
      ],
    };

    GenerativeAIService.generateText.mockResolvedValue(
      JSON.stringify(mockParsedOutput),
    );
    GenerativeAIService.parseJsonOutput.mockReturnValue(mockParsedOutput);

    const userId = new mongoose.Types.ObjectId();
    const playbook = await generatePlaybookFromAI(
      "Make a retro",
      "Sprint Retrospective",
      userId,
    );

    expect(playbook).toBeDefined();
    expect(playbook.name).toBe("AI Generated Playbook");
    expect(playbook.createdBy.toString()).toBe(userId.toString());
  });

  it("should throw error if AI generates invalid structure", async () => {
    const mockInvalidOutput = {
      description: "AI description",
      // missing name and steps
    };

    GenerativeAIService.generateText.mockResolvedValue(
      JSON.stringify(mockInvalidOutput),
    );
    GenerativeAIService.parseJsonOutput.mockReturnValue(mockInvalidOutput);

    const userId = new mongoose.Types.ObjectId();
    await expect(
      generatePlaybookFromAI("Make a retro", "Sprint Retrospective", userId),
    ).rejects.toThrow("AI generated an invalid playbook structure");
  });
});
