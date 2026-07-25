import { jest } from "@jest/globals";

jest.unstable_mockModule("../utils/embeddingUtils.js", () => ({
  searchVectorStore: jest.fn(),
}));

jest.unstable_mockModule("../models/membershipModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {},
}));
describe("aiRoutes tests", () => {
  it("should have at least one test", () => {
    expect(true).toBe(true);
  });
});
