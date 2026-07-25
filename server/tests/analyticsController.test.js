import { subtractMonthsClamped } from "../controllers/analyticsController.js";

describe("subtractMonthsClamped", () => {
  test("clamps a month-end date to the final day of a shorter month", () => {
    expect(subtractMonthsClamped(new Date(2026, 2, 31), 1)).toEqual(
      new Date(2026, 1, 28),
    );
  });

  test("uses February 29 when the target year is a leap year", () => {
    expect(subtractMonthsClamped(new Date(2024, 2, 31), 1)).toEqual(
      new Date(2024, 1, 29),
    );
  });

  test("preserves the requested day when it exists in the target month", () => {
    expect(subtractMonthsClamped(new Date(2026, 6, 31), 4)).toEqual(
      new Date(2026, 2, 31),
    );
  });
});
