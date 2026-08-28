import { describe, it, expect, beforeEach } from "vitest";
import i18n from "../i18n.js";

describe("i18n RTL direction switching", () => {
  beforeEach(async () => {
    // Reset language to default english before each test
    await i18n.changeLanguage("en");
  });

  it("sets document direction to ltr for English", () => {
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
  });

  it("sets document direction to rtl for Arabic", async () => {
    await i18n.changeLanguage("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("reverts document direction to ltr when switching back to Hindi", async () => {
    await i18n.changeLanguage("ar");
    expect(document.documentElement.dir).toBe("rtl");

    await i18n.changeLanguage("hi");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("hi");
  });
});
