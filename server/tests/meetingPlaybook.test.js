import { jest } from "@jest/globals";
import mongoose from "mongoose";

// Mock GenerativeAIService
jest.unstable_mockModule("../services/GenerativeAIService.js", () => ({
  generateText: jest.fn(),
  parseJsonOutput: jest.fn(),
}));

const {
  generatePlaybookFromAI,
  createPlaybook,
  updatePlaybook,
  restorePlaybookVersion,
  applyPlaybookToMeeting,
} = await import("../services/meetingPlaybookService.js");
const { default: MeetingPlaybook } =
  await import("../models/meetingPlaybookModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");
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
    await Meeting.deleteMany({});
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
    expect(playbook.version).toBe(1);
    expect(playbook.versions.length).toBe(0);
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

  it("should update playbook steps, bump version, and save snapshot to versions history", async () => {
    const userId = new mongoose.Types.ObjectId();
    const playbook = await createPlaybook({
      name: "Initial Retro",
      description: "Initial description",
      steps: [
        {
          title: "Step 1",
          durationMinutes: 5,
          facilitatorPrompts: ["Icebreaker"],
          expectedOutputs: ["Warmup done"],
        },
      ],
      createdBy: userId,
    });

    const updated = await updatePlaybook(
      playbook._id,
      {
        name: "Updated Retro",
        steps: [
          {
            title: "Step 1 Reordered",
            durationMinutes: 10,
            facilitatorPrompts: ["Ask questions"],
            expectedOutputs: ["Feedback collected"],
          },
          {
            title: "Step 2 Added",
            durationMinutes: 15,
            facilitatorPrompts: ["Wrap up"],
            expectedOutputs: ["Action items"],
          },
        ],
      },
      userId,
    );

    expect(updated.version).toBe(2);
    expect(updated.name).toBe("Updated Retro");
    expect(updated.steps.length).toBe(2);
    expect(updated.versions.length).toBe(1);
    expect(updated.versions[0].version).toBe(1);
    expect(updated.versions[0].name).toBe("Initial Retro");
    expect(updated.versions[0].steps[0].title).toBe("Step 1");
  });

  it("should restore a prior version snapshot", async () => {
    const userId = new mongoose.Types.ObjectId();
    const playbook = await createPlaybook({
      name: "Version 1 Title",
      description: "Version 1 Desc",
      steps: [
        {
          title: "Step V1",
          durationMinutes: 5,
          facilitatorPrompts: [],
          expectedOutputs: [],
        },
      ],
      createdBy: userId,
    });

    await updatePlaybook(
      playbook._id,
      {
        name: "Version 2 Title",
        steps: [
          {
            title: "Step V2",
            durationMinutes: 10,
            facilitatorPrompts: [],
            expectedOutputs: [],
          },
        ],
      },
      userId,
    );

    const restored = await restorePlaybookVersion(playbook._id, 1, userId);
    expect(restored.version).toBe(3);
    expect(restored.name).toBe("Version 1 Title");
    expect(restored.steps[0].title).toBe("Step V1");
    expect(restored.versions.length).toBe(2);
  });

  it("should apply playbook to a meeting and increment playbook usageCount", async () => {
    const userId = new mongoose.Types.ObjectId();
    const playbook = await createPlaybook({
      name: "Engineering Weekly Sync",
      steps: [{ title: "Agenda Review", durationMinutes: 5 }],
      createdBy: userId,
    });

    const meeting = await Meeting.create({
      uploadedBy: userId,
      title: "Sprint Planning Meeting",
      date: new Date(),
    });

    const result = await applyPlaybookToMeeting(playbook._id, meeting._id);
    expect(result.meeting.playbook.toString()).toBe(playbook._id.toString());
    expect(result.playbook.usageCount).toBe(1);

    const updatedMeeting = await Meeting.findById(meeting._id);
    expect(updatedMeeting.playbook.toString()).toBe(playbook._id.toString());
  });
});
