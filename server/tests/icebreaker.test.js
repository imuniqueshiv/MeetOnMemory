// server/tests/icebreaker.test.js
import { selectIcebreaker } from "../controllers/icebreakerController";

describe("Icebreaker Logic Engine Suite", () => {
  let mockIo;
  const mockRoomId = "test-room-101";

  beforeEach(() => {
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  test("Should transition selected icebreakers to live banners and save state histories", () => {
    selectIcebreaker(mockIo, mockRoomId, "Pineapple on pizza?");
    expect(mockIo.to).toHaveBeenCalledWith(mockRoomId);
    expect(mockIo.emit).toHaveBeenCalledWith(
      "icebreaker:sync",
      expect.objectContaining({
        current: "Pineapple on pizza?",
      }),
    );
  });
});
